"""Write docs/api/api.md from backend/openapi.yaml.

The YAML is the contract the server serves. This page is the reading copy.
Edit the YAML, then run this script from the repository root:

    backend/.venv/bin/python backend/scripts/render_api_md.py
"""

from __future__ import annotations

import json
import re
from datetime import date, datetime
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
SPEC_PATH = ROOT / "backend" / "openapi.yaml"
OUT_PATH = ROOT / "docs" / "api" / "api.md"
METHODS = {"get", "post", "put", "patch", "delete", "head", "options", "trace"}


def load_spec() -> dict:
    spec = yaml.safe_load(SPEC_PATH.read_text(encoding="utf-8"))
    if not isinstance(spec, dict) or not isinstance(spec.get("paths"), dict):
        raise SystemExit(f"{SPEC_PATH} has no paths object")
    return spec


def ref_name(ref: str) -> str:
    return ref.rsplit("/", 1)[-1]


def resolve(spec: dict, node):
    seen = set()
    while isinstance(node, dict) and "$ref" in node and set(node) <= {"$ref", "description"}:
        ref = node["$ref"]
        if ref in seen:
            raise SystemExit(f"cyclic $ref {ref}")
        seen.add(ref)
        parts = ref.lstrip("#/").split("/")
        cursor = spec
        for part in parts:
            cursor = cursor[part]
        description = node.get("description")
        node = cursor
        if description and isinstance(node, dict) and "description" not in node:
            node = {**node, "description": description}
    return node


def clean(text) -> str:
    text = re.sub(r"\s+", " ", str(text).replace("\r", "")).strip()
    return text.replace("|", "\\|")


def anchor_operation(method: str, path: str) -> str:
    slug = f"{method.lower()}-{path.strip('/')}"
    slug = slug.replace("/", "-")
    slug = re.sub(r"[^a-z0-9_-]", "", slug)
    return slug


def anchor_schema(name: str) -> str:
    return "schema-" + re.sub(r"[^a-z0-9_-]", "", name.lower())


def anchor_tag(name: str) -> str:
    return "tag-" + re.sub(r"[^a-z0-9_-]", "", name.lower().replace(" ", "-"))


def json_block(value) -> str:
    def convert(item):
        if isinstance(item, dict):
            return {key: convert(inner) for key, inner in item.items()}
        if isinstance(item, list):
            return [convert(inner) for inner in item]
        if isinstance(item, (datetime, date)):
            return item.isoformat()
        return item

    body = json.dumps(convert(value), indent=2, ensure_ascii=False)
    return f"```json\n{body}\n```"


def type_label(spec: dict, schema, depth: int = 0) -> str:
    if not isinstance(schema, dict) or depth > 8:
        return "value"
    if "$ref" in schema and set(schema) <= {"$ref", "description"}:
        name = ref_name(schema["$ref"])
        target = resolve(spec, schema)
        if "enum" in target and "properties" not in target:
            return " or ".join(f"`{item}`" for item in target["enum"])
        return f"[{name}](#{anchor_schema(name)})"
    if "oneOf" in schema:
        return " or ".join(type_label(spec, part, depth + 1) for part in schema["oneOf"])
    if "enum" in schema:
        return " or ".join(f"`{item}`" for item in schema["enum"])
    if "const" in schema:
        return f"`{schema['const']}`"
    if schema.get("type") == "array":
        return "list of " + type_label(spec, schema.get("items") or {}, depth + 1)
    kinds = schema.get("type")
    if isinstance(kinds, list):
        return " or ".join("null" if kind == "null" else str(kind) for kind in kinds)
    if kinds == "null":
        return "null"
    if kinds == "string" and schema.get("format"):
        return str(schema["format"])
    if kinds:
        return str(kinds)
    if "allOf" in schema:
        return "object"
    return "object"


