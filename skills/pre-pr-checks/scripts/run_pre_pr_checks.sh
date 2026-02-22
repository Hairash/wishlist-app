#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT_DIR"

echo "[pre-pr] backend checks in venv"
source backend/.venv/bin/activate
(
  cd backend
  ruff check .
  black --check .
  pytest
)
deactivate

echo "[pre-pr] frontend checks"
(
  cd frontend
  npm run lint
  npm run test
)

echo "[pre-pr] all checks passed"
