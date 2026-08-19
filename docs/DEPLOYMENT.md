# Deployment

Target: Cloudflare Pages (static frontend + Pages Functions for the news proxy), free tier.

## Prerequisites

- A Cloudflare account.
- A GNews API key (free tier: https://gnews.io — non-commercial use only, 100 req/day).
- `wrangler` (already a dev dependency; `npx wrangler` works without a global install).

## One-time setup

1. **Build the dataset** (only needed when re-pulling from World Bank/Wikidata; the repo already ships a
   built `public/data/`):
   ```bash
   npm run data:build
   ```

2. **Create the KV namespace** used for news caching:
   ```bash
   npx wrangler kv namespace create NEWS_CACHE
   ```
   Copy the returned `id` into `wrangler.toml`'s `[[kv_namespaces]]` block (replacing
   `REPLACE_WITH_KV_NAMESPACE_ID`).

3. **Create the Pages project** (first deploy also creates it if it doesn't exist):
   ```bash
   npm run build
   npx wrangler pages deploy dist --project-name=geopolitical-atlas
   ```

4. **Set the GNews secret** (server-side only, never in a `vars` block or committed file):
   ```bash
   npx wrangler pages secret put GNEWS_API_KEY --project-name=geopolitical-atlas
   ```

5. **Bind the KV namespace to the Pages project** — either via `wrangler.toml` (already checked in, once the
   namespace id from step 2 is filled in) or via the Cloudflare dashboard: Pages project → Settings →
   Functions → KV namespace bindings → add `NEWS_CACHE`.

## Subsequent deploys

```bash
npm run build
npx wrangler pages deploy dist --project-name=geopolitical-atlas
```

Or connect the Cloudflare Pages project to the GitHub repo in the dashboard for automatic deploys on push —
Cloudflare will run `npm run build` and publish `dist/` (and `functions/`) on every push, no extra CI needed.

## Local development

```bash
npm run dev              # frontend only, http://localhost:5173 — /api/* calls will 404
```

To test the Functions locally (news proxy, KV) too:

```bash
cp .dev.vars.example .dev.vars   # fill in a real GNEWS_API_KEY
npm run build
npx wrangler pages dev dist --kv NEWS_CACHE
```

## Environment variables / secrets summary

| Name | Where | Purpose |
|---|---|---|
| `GNEWS_API_KEY` | Pages secret (`wrangler pages secret put`) | Server-side GNews auth; never exposed to the browser |
| `NEWS_CACHE` | KV namespace binding | News response cache + daily request-budget counter |

No other secrets exist. World Bank, Wikidata, and Natural Earth are all called at **build time** by
`data-pipeline/`, not at request time, so they need no runtime credentials at all.

## Free-tier fit

- **Pages**: static hosting + Functions, 500 builds/month free — this project deploys on-demand, well within
  that.
- **Workers/Pages Functions**: 100,000 requests/day free — the news proxy is the only Function, and it's
  KV-cached, so actual GNews-hitting requests are a small fraction of that.
- **KV**: 100,000 reads + 1,000 writes/day free, 1GB storage — the news cache uses a handful of keys, nowhere
  close to the limit.
- No database, no always-on server, no paid tier required.