def field_notes(schema: dict) -> str:
    if not isinstance(schema, dict):
        return ""
    parts = []
    if schema.get("description"):
        parts.append(clean(schema["description"]))
    low = schema.get("minLength")
    high = schema.get("maxLength")
    if low is not None and high is not None:
        parts.append(f"{low}–{high} characters")
    elif low is not None:
        parts.append(f"at least {low} characters")
    elif high is not None:
        parts.append(f"at most {high} characters")
    if "minimum" in schema and "maximum" in schema:
        parts.append(f"{schema['minimum']}–{schema['maximum']}")
    elif "minimum" in schema:
        parts.append(f"minimum {schema['minimum']}")
    elif "maximum" in schema:
        parts.append(f"maximum {schema['maximum']}")
    if schema.get("pattern"):
        parts.append(f"pattern `{schema['pattern']}`")
    if "default" in schema:
        parts.append(f"default `{schema['default']}`")
    text = ""
    for part in parts:
        part = part.strip().rstrip(".")
        if not part:
            continue
        if text:
            text += ". "
        text += part
    if text:
        text += "."
    return text


def object_fields(spec: dict, schema) -> list[dict] | None:
    """Fields of an object. None means the schema is a union, not one object."""
    node = resolve(spec, schema)
    if "oneOf" in node and "properties" not in node and "allOf" not in node:
        return None
    props: dict = {}
    required: set[str] = set()

    def absorb(part) -> None:
        part = resolve(spec, part)
        if "allOf" in part:
            for piece in part["allOf"]:
                absorb(piece)
            return
        if "oneOf" in part and "properties" not in part:
            return
        props.update(part.get("properties") or {})
        required.update(part.get("required") or [])

    absorb(node)
    rows = []
    for name, prop in props.items():
        rows.append(
            {
                "name": name,
                "required": "yes" if name in required else "no",
                "type": type_label(spec, prop),
                "notes": field_notes(prop if isinstance(prop, dict) else {}),
            }
        )
    return rows


def field_table(rows: list[dict]) -> list[str]:
    if not rows:
        return ["No fields.", ""]
    lines = [
        "| Field | Required | Type | Notes |",
        "|---|---|---|---|",
    ]
    for row in rows:
        lines.append(
            f"| `{row['name']}` | {row['required']} | {row['type']} | {row['notes']} |"
        )
    lines.append("")
    return lines


def union_parts(spec: dict, schema) -> list | None:
    node = resolve(spec, schema)
    if "oneOf" in node and "properties" not in node and "allOf" not in node:
        return node["oneOf"]
    return None


def schema_heading(spec: dict, schema) -> str:
    if isinstance(schema, dict) and "$ref" in schema:
        name = ref_name(schema["$ref"])
        return f"[{name}](#{anchor_schema(name)})"
    label = type_label(spec, schema)
    return label


def render_body(spec: dict, schema, lines: list[str]) -> None:
    parts = union_parts(spec, schema)
    if parts is not None:
        names = []
        for part in parts:
            if isinstance(part, dict) and "$ref" in part:
                names.append(ref_name(part["$ref"]))
        if names:
            lines.append("One of: " + ", ".join(f"[{name}](#{anchor_schema(name)})" for name in names) + ".")
            lines.append("")
        for part in parts:
            title = ref_name(part["$ref"]) if isinstance(part, dict) and "$ref" in part else "Variant"
            lines.append(f"**{title}**")
            lines.append("")
            rows = object_fields(spec, part)
            lines.extend(field_table(rows or []))
        return
    lines.append(f"Body: {schema_heading(spec, schema)}.")
    lines.append("")
    rows = object_fields(spec, schema)
    lines.extend(field_table(rows or []))


def examples_of(media: dict) -> list[tuple[str, object]]:
    found = []
    if "example" in media:
        found.append(("Example", media["example"]))
    for key, example in (media.get("examples") or {}).items():
        if isinstance(example, dict):
            found.append((str(example.get("summary") or key), example.get("value")))
        else:
            found.append((str(key), example))
    return found


