---
name: pre-pr-checks
description: Run repository checks before opening a pull request. Use when asked to validate a change, run lint/tests, or perform pre-PR verification. For this wishlist app, always activate backend/.venv before running backend linting or pytest.
---

# Pre-PR Checks

Run all quality checks before creating a PR.

## Workflow

1. Ensure repository dependencies are present.
2. Activate backend virtual environment before any backend command.
3. Run backend linting and formatting checks.
4. Run backend tests.
5. Run frontend linting and tests.
6. Report pass/fail status per command.

## Commands for wishlist-app

Run from repo root:

```bash
bash skills/pre-pr-checks/scripts/run_pre_pr_checks.sh
```

## Requirements

- Use `source backend/.venv/bin/activate` before backend checks.
- Do not run backend `pytest` outside the virtual environment.
- Stop on first failure and report the failing command.
