# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A 3D interactive globe (React + `react-globe.gl`/Three.js) for exploring countries, post-1945 history, and
leadership records, deployed as a static SPA on Cloudflare Pages. Every fact is sourced (World Bank, Wikidata,
Natural Earth) and nothing is fabricated — see `docs/DATA_SOURCES.md` for what's covered and its known gaps,


## Commands

```bash
npm run dev                   # Vite dev server, http://localhost:5173 — /api/* routes 404 here
npm run build                 # tsc -b + production build to dist/
npm run lint                  # oxlint
npm run typecheck:pipeline    # type-check data-pipeline/
npm run typecheck:functions   # type-check functions/ (Cloudflare Pages Functions)
npm run data:build            # regenerate public/data/* from World Bank + Wikidata + Natural Earth
npm run data:build:fresh      # same, bypassing any local fetch cache (DATA_FRESH=1)
npm run data:politics         # regenerate only public/data/politics/* (the leadership record — goes stale fastest)
```

There is no test suite in this repo. `npm run build` (which runs `tsc -b` project-references across
app/node/pipeline/functions configs) is the main correctness check; run `npm run lint` too before calling
something done.

To exercise the news proxy locally (Pages Functions + KV, not served by plain `vite dev`):

```bash
cp .dev.vars.example .dev.vars   # fill in a real GNEWS_API_KEY
npm run build
npx wrangler pages dev dist --kv NEWS_CACHE
```

## Architecture

**Static data, one live endpoint.** Country statistics, geometry, curated events, relationships, and the
leadership record are all generated at *build time* by `data-pipeline/` (Node/TypeScript, run via `tsx`,
never shipped to the browser) into versioned JSON under `public/data/`. The deployed app never calls World
Bank/Wikidata/Natural Earth at request time — it just fetches static JSON from Cloudflare's CDN via
`src/lib/api.ts`. The single exception is `functions/api/news/` (Cloudflare Pages Functions), which proxies
GNews because that requires a server-side secret and can't be pre-baked. Its cache/budget logic
(`functions/api/news/_shared.ts`) enforces a hard daily request cap against GNews's free-tier limit, with a
KV cache (`NEWS_CACHE`) serving stale data rather than failing when the budget is exhausted.

**Data pipeline write order matters.** `npm run data:build` runs `build-countries.ts` → `build-curated.ts` →
`build-politics.ts` in sequence: `build-curated.ts` validates that every country id referenced by curated
events/relationships exists in the country index that `build-countries.ts` just wrote, and throws at build
time on a stale/typo'd id or an event dated before `EVENTS_START_YEAR`. Curated (hand-authored, not fetched)
content lives in `data-pipeline/curated/` — events, relationships, recognition status overrides, and
special-territory handling (Taiwan, Kosovo, Western Sahara, Somaliland, etc. — see "Disputed / contested
territories" in `docs/DATA_SOURCES.md`).

**The domain model (`src/types/domain.ts`) is deliberately shaped like database rows** — every statistic is
`SourcedValue<T>` (`{ value, source, retrievedAt }`), so a future move from static JSON to a real database
(Cloudflare D1) would be a straight import, not a redesign. When adding a new country field or dataset,
follow this shape (carry a `Source`) rather than a bare value.

**The atlas starts at 1945 by design, and this constant is duplicated in three places that must stay in
sync**: `EVENTS_START_YEAR` in `data-pipeline/curated/events.ts` (enforced at build time), `POLITICS_SINCE_YEAR`
filtering the leadership record, and `ATLAS_START_YEAR` in `src/state/timeStore.ts` (the timeline axis). If
this ever changes, update all three.

**Frontend structure**: `src/components/` is one directory per feature area (Globe, CountryCard, Timeline,
Search, Compare, News, Sources), each with its own co-located `.css`. `src/state/` holds small Zustand stores
split by concern — `selectionStore` (which country is selected), `timeStore` (present vs. historical mode,
selected date/event), `layersStore`, `globeStore` (surface texture + brightness, persisted to
`localStorage`). `Globe` is lazy-loaded (`src/App.tsx`) since `react-globe.gl`/Three.js dominate the bundle
(~600KB gzipped) — don't change that to an eager import without a reason. `src/lib/api.ts` is the only place
that calls `fetch` against `/data/*.json` or `/api/*`; per-country profile and political-history fetches are
memoized in module-level `Map` caches (not React state), and a missing `/data/politics/{id}.json` (country
has no Wikidata leadership coverage) is treated as a normal `null` result, not an error.

**TypeScript project references**: four separate `tsconfig.*.json` files (`app`, `node`, `pipeline`,
`functions`) so the browser app, Vite config, the data pipeline, and Cloudflare Functions type-check against
different `lib`/`types` (e.g. pipeline code uses Node types and has no DOM lib; functions code uses
`@cloudflare/workers-types`). `npm run build` only type-checks `app`+`node`; run `typecheck:pipeline` /
`typecheck:functions` explicitly when touching those trees.

**Strict CSP.** `public/_headers` sets `default-src 'self'` with no third-party script/style/connect/font
origins at all. Adding any external resource (a CDN script, a web font, a new fetch target) requires updating
that file too, or it will be silently blocked in production while working fine under `vite dev`.

## Working with sourced data

This is a sourced-facts product — if you add or change a displayed statistic, event, or biographical fact, it
needs a `Source`/`sources` entry, and if you're not confident it's accurate, don't fabricate one. When
touching curated content in `data-pipeline/curated/`, check `docs/DATA_SOURCES.md` first for existing
known-limitations/methodology notes on that area (disputed territories, party attribution, election
coverage) so you don't relitigate a documented tradeoff.