def render_content(
    spec: dict,
    content: dict | None,
    lines: list[str],
    include_fields: bool,
    include_examples: bool = True,
) -> None:
    if not content:
        lines.append("No body.")
        lines.append("")
        return
    media = content.get("application/json") or next(iter(content.values()))
    schema = media.get("schema")
    if include_fields and schema is not None:
        render_body(spec, schema, lines)
    elif schema is not None:
        lines.append(f"Body: {schema_heading(spec, schema)}.")
        lines.append("")
    if include_examples:
        for title, value in examples_of(media):
            lines.append(f"**{title}**")
            lines.append("")
            lines.append(json_block(value))
            lines.append("")


def parameter_rows(spec: dict, parameters: list) -> list[str]:
    if not parameters:
        return []
    lines = [
        "**Parameters**",
        "",
        "| Name | In | Required | Type | Notes |",
        "|---|---|---|---|---|",
    ]
    for parameter in parameters:
        parameter = resolve(spec, parameter)
        schema = parameter.get("schema") or {}
        lines.append(
            "| `{name}` | {where} | {required} | {kind} | {notes} |".format(
                name=parameter.get("name", ""),
                where=parameter.get("in", ""),
                required="yes" if parameter.get("required") else "no",
                kind=type_label(spec, schema),
                notes=field_notes({**schema, "description": parameter.get("description") or schema.get("description")}),
            )
        )
    lines.append("")
    return lines


def auth_line(operation: dict) -> str:
    security = operation.get("security", [{"bearerAuth": []}])
    if security == []:
        return "No token."
    return "Bearer access token."


def caller_line(description: str, public: bool) -> str:
    match = re.search(r"Caller:\s*(.+)", description)
    if match:
        return clean(match.group(1).split(".")[0])
    if public:
        return "Anyone"
    return "Signed-in account"


