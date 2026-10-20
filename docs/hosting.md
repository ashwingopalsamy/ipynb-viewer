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

- The page policy allows scripts from the site itself plus the hash of the theme script, and `https:` for `connect-src` so `?url=` downloads work. The app narrows it further once a notebook starts opening, and consent can only tighten the policy, never widen it, so the hosted header stays as it is.
- `Referrer-Policy: no-referrer`, because `?url=` holds a link.
- `box.html` is served with `sandbox allow-scripts` and `frame-ancestors 'self'`, so interactive outputs stay in an opaque origin.

## Routing

The app has no routes: cell links are `#hash` and notebook links are `?url=`. Unknown paths get the 404 page, not the app.

## Pages and the offline worker

- `/` is the home page (the About page) and `/viewer/` is the app. `?url=` and `#nb=` links opened on `/` are forwarded to `/viewer/` by a line in the home page's inline script, before anything is requested. The installed app starts on `/viewer/`.
- The old `/about` address redirects to `/` (`_redirects` on Cloudflare, a small `about.html` on the Pages mirror).
- `sw.js` is sent with `Cache-Control: no-cache` so a new release is noticed on the next visit. Every other asset is hashed and cached for a year.
- The worker holds both pages and everything the app can ask for, a little under 1 MB gzipped. It is registered a few seconds after the first load of either page.
