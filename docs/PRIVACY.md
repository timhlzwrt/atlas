# Privacy

## What this app does not do

- No user accounts, no login, no personal data collection.
- No analytics, no tracking scripts, no advertising, no third-party JavaScript of any kind.
- No cookies are set by this application.
- The browser never talks to a third-party API or data provider directly — GNews is the only external
  provider that ever handles user-triggered requests, and it's proxied through `functions/api/news/*` so the
  browser only ever talks to this app's own origin. The API key never reaches the browser.
- No fingerprinting techniques are used.

## What's outside this app's control

Cloudflare, as the hosting provider, necessarily processes standard connection metadata (IP address, request
timestamp, user agent, URL path) to serve requests and protect the edge network from abuse — this is true of
any hosting provider and isn't something an application running on top of it can opt out of. See
[Cloudflare's privacy policy](https://www.cloudflare.com/privacypolicy/) for what Cloudflare itself retains.
This project doesn't add any application-level logging, analytics, or session tracking on top of that.

## Content-Security-Policy and headers

`public/_headers` sets a strict CSP (`default-src 'self'`, no third-party script/style/connect origins other
than `'self'`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and a restrictive
`Permissions-Policy` — see that file for the exact policy.

## Data retention

- News articles are cached in Cloudflare KV for a few hours (see `docs/DATA_SOURCES.md`) purely to reduce
  calls to GNews; nothing user-specific is stored alongside them.
- No per-visitor state is stored anywhere, server- or client-side, beyond what's needed to render the current
  page (URL query params for shareable state, if/when that's added, would be the only exception, and would
  contain nothing more sensitive than a country code and a date).
