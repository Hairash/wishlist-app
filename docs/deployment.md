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

### Cloudflare Pages deploy command note

- For a **Pages project**, use `npx wrangler pages deploy dist --project-name=<your-project>`.
- `npx wrangler deploy` is for **Workers**, not Pages static deployments, so it is not the right command here.
- In the Cloudflare Pages UI, keep build command as `npm run build` and output directory as `dist`; you do not need to set `wrangler deploy` there.

## 5) What value to use for each GitHub secret

Use these exact mappings when creating repository secrets:

- `RENDER_DEPLOY_HOOK_URL`
  - Value: the **Render Deploy Hook URL** for your backend service (looks like `https://api.render.com/deploy/srv-...?...`).
  - Where to get it: Render Dashboard → your backend service → **Settings** → **Deploy Hook** (create one if needed).
- `CLOUDFLARE_API_TOKEN`
  - Value: a Cloudflare API token with permissions to deploy Pages for your account/project.
  - Recommended minimum permissions: **Account / Cloudflare Pages / Edit** (scoped to your account).
  - Where to get it: Cloudflare Dashboard → **My Profile** → **API Tokens** → Create token.
- `CLOUDFLARE_ACCOUNT_ID`
  - Value: your Cloudflare account ID (a 32-character hex-like ID).
  - Where to get it: Cloudflare Dashboard sidebar/footer, or Workers & Pages account overview.
- `CLOUDFLARE_PROJECT_NAME`
  - Value: the exact Cloudflare Pages project name (slug) you created (for example `wishlist-app`).
  - Must exactly match the Pages project in Cloudflare.
- `VITE_API_BASE_URL`
  - Value: your public backend API base URL that frontend should call in production.
  - Example: `https://wishlist-backend.onrender.com/api`
  - Include `/api` at the end because frontend builds endpoint paths under that base.

If you keep `VITE_API_BASE_URL` empty, frontend falls back to `/api` (works only when frontend and backend are served from the same origin with matching routing/proxy).

## 6) FAQ and troubleshooting

### Is `RENDER_DEPLOY_HOOK_URL` the same as `https://wishlist-app-x25n.onrender.com`?

No. Use the **Render Deploy Hook URL** from Render service settings (an `https://api.render.com/deploy/...` URL), not your public site URL.

### Which Cloudflare account ID should I use?

Use the 32-character account ID, for example `229bd56236fe031df1f21d8fe079e730`.
Do **not** use your email address.

### Which Cloudflare project name should I use?

Use your exact Pages project slug. In your case: `wishlist-app`.

### Should I create a Cloudflare API token?

Yes. If you cannot view the value of an existing token, create a new one and store its value in GitHub secret `CLOUDFLARE_API_TOKEN`.
Use a token with Pages deploy permissions (at least **Account / Cloudflare Pages / Edit** for the target account).

### Which Cloudflare token to choose (easy + correct)

Prefer creating a **new custom API token** just for GitHub deploys. It is both easiest to reason about and safest.

Recommended token setup:

- Token name: `github-actions-pages-deploy` (any name is fine)
- Permissions:
  - **Account → Cloudflare Pages → Edit**
- Account resources:
  - Include your target account (the one with ID `229bd56236fe031df1f21d8fe079e730`)

Then store that token value in GitHub secret `CLOUDFLARE_API_TOKEN`.

workflow_dispatchFor your listed pre-configured token templates (`Edit zone DNS`, `Read billing info`, `Edit Cloudflare Workers`, etc.), none is a good direct fit for Pages deploy. If you want the easiest path with fewer permission surprises, create the custom token above.

### Minimum token permissions required (for your current workflow)

Your deploy workflow only runs:

- `wrangler pages deploy dist --project-name=wishlist-app`

So the token should be limited to:

- **Account → Cloudflare Pages → Edit**
- Account scope: only your account (`229bd56236fe031df1f21d8fe079e730`)

You do **not** need extra permissions like Workers KV, R2, D1, DNS, SSL, Workers Routes, AI, etc. for this Pages static deploy step.

If your current token has many unrelated permissions (as in your screenshots), easiest safe fix is:

1. Create a new token with only the permission above.
2. Replace GitHub `CLOUDFLARE_API_TOKEN` with the new value.
3. Re-run Deploy workflow.

### Is backend API base URL `https://wishlist-app-x25n.onrender.com/api`?

Yes, if your backend is available at that host and serves API routes under `/api`.
That is the expected format for `VITE_API_BASE_URL`.

### Why deployment failed with `Authentication error [code: 10000]`?

This usually means token/permission mismatch. Common causes:

1. `CLOUDFLARE_API_TOKEN` is missing/expired/rotated.
2. Token does not have Pages deploy permissions for the account.
3. Token belongs to a different Cloudflare account than `CLOUDFLARE_ACCOUNT_ID`.
4. Wrong `CLOUDFLARE_ACCOUNT_ID` or `CLOUDFLARE_PROJECT_NAME`.

Recommended fix checklist:

1. Create a fresh token in Cloudflare and copy its value immediately.
2. Set GitHub secrets:
  - `CLOUDFLARE_API_TOKEN=<new token value>`
  - `CLOUDFLARE_ACCOUNT_ID=229bd56236fe031df1f21d8fe079e730`
  - `CLOUDFLARE_PROJECT_NAME=wishlist-app`
3. Re-run GitHub Actions `Deploy` workflow with `workflow_dispatch`.
4. Confirm the deploy step uses `wrangler pages deploy dist --project-name=wishlist-app`.

> Note: If Cloudflare Pages is already connected directly to GitHub (native Pages build/deploy), you may choose that route instead of Wrangler-based deploys from GitHub Actions. Do not mix both unless intentionally configured.

## 7) GitHub: secrets vs variables, and which scope to use

For this repository’s deploy workflow:

- Put sensitive values in **Secrets**, not Variables:
  - `RENDER_DEPLOY_HOOK_URL`
  - `CLOUDFLARE_API_TOKEN`
  - `CLOUDFLARE_ACCOUNT_ID`
  - `CLOUDFLARE_PROJECT_NAME`
  - `VITE_API_BASE_URL`

Why secrets? They are masked in logs and designed for credentials/config you do not want exposed.

### Repository secrets vs Environment secrets

- **Repository secrets** (recommended default here):
  - Easiest setup.
  - Works immediately with current `deploy.yml` because it references `secrets.`* directly at repo level.
- **Environment secrets** (optional hardening):
  - Use when you want deployment protection rules (required reviewers, branch restrictions, wait timers).
  - If you switch to environment secrets, attach jobs to an environment in workflow YAML (for example `environment: production`) and store the same secret names in that environment.

### Practical recommendation

Start with **Repository secrets** to get deploy working quickly.
Move to **Environment secrets** later if you want stricter production controls.