# SSS HR System — frontend

The React app of SSS HR System (Vite, TypeScript, Tailwind, TanStack Query, i18next). Arabic first, right to left, with
English. The API, the documents and the deployment guide are in the backend repository; check both out side by side
(`…/backend`, `…/frontend`).

## Development

```bash
npm ci
npm run dev          # http://cactus.localhost:5173 — /api goes to the backend on :8000 (VITE_API_PROXY to change it)
npm run build        # convention check (no hard-coded text, logical CSS), TypeScript, Vite build into dist/
npm test             # Vitest
npm run test:e2e     # Playwright, against a running backend with seed_demo (starts the mock device servers from ../backend/tools)
```

- Every string goes through i18n (`src/i18n/ar.json`, `en.json`), and the Arabic plural forms must be filled.
- CSS uses Tailwind's logical utilities only (`ms-`, `pe-`, `start-`…).
- The colours are design tokens in `src/index.css`. The logo is `public/logo.svg`, made by `scripts/make_logo.py`.
  `docs/brand/` and `docs/design/` hold the brand assets and the design references.

## Production

The `Dockerfile` builds the app and serves `dist/` from its own container. `docker-compose.yml` runs that container on
127.0.0.1:8080. The server's nginx (installed with apt) sits in front: `deploy/nginx.conf` is its site. It handles HTTPS,
sends `/api`, `/admin` and `/support` to the backend container, serves Django's static files and public uploads, and
sends everything else to this container. `deploy/update.sh` pulls and rebuilds. The full guide is the backend
repository's `docs/deploy.md`.
