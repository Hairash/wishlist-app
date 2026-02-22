# Development

## Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e .
pip install black ruff pytest pytest-django
ruff check .
black --check .
pytest
```

## Frontend
```bash
cd frontend
npm ci
npm run lint
npm run test
npm run dev
```
