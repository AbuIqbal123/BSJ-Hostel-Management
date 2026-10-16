"""Fail when the reading copies drift from the contracts.

Run from the repository root or from backend/:

    python backend/scripts/check_docs.py
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TESTS_MD = ROOT / "docs" / "tests" / "tests.md"
SPEC_PATH = ROOT / "backend" / "openapi.yaml"
POSTMAN = ROOT / "postman"
ONES = {
    "zero": 0,
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "eight": 8,
    "nine": 9,
    "ten": 10,
    "eleven": 11,
    "twelve": 12,
    "thirteen": 13,
    "fourteen": 14,
    "fifteen": 15,
    "sixteen": 16,
    "seventeen": 17,
    "eighteen": 18,
    "nineteen": 19,
}
TENS = {
    "twenty": 20,
    "thirty": 30,
    "forty": 40,
    "fifty": 50,
    "sixty": 60,
    "seventy": 70,
    "eighty": 80,
    "ninety": 90,
}


def fail(message: str) -> None:
    raise SystemExit(message)


def header_count(text: str) -> int:
    match = re.search(r"^Status:\s+(.+?)\s+recorded tests\.", text, re.MULTILINE)
    if match is None:
        fail("docs/tests/tests.md has no 'Status: … recorded tests.' line")
    words = match.group(1).replace("-", " ").split()
    if len(words) == 1 and words[0].isdigit():
        return int(words[0])
    if len(words) == 1 and words[0] in ONES:
        return ONES[words[0]]
    if len(words) == 1 and words[0] in TENS:
        return TENS[words[0]]
    if len(words) == 2 and words[0] in TENS and words[1] in ONES:
        return TENS[words[0]] + ONES[words[1]]
    fail(f"docs/tests/tests.md status count is not a number this check knows: {match.group(1)}")


def catalog_entries(text: str) -> int:
    catalog = text.split("## Catalog", 1)
    if len(catalog) != 2:
        fail("docs/tests/tests.md has no Catalog section")
    return len(re.findall(r"^### ", catalog[1], re.MULTILINE))


def test_files() -> list[Path]:
    found: list[Path] = []
    roots = (
        (ROOT / "backend", "test_*.py"),
        (ROOT / "mobile" / "src", "*.test.ts"),
        (ROOT / "mobile" / "src", "*.test.tsx"),
        (ROOT / "e2e", "*.e2e.ts"),
    )
    skipped = {".venv", "node_modules", "__pycache__", ".e2e"}
    for base, pattern in roots:
        if not base.is_dir():
            continue
        for path in base.rglob(pattern):
            if skipped.intersection(path.parts):
                continue
            found.append(path)
    return sorted(found)


def normalize_path(path: str) -> str:
    path = path.split("?", 1)[0].strip().strip("'\"")
    path = path.replace("{{baseUrl}}", "")
    path = re.sub(r"\{\{[^}]+\}\}", "{}", path)
    path = re.sub(r"\{[^}]+\}", "{}", path)
    if not path.startswith("/"):
        path = "/" + path
    path = re.sub(r"/{2,}", "/", path)
    if len(path) > 1:
        path = path.rstrip("/")
    return path


def postman_paths() -> set[str]:
    found: set[str] = set()
    for file in POSTMAN.rglob("*.request.yaml"):
        for line in file.read_text(encoding="utf-8").splitlines():
            if line.startswith("url:"):
                found.add(normalize_path(line.split(":", 1)[1]))
    return found


def openapi_paths() -> set[str]:
    sys.path.insert(0, str(ROOT / "backend" / "scripts"))
    import render_api_md

    spec = render_api_md.load_spec()
    return {normalize_path(path) for path in spec["paths"]}


def check_api_page() -> None:
    sys.path.insert(0, str(ROOT / "backend" / "scripts"))
    import render_api_md

    text, _count = render_api_md.render(render_api_md.load_spec())
    committed = render_api_md.OUT_PATH.read_text(encoding="utf-8")
    if text != committed:
        fail("docs/api/api.md does not match backend/openapi.yaml. Run backend/scripts/render_api_md.py")


def main() -> None:
    if not SPEC_PATH.is_file():
        fail(f"missing {SPEC_PATH}")
    text = TESTS_MD.read_text(encoding="utf-8")
    stated = header_count(text)
    found = catalog_entries(text)
    if stated != found:
        fail(
            f"docs/tests/tests.md says {stated} recorded tests and the catalog has {found} entries"
        )
    missing_files = [
        path.relative_to(ROOT).as_posix()
        for path in test_files()
        if path.relative_to(ROOT).as_posix() not in text
    ]
    if missing_files:
        joined = ", ".join(missing_files)
        fail(f"these test files have no docs/tests/tests.md entry: {joined}")
    check_api_page()
    missing_paths = sorted(openapi_paths() - postman_paths())
    if missing_paths:
        fail("these openapi paths are not in the Postman collection: " + ", ".join(missing_paths))
    print(f"docs checks passed ({found} tests)")


if __name__ == "__main__":
    main()
