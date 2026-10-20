# Hosting

The viewer is a static site (`dist/`) with no server code.

- **ipynb.ashwingopalsamy.in** is the main site: a Cloudflare Worker that serves `dist/` as static assets, with the hostname attached as a custom domain. It is deployed from a laptop, not from CI.
- **ashwingopalsamy.github.io/ipynb-viewer/** is a mirror published by `.github/workflows/pages.yml` on every push to `main`. It is marked `noindex` and its canonical link points at the main site.

## Deploy

```sh
wrangler login        # once
npm run deploy        # build, add headers and the 404 page, publish
```

`npm run deploy:dry` builds and checks the upload without publishing. `npm run build:pages` builds the mirror copy locally.

`tools/site.mjs` finishes each build: it adds the canonical link, writes `404.html`, and for the Cloudflare copy writes `dist/_headers`.

## Headers

Cloudflare applies `dist/_headers` to every response. Pages cannot set headers, so the mirror relies on the policy the app puts on itself.

- The page policy allows scripts from the site itself plus the hash of the theme script, and `https:` for `connect-src` so `?url=` downloads work. The app narrows it further once it renders notebook markup.
- `Referrer-Policy: no-referrer`, because `?url=` holds a link.
- `box.html` is served with `sandbox allow-scripts` and `frame-ancestors 'self'`, so interactive outputs stay in an opaque origin.

## Routing

The app has no routes: cell links are `#hash` and notebook links are `?url=`. Unknown paths get the 404 page, not the app.
