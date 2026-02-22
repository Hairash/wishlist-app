# Deployment

This project deploys with:

- **Backend**: Render web service.
- **Frontend**: Cloudflare Pages static site.
- **CI/CD**: GitHub Actions (`CI` + `Deploy` workflows).

## 1) Backend deployment (Render)

1. Create a new Render Web Service connected to this repository.
2. Configure Render build/start commands for Django:
   - Build command: `pip install -e .`
   - Start command: `python manage.py migrate && python manage.py collectstatic --noinput && gunicorn config.wsgi`
3. Set service root directory to `backend/`.
4. Add backend environment variables in Render:
   - `ADMIN_PASSWORD`
   - `RESERVE_RATE_LIMIT` (optional override)
   - `COMMENT_RATE_LIMIT` (optional override)
   - `SESSION_COOKIE_SECURE=true`
   - `CSRF_COOKIE_SECURE=true`
   - `SESSION_COOKIE_SAMESITE=Lax`
   - `CSRF_COOKIE_SAMESITE=Lax`
5. Copy the Render Deploy Hook URL.

## 2) Frontend deployment (Cloudflare Pages)

1. Create a Cloudflare Pages project for this repository.
2. Build settings:
   - Framework preset: `Vite`
   - Root directory: `frontend`
   - Build command: `npm run build`
   - Build output directory: `dist`
3. Add environment variable:
   - `VITE_API_BASE_URL` set to your production backend API base, e.g. `https://your-backend.example.com/api`
4. Note your Cloudflare account ID and Pages project name.

## 3) GitHub secrets required for automated deploys

Repository Settings → Secrets and variables → Actions:

- `RENDER_DEPLOY_HOOK_URL`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_PROJECT_NAME`
- `VITE_API_BASE_URL`

## 4) Workflow behavior

- Pull requests run lint + tests through `.github/workflows/ci.yml`.
- Pushes to `main` run `CI` and then trigger `.github/workflows/deploy.yml`.
- The deploy workflow:
  - Triggers Render using `RENDER_DEPLOY_HOOK_URL`.
  - Builds frontend and deploys `frontend/dist` to Cloudflare Pages.
- `workflow_dispatch` can be used to manually run deploy jobs.
