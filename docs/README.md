# Docs

Organised by domain. Prefer these folders over dumping new files at the `docs/` root. Design docs list intent; implementation stays Fowler-simple and biased to fast, smooth Expo UX (see `design/design-system.md` §1).

| Domain | Path | What lives here |
|---|---|---|
| **Index** | [`README.md`](README.md) | This map |
| **Design** | [`design/`](design/) | Visual system and product workflows for the Expo client |
| **API** | [`api/`](api/) | Reading copy of the HTTP contract (generated from OpenAPI) |
| **Database** | [`database/`](database/) | What the hall keeps, lifecycles, and product rules for stored data |
| **Architecture** | [`architecture/`](architecture/) | System shape as it stands |
| **Tests** | [`tests/`](tests/) | Test catalog / specifications |
| **Engineering** | [`engineering/`](engineering/) | Local engineering notes (pre-commit, tooling) |
| **Security** | [`security/`](security/) | Pre-ship checklist before production |

## Files

| File | Domain |
|---|---|
| [`design/design-system.md`](design/design-system.md) | Palette, type, layout, motion, stress UI |
| [`design/workflows.md`](design/workflows.md) | Auth, home, permissions, register, gate, guests, office |
| [`api/api.md`](api/api.md) | Endpoints for reading (do not edit by hand) |
| [`database/database.md`](database/database.md) | Schema, rules, open hall decisions |
| [`architecture/system-architecture.md`](architecture/system-architecture.md) | Diagram and parts in use |
| [`tests/tests.md`](tests/tests.md) | Every test entry |
| [`engineering/dev-pre-commit.md`](engineering/dev-pre-commit.md) | Gitleaks via pre-commit |
| [`security/pre-ship-checklist.md`](security/pre-ship-checklist.md) | Don't ship until you check this |
| [`load.md`](load.md) | Optional Locust notes. Not part of the recorded catalog |

**Product / business rules:** kept in [`database/database.md`](database/database.md) with the data they govern. No separate `rules/` folder until a rule set outgrows that file.

**Source of HTTP truth:** `backend/openapi.yaml`. Regenerate the reading copy:

```bash
backend/.venv/bin/python backend/scripts/render_api_md.py
```

Swagger at `/docs` still serves the YAML, not these Markdown files.