def render(spec: dict) -> tuple[str, int]:
    info = spec["info"]
    lines: list[str] = [
        f"# {info['title']}",
        "",
        f"API version: **{info['version']}**",
        "",
        "This is the reading copy of [`backend/openapi.yaml`](../../backend/openapi.yaml). "
        "Swagger at `/docs` serves that file. Stored data is in [`database.md`](../database/database.md). "
        "When an endpoint changes, edit the YAML and regenerate this page from the repository root:",
        "",
        "```bash",
        "backend/.venv/bin/python backend/scripts/render_api_md.py",
        "```",
        "",
        "Do not edit this page by hand.",
        "",
        "## Contents",
        "",
        "- [How to call the API](#how-to-call-the-api)",
    ]

    tag_order = [tag["name"] for tag in spec.get("tags") or []]
    grouped: dict[str, list] = {name: [] for name in tag_order}
    for path, path_item in spec["paths"].items():
        shared = list(path_item.get("parameters") or [])
        for method, operation in path_item.items():
            if method not in METHODS:
                continue
            tag = (operation.get("tags") or ["Other"])[0]
            grouped.setdefault(tag, []).append((path, method, operation, shared))

    for tag, operations in grouped.items():
        if not operations:
            continue
        lines.append(f"- [{tag}](#{anchor_tag(tag)})")
        for path, method, operation, _shared in operations:
            title = operation.get("summary") or operation.get("operationId")
            link = anchor_operation(method, path)
            lines.append(f"  - [{method.upper()} `{path}` — {title}](#{link})")
    lines.append(f"- [Payloads](#{anchor_tag('Payloads')})")
    lines.extend(["", "## How to call the API", ""])
    description = (info.get("description") or "").strip()
    if description:
        lines.extend([description, ""])
    lines.extend(["| Server | Use |", "|---|---|"])
    for server in spec.get("servers") or []:
        lines.append(f"| `{server['url']}` | {clean(server.get('description', ''))} |")
    lines.extend(
        [
            "",
            "JSON names are snake_case. Send `Authorization: Bearer` plus the access token, except where an operation says no token.",
            "",
            "## Operations",
            "",
        ]
    )

    operation_count = 0
    for tag, operations in grouped.items():
        if not operations:
            continue
        lines.extend([f"## <a id=\"{anchor_tag(tag)}\"></a>{tag}", ""])
        blurb = next((item.get("description", "") for item in spec.get("tags") or [] if item["name"] == tag), "")
        if blurb:
            lines.extend([blurb.strip(), ""])
        lines.extend(["| Method | Path | Purpose | Who |", "|---|---|---|---|"])
        for path, method, operation, _shared in operations:
            description = operation.get("description") or ""
            public = operation.get("security") == []
            purpose = operation.get("summary") or operation.get("operationId")
            link = anchor_operation(method, path)
            lines.append(
                f"| {method.upper()} | `{path}` | [{purpose}](#{link}) | {caller_line(description, public)} |"
            )
        lines.append("")
        for path, method, operation, shared in operations:
            operation_count += 1
            link = anchor_operation(method, path)
            title = operation.get("summary") or operation.get("operationId")
            description = (operation.get("description") or "").strip()
            public = operation.get("security") == []
            lines.extend(
                [
                    f"### <a id=\"{link}\"></a>{method.upper()} `{path}` — {title}",
                    "",
                    f"`{operation.get('operationId', '')}`",
                    "",
                    f"**Who.** {caller_line(description, public)}. {auth_line(operation)}",
                    "",
                ]
            )
            if description:
                lines.extend([description, ""])
            parameters = shared + list(operation.get("parameters") or [])
            lines.extend(parameter_rows(spec, parameters))
            body = operation.get("requestBody")
            if body:
                lines.append("**Request.** " + ("Required." if body.get("required", True) else "Optional."))
                lines.append("")
                content = (body.get("content") or {})
                render_content(spec, content, lines, include_fields=True)
            lines.append("**Responses**")
            lines.append("")
            for status, raw_response in (operation.get("responses") or {}).items():
                shared = (
                    isinstance(raw_response, dict)
                    and set(raw_response) <= {"$ref"}
                    and str(raw_response.get("$ref", "")).startswith("#/components/responses/")
                )
                response = resolve(spec, raw_response)
                lines.append(f"#### {status}")
                lines.append("")
                if response.get("description"):
                    lines.extend([response["description"].strip(), ""])
                content = response.get("content")
                if content:
                    is_error = str(status).startswith(("4", "5"))
                    render_content(
                        spec,
                        content,
                        lines,
                        include_fields=not is_error,
                        include_examples=not shared,
                    )
                else:
                    lines.extend(["No body.", ""])
            lines.append("")

    lines.extend(
        [
            f"## <a id=\"{anchor_tag('Payloads')}\"></a>Payloads",
            "",
            "Each JSON object used above. An operation section already shows the fields for its own request and success response.",
            "",
        ]
    )
    for name, schema in (spec.get("components") or {}).get("schemas", {}).items():
        lines.extend([f"### <a id=\"{anchor_schema(name)}\"></a>{name}", ""])
        if schema.get("description"):
            lines.extend([schema["description"].strip(), ""])
        parts = union_parts(spec, schema)
        if parts is not None:
            mapping = (schema.get("discriminator") or {}).get("mapping") or {}
            if mapping:
                lines.append("The `type` field selects the object:")
                lines.append("")
                for key, ref in mapping.items():
                    lines.append(f"- `{key}` → [{ref_name(ref)}](#{anchor_schema(ref_name(ref))})")
                lines.append("")
            else:
                lines.append("One of:")
                lines.append("")
                for part in parts:
                    if isinstance(part, dict) and "$ref" in part:
                        label = ref_name(part["$ref"])
                        lines.append(f"- [{label}](#{anchor_schema(label)})")
                lines.append("")
            continue
        if "enum" in schema and "properties" not in schema:
            lines.append("One of: " + ", ".join(f"`{item}`" for item in schema["enum"]) + ".")
            lines.append("")
            continue
        rows = object_fields(spec, schema)
        lines.extend(field_table(rows or []))

    if operation_count == 0:
        raise SystemExit("rendered no operations")
    text = "\n".join(lines).rstrip() + "\n"
    return text, operation_count


def main() -> None:
    spec = load_spec()
    text, operation_count = render(spec)
    OUT_PATH.write_text(text, encoding="utf-8")
    print(f"wrote {OUT_PATH} ({operation_count} operations)")


if __name__ == "__main__":
    main()
