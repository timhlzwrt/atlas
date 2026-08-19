# Architecture

## Stack

- **Frontend**: Vite + React 19 + TypeScript, hand-written CSS (no UI framework), Zustand for the small amount
  of client UI state (selection, time, layers, compare). Deployed as a static SPA on Cloudflare Pages.
- **Globe**: [`react-globe.gl`](https://github.com/vasturiano/react-globe.gl) (Three.js/WebGL under the hood).
  Chosen over hand-rolled Three.js or MapLibre's globe projection because it has first-class support for
  GeoJSON polygon countries, camera fly-to, and arcs (relationship layers) with far less custom rendering code,
  while still allowing full styling control (no baked-in Earth texture — the globe is a plain dark
  `MeshPhongMaterial` with country polygons and an atmosphere shader layered on top).
- **Backend**: Cloudflare Pages Functions (`functions/`) — only where a secret or a live external call is
  actually needed, which in this app is exactly one thing: the GNews proxy (`functions/api/news/`). Everything
  else (country statistics, geometry, events, relationships) is static JSON generated at build time and served
  by Cloudflare's CDN — faster than a Function round-trip and there's no live provider call to protect at
  request time.
- **Caching**: a single KV namespace (`NEWS_CACHE`) holds cached GNews responses plus a daily request-budget
  counter that hard-caps outbound GNews calls (see `functions/api/news/_shared.ts`).
- **Data pipeline**: `data-pipeline/` — Node/TypeScript scripts run at build time (`npm run data:build`), never
  shipped to the browser. They call World Bank and Wikidata, join the results with Natural Earth geometry, and
  write versioned JSON into `public/data/`. This is the only place external statistical APIs are ever called;
  the deployed app never calls them at request time.

## Why no database

Country/event/relationship data is curated and rebuilt periodically, not continuously written to. Static,
git-versioned JSON gives free CDN caching, an audit trail (git history) for a sourced-data product, and zero
database ops. The `Statistic { metric, value, unit, source, retrievedAt }` shape used throughout is deliberately
the shape of a database row — if the dataset outgrows static files (e.g. full historical borders, all-country
deep statistics), moving to D1 (Cloudflare's SQLite) is a straight import, not a redesign.

## Request flow

```
Browser
  ├─→ Cloudflare Pages CDN  (static assets: HTML/JS/CSS, /data/*.json, geometry)
  └─→ Cloudflare Pages Function  /api/news/*
        └─→ KV cache (NEWS_CACHE)
              └─→ GNews API  (only on a cache miss, within the daily budget)
```

The browser never holds a GNews (or any provider) API key, and never calls a third-party API directly.

## Directory map

```
src/                    React app
  components/           Globe, CountryCard, Timeline, Search, Compare, News, Sources
  state/                 Zustand stores (selection, time, layers)
  lib/                    api client, geo projection types
  types/                  domain model (Country, Statistic, Event, Relationship, ...)
public/data/             generated: countries/*.json, geometry/world.json, events.json, relationships.json
functions/api/news/      the one place with a live external call + a secret
data-pipeline/           build-time ETL — never shipped to the browser
docs/                    this file, DATA_SOURCES.md, DEPLOYMENT.md, PRIVACY.md
```

## Extensibility (post-MVP)

The data model already has the shape for features not yet implemented:

- **Historical borders**: `CountryFeatureProperties`/geometry files are per-id already; adding a
  `historicalGeometries: { dateRange, geometry, source }[]` alongside modern geometry is additive.
- **Historical statistics**: `SourcedValue<T>` already carries a `date`; a historical dataset is just more
  `Statistic` rows keyed by date range instead of "latest".
- **More relationship types / disputed territories**: both are already typed and rendered generically; adding
  entries is a data change, not a code change.
