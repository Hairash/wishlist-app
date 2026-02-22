# Architecture (Step 1 Bootstrap)

## Layout
- `backend/`: Django + DRF API service.
- `frontend/`: React application (Vite).
- `.github/workflows/ci.yml`: lint/test checks for both stacks.

## Next steps
- Add domain models (`WishlistItem`, `Reservation`, `Comment`).
- Add public and admin API endpoints.
- Build public and admin UIs.
