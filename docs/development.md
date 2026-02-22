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

### Backend security/rate-limit environment variables

- `ADMIN_PASSWORD`: password for admin session login.
- `RESERVE_RATE_LIMIT`: DRF throttle rate for reserve endpoint (`10/hour` default).
- `COMMENT_RATE_LIMIT`: DRF throttle rate for comment creation endpoint (`20/hour` default).
- `SESSION_COOKIE_SECURE`: set `true` in production HTTPS.
- `CSRF_COOKIE_SECURE`: set `true` in production HTTPS.
- `SESSION_COOKIE_SAMESITE`: cookie SameSite mode (`Lax` default).
- `CSRF_COOKIE_SAMESITE`: cookie SameSite mode (`Lax` default).

## Frontend
```bash
cd frontend
npm ci
npm run lint
npm run test
npm run dev
```

### Frontend environment variables

- `VITE_API_BASE_URL`: API base URL used by the frontend (`/api` default for local/same-origin setups).
