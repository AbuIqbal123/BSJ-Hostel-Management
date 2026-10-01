# Pre-commit secret scanning

This repo uses [pre-commit](https://pre-commit.com/) with [Gitleaks](https://github.com/gitleaks/gitleaks) to catch hardcoded secrets before they are committed. No API key or paid plan is required.

## Install once

```bash
pip install pre-commit
pre-commit install
```

## Run on the whole tree

```bash
pre-commit run --all-files
```

After `pre-commit install`, Gitleaks runs on staged files at each commit. To skip one commit: `SKIP=gitleaks git commit …`.

Paid scanners such as GitGuardian (`ggshield`) are optional and not required for this hook.
