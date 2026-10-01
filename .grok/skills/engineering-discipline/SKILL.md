---
name: engineering-discipline
description: >
  Strict rules for this repository: follow spec-driven and test-driven
  development, document every test the way an API operation is documented in
  Swagger, update the schema document when a schema changes, and update the
  system architecture diagram when a part of the system is added, removed, or
  connected. Never write
  unit tests after the code. Prefer E2E tests that leave a verifiable
  repeatable artifact. If a system must be tested in isolation, write the
  failure cases first, then the code. Use before implementing, testing, or
  changing an API, schema, or test, and when the user mentions TDD, SDD,
  Swagger, tests, or documentation. Use when the user runs
  /engineering-discipline.
---

# Engineering discipline

Read and follow **Engineering rules** in `AGENTS.md` before writing code, tests, API contracts, schema changes, or a change to the shape of the system. The diagram is `docs/architecture/system-architecture.md`.

The test entry format is at the top of `docs/tests/tests.md`.

Red, green, refactor in small slices. One slice is one named behavior. A migration happens only when stored records change. Tests live in the business folder they protect.

Schema and HTTP contract edits also follow `.grok/skills/contract-maintenance/SKILL.md`.
