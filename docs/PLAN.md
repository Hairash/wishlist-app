# Wishlist App Implementation Plan

This document captures the agreed implementation roadmap and technical decisions for delivering the wishlist app MVP and then production readiness.

## Agreed Technical Decisions

- **Frontend**: React (Vite).
- **Backend**: Django + Django REST Framework.
- **Content format for wishlist items**: Markdown (supports long descriptions, links, images and basic formatting).
- **Admin authentication**: Single admin password (environment variable based), no full multi-user admin system.
- **Admin redirect behavior**: If admin session/cookies are present and admin opens the public URL, always redirect to `/admin` view.
- **Anti-spam**: Basic anti-spam protections only for now; **no CAPTCHA**.
- **Hosting preference**:
  - Backend: Render (already preferred and account exists).
  - Frontend: choose a truly free static host with easy setup (Cloudflare Pages is a strong default).
- **Deployment timing**: Deploy as soon as MVP is ready; custom domain can be configured later.

---

## Delivery Plan (Step-by-step)

## Step 1 — Bootstrap repository, quality tooling, and CI (completed)

### Scope
- Scaffold Django backend and React frontend projects.
- Add linting and formatting tools.
- Add unit test setup for both backend and frontend.
- Add CI workflow to run checks automatically.
- Add initial project docs.

### Deliverables
- `backend/` with Django + DRF base setup and a health endpoint.
- `frontend/` with React + Vite base app.
- Linter/formatter/test config for both stacks.
- GitHub Actions CI workflow for lint and test.

### Validation
- Run linters and tests locally.
- CI should run on PRs and `main` pushes.

---

## Step 2 — Backend domain model and public/admin APIs

### Scope
Implement core backend entities and endpoints.

### Data model
- `WishlistItem`
  - title
  - markdown_description (long content supported)
  - optional image URL(s)
  - optional external links
  - ordering / timestamps
- `Reservation`
  - item relation
  - reserver name (optional)
  - reserved timestamp
- `Comment`
  - item relation
  - author name (optional)
  - comment text
  - created timestamp

### API endpoints
- Public endpoints:
  - List wishlist items
  - Reserve item (with optional name)
  - List comments per item
  - Create comment (anonymous or named)
- Admin endpoints (password/session protected):
  - Create item
  - Update item
  - Delete item
  - List/manage items

### Important behavior
- Reservation state is visible to all visitors.
- Public view shows reservation and comments.
- Admin view intentionally does **not** show reservation/comments data.

### Validation
- Backend tests for:
  - CRUD item endpoints
  - reservation workflow
  - comments workflow
  - admin auth/permission boundaries

---

## Step 3 — Public frontend (visitor experience)

### Scope
Create the public website UX.

### Features
- Public list of gift ideas accessible without login.
- Render markdown content safely (with long text support).
- Display optional links and images.
- Reserve button near each item:
  - optional name field
  - status updates to “Reserved by {name}” (or anonymous reserved).
- Item comments section:
  - list comments
  - submit anonymous or named comments.

### Validation
- Frontend tests for:
  - item rendering
  - reserve flow
  - comments flow
  - API error handling states

---

## Step 4 — Admin frontend and session behavior

### Scope
Build separate admin path/UI and enforce admin-specific UX rules.

### Features
- Admin login page (password based).
- Admin session persistence via secure cookie/session token.
- Admin item management UI (create/edit/delete).
- Hide reservation/comment data from admin screens.
- If admin session exists and admin opens public page, auto-redirect to `/admin`.

### Validation
- Tests for:
  - protected admin routes
  - login/logout behavior
  - automatic redirect logic

---

## Step 5 — Security, validation, and robustness

### Scope
Add baseline hardening for MVP production use.

### Features
- Input validation/sanitization for markdown and links.
- Basic anti-spam/rate limits on reserve/comment endpoints.
- CSRF/session/cookie security configuration for production.
- Consistent error response format.

### Validation
- Tests for invalid payloads, malicious content patterns, and throttling behavior.

---

## Step 6 — Deployment and CI/CD

### Scope
Deploy MVP and automate build/test/deploy workflows.

### Target setup
- Backend API on Render.
- Frontend static app on a free host (Cloudflare Pages preferred by cost criteria).
- Data store configured per backend implementation choice for MVP.

### CI/CD
- PR checks: lint + tests.
- Main branch: deploy pipeline (once secrets are configured).

### Manual actions required from owner
- Configure hosting projects/accounts.
- Add required environment secrets in GitHub and hosting platforms.
- Set production admin password secret.

---

## Step 7 — Documentation, handover, and operations

### Scope
Finalize docs for maintenance and future iteration.

### Deliverables
- Setup and deployment guide.
- Environment variable reference.
- Feature requirement traceability checklist.
- Basic runbook for operations and password rotation.

---

## Requirement-to-implementation checklist (target state)

- Public access for anyone.
- Rich item content (markdown with links/images/long text).
- Reservation with optional name; visible reservation state for all visitors.
- Anonymous or named comments per item.
- Password-protected admin area.
- Admin can create/update/delete items.
- Admin does not see reservation/comments.
- Admin auto-redirect to `/admin` when admin cookies exist.
