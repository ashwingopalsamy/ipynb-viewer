# Hosting

The viewer is a static site (`dist/`) with no server code. Notebooks are read on the visitor's device and are never uploaded.

- **ipynb.ashwingopalsamy.in** is the main site: a Cloudflare Worker that serves `dist/` as static assets, with the hostname attached as a custom domain. It is deployed from a laptop, not from CI.
- **ashwingopalsamy.github.io/ipynb-viewer/** is a mirror published by `.github/workflows/pages.yml` on every push to `main`. It is marked `noindex` and its canonical link points at the main site.

## Deploy

```sh
wrangler login        # once
npm run deploy        # build, add headers and the 404 page, publish
```

`npm run deploy:dry` builds and checks the upload without publishing. `npm run build:pages` builds the mirror copy locally.

`tools/site.mjs` finishes each build: it adds the canonical link and social tags to every page, writes `404.html`, and for the Cloudflare copy writes `dist/_headers`, `_redirects` (the old `/viewer/` address), `robots.txt` and `sitemap.xml`. The guide pages, their Markdown copies and `llms.txt` are written from `site/*.md` by the `pages` plugin in `vite.config.ts`. Set `ORIGIN_TRIAL_TOKEN` when deploying to add a Chrome origin-trial tag for the WebMCP tools.

## Headers

Cloudflare applies `dist/_headers` to every response. Pages cannot set headers, so the mirror has none.

- The page policy allows scripts from the site itself plus the hash of the theme script, and nothing else: requests only to the site itself, and no frames or plugins. Inline styles are allowed for the components and KaTeX.
- `Referrer-Policy: no-referrer`, `nosniff`, HSTS and a locked-down `Permissions-Policy` apply everywhere.
- Hashed files under `/assets/` are cached for a year; fonts for a week.
- `/link/*` is served by `tools/worker.js`, which relays public files from raw.githubusercontent.com, gist.githubusercontent.com and api.github.com/gists. That is why the page keeps `connect-src 'self'`. Other hosts are not opened on this copy; the mirror fetches directly.
- Gist links without a user name need GitHub's listing API, which allows 60 requests an hour per IP and Cloudflare's addresses are shared. If those start failing with 403, set a token with no scopes: `npx wrangler secret put GITHUB_TOKEN`. The Worker sends it only to api.github.com.

## Abuse limits and analytics

- `/link/*` is limited per IP by the `LINKS` rate-limit binding in `wrangler.jsonc` (60 a minute). Add a Cloudflare WAF rate-limiting rule on `/link/*` as well so abuse is stopped before the Worker runs. Turn on Bot Fight Mode, Always Use HTTPS and a TLS 1.2 minimum; leave Logpush and request logs off.
- Traffic, countries and cache ratios come from Cloudflare's zone analytics, which need no script. Do not turn on Web Analytics auto-injection: it adds a script the page policy forbids.
- The Worker writes one row per `/link/*` request to the `ipynb_viewer` Analytics Engine dataset: outcome, which of the three GitHub hosts, country, status, bytes and milliseconds. It never records the path, repo, IP or headers. Query it with the Analytics Engine SQL API, for example `SELECT blob1 AS outcome, count() FROM ipynb_viewer GROUP BY outcome`.

## Routing

The app has one page. Unknown paths get the 404 page, not the app.
