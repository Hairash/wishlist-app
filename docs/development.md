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
- `CLOUDINARY_URL`: Cloudinary backend credentials in the form `cloudinary://API_KEY:API_SECRET@CLOUD_NAME`.
- `RESERVE_RATE_LIMIT`: DRF throttle rate for reserve endpoint (`10/hour` default).
- `COMMENT_RATE_LIMIT`: DRF throttle rate for comment creation endpoint (`20/hour` default).
- `CORS_ALLOWED_ORIGINS`: comma-separated frontend origins allowed to send credentialed requests.
- `SESSION_COOKIE_SECURE`: set `true` in production HTTPS.
- `CSRF_COOKIE_SECURE`: set `true` in production HTTPS.
- `SESSION_COOKIE_SAMESITE`: cookie SameSite mode (`Lax` by default, `None` for cross-origin production deployments).
- `CSRF_COOKIE_SAMESITE`: cookie SameSite mode (`Lax` by default, `None` for cross-origin production deployments).
- The public undo flow uses an `HttpOnly` `wishlist_actions` cookie and follows the same secure/SameSite settings as the session cookie.

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
- `VITE_DEV_PROXY_TARGET`: optional Vite dev proxy target for local backend requests (`http://127.0.0.1:8000` default).
- No frontend-side admin password storage or auth token env var is required.
