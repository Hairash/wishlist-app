# wishlist-app

Wishlist app with a Django REST backend and React frontend.

## Repository structure
- `backend/`: Django + DRF API
- `frontend/`: React web app (Vite)
- `docs/`: architecture and development notes

## Quick start
### Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e .
pip install black ruff pytest pytest-django
python manage.py runserver
```

### Frontend
```bash
cd frontend
npm ci
npm run dev
```

## CI
GitHub Actions runs linting and tests for both backend and frontend on pushes and pull requests.


## Deployment
See `docs/deployment.md` for Render + Cloudflare Pages setup and required GitHub Action secrets.
