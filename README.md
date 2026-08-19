# Geopolitical Atlas

An interactive 3D globe for exploring countries, their statistics, and history — every fact sourced, nothing
fabricated. Placeholder branding; see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for why this stack, and
[`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md) for what's real vs. known-limited.

## Quick start

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`. The `/api/news/*` endpoints won't work under plain `vite dev` (they're
Cloudflare Pages Functions) — see [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for running those locally too.

## Regenerating the dataset

Country statistics, geometry, and identity data are generated from World Bank + Wikidata + Natural Earth at
build time, not fetched live in the deployed app:

```bash
npm run data:build
```

See [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md) for what each source provides and its limitations.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check + production build (`dist/`) |
| `npm run data:build` | Rebuild `public/data/*` from World Bank + Wikidata + Natural Earth |
| `npm run typecheck:pipeline` | Type-check `data-pipeline/` |
| `npm run typecheck:functions` | Type-check `functions/` (Cloudflare Pages Functions) |
| `npm run lint` | Oxlint |

## Docs

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — stack, request flow, why no database
- [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md) — sources, methodology, disputed territories, known limitations
- [`docs/PRIVACY.md`](docs/PRIVACY.md) — what is and isn't collected
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — Cloudflare Pages setup, secrets, free-tier fit
