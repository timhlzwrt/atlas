# Data Sources & Methodology

This mirrors the in-app Sources panel (`src/components/Sources/SourcesPanel.tsx`) with more detail for
maintainers.

## Sources used

| Source | What it provides | Access | Coverage |
|---|---|---|---|
| [World Bank Open Data](https://data.worldbank.org/) | Population, GDP, GDP per capita, GDP growth, GDP (PPP), inflation, unemployment, military expenditure, life expectancy, literacy | REST API, no key, `mrnev=1` gets the latest available figure per country in one call | Most UN member states; sparse for a few small/non-UN entities (e.g. Taiwan is not tracked separately) |
| [Wikidata](https://www.wikidata.org/) | Capital, government type, head of state/government, independence/founding date, official languages, currency, continent, land borders | SPARQL (`query.wikidata.org/sparql`), no key | Broad but uneven — see limitations below |
| [Natural Earth](https://www.naturalearthdata.com/) (via [`world-atlas`](https://github.com/topojson/world-atlas)) | Country boundary geometry | npm package, public domain | 1:50m resolution, 241 features; used as-is rather than 1:10m to keep the payload small (~1.4MB gzipped vs. ~7MB) |
| [GNews](https://gnews.io/) | News headlines | REST API, requires a key (server-side only) | Free tier: 100 req/day, non-commercial use only, 12h delay, 30-day history |
| Wikipedia | Sourcing for the curated historical-events timeline | Manual curation, linked per event | N/A — this is a tertiary source used deliberately for v1; see limitations |

## Why not the sources considered and rejected

- **REST Countries API**: the v3.1 API this project initially targeted was deprecated mid-build in favor of a
  v5 that requires a paid API key, which would have added a third provider credential for data Wikidata already
  covers (capital, languages, currency, borders). Dropped in favor of Wikidata to keep the provider count low
  and free.
- **CIA World Factbook**: no official API; would require scraping, which is fragile and harder to attribute
  per-field. Not used in v1.
- **IMF / UN data portals**: overlap heavily with World Bank for the metrics this app shows; not worth a third
  provider for v1. Worth revisiting for metrics World Bank doesn't cover (e.g. UN Human Development Index).

## Known limitations

- **Wikidata coverage is uneven.** Government type / head of state / head of government are only shown when
  present; ~157 of 204 countries and territories have all three plus a World Bank GDP figure, and are flagged
  `hasDeepData: true`. The rest show core fields (population, area, capital) with an explicit
  "Data unavailable" for the rest, never a guess.
- **Wikidata is collaboratively edited** and can lag real-world political changes (an election, a new head of
  state). Every field links back to the underlying Wikidata item so this is checkable, but treat volatile
  political fields as "as of last data pull," not real-time.
- **The historical-events timeline cites Wikipedia**, a tertiary source, not primary historical scholarship.
  This is a deliberate, disclosed v1 tradeoff — see the in-app Sources panel.
- **No historical borders or historical statistics in v1.** Selecting a past event does not change country
  shapes or figures; the data model supports adding this later (see `docs/ARCHITECTURE.md`), but nothing is
  faked in the meantime.
- **Geometry resolution (1:50m)** drops one UN member state entirely: Tuvalu (population ~11,000), which
  Natural Earth's 50m dataset doesn't include as a separate polygon. A documented gap, not a bug.
- **GNews free tier is aggressively rate-limited** (100 req/day). See `functions/api/news/_shared.ts` for the
  caching/budget strategy that keeps the app within that limit under real traffic.

## Disputed / contested territories

`RecognitionStatus` distinguishes: `un-member`, `un-observer`, `partially-recognized`, `disputed`, `de-facto`.
Handled explicitly, not merged into a neighboring country:

- **Taiwan** — `partially-recognized` (de facto independent; recognized by a minority of UN member states)
- **Kosovo** — `partially-recognized` (recognized by ~100 UN member states, not a UN member itself)
- **Palestine** — `un-observer` (UN General Assembly observer state)
- **Western Sahara** — `disputed` (mostly Moroccan-administered; claimed by the Sahrawi Arab Democratic
  Republic); hand-curated, since it falls outside the automated Wikidata sovereign-state query
- **Somaliland** — `de-facto` (self-declared independent from Somalia since 1991, not internationally
  recognized); hand-curated, no statistics shown since no indexed source tracks it separately from Somalia
- **Crimea, Golan Heights, Kashmir** — not modeled as separate map polygons in v1 (Natural Earth's default
  admin-0 boundaries at this resolution don't split them out); acknowledged here as a known gap rather than
  silently presented as undisputed.

This is a simplification of genuinely contested political realities, not a statement of political position —
see the in-app Sources panel for the same framing.

## Update cadence

- Country statistics/geometry: rebuilt by re-running `npm run data:build`; not automated on a schedule in v1
  (a scheduled Cloudflare Worker Cron Trigger re-running the pipeline and opening a PR is a natural next step).
- Global news: cached ≤2h.
- Per-country news: cached ≤6h, fetched on first request per country rather than pre-fetched for all 204.
