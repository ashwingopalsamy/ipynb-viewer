# Hosting

The viewer is a static site (`dist/`) with no server code. Notebooks are read on the visitor's device and are never uploaded.

- **ipynb.ashwingopalsamy.in** is the main site: a Cloudflare Worker that serves `dist/` as static assets, with the hostname attached as a custom domain. It is deployed by `.github/workflows/deploy.yml` on every push to `main`, or by hand with `npm run deploy`.
- **ashwingopalsamy.github.io/ipynb-viewer/** is a mirror published by `.github/workflows/pages.yml` on every push to `main`. It is marked `noindex` and its canonical link points at the main site.

## Deploy

CI needs two repository secrets: `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. For a manual deploy:

```sh
wrangler login        # once
npm run deploy        # build, add headers and the 404 page, publish
```

`npm run deploy:dry` builds and checks the upload without publishing. `npm run build:pages` builds the mirror copy locally.

`tools/site.mjs` finishes each build: it adds the canonical link, writes `404.html`, and for the Cloudflare copy writes `dist/_headers`.

## Headers

Cloudflare applies `dist/_headers` to every response. Pages cannot set headers, so the mirror has none.

- The page policy allows scripts from the site itself plus the hash of the theme script, and nothing else: no network requests, frames or plugins. Inline styles are allowed for the components and KaTeX.
- `Referrer-Policy: no-referrer`, `nosniff`, HSTS and a locked-down `Permissions-Policy` apply everywhere.
- Hashed files under `/assets/` are cached for a year; fonts for a week.

## Routing

The app has one page. Unknown paths get the 404 page, not the app.
