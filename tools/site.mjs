// Finishes a build for hosting. Run after `vite build`.
//   node tools/site.mjs           the Cloudflare copy at ipynb.ashwingopalsamy.in (writes dist/_headers)
//   node tools/site.mjs --mirror  the GitHub Pages copy (noindex; Pages cannot set headers, so no headers file)
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const mirror = process.argv.includes('--mirror');
const ORIGIN = 'https://ipynb.ashwingopalsamy.in';
const dist = new URL('../dist/', import.meta.url);

const file = new URL('index.html', dist);
let html = readFileSync(file, 'utf8');
if (!html.includes('</head>')) throw new Error('dist/index.html has no </head>; run vite build first');

// The page keeps one inline script (the theme, so there is no flash). The policy allows it by hash, nothing else inline.
const hashes = [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(
  (m) => `'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`,
);

const head = [`<link rel="canonical" href="${ORIGIN}/" />`, mirror && '<meta name="robots" content="noindex" />'].filter(Boolean);
html = html.replace('</head>', `    ${head.join('\n    ')}\n  </head>`);
writeFileSync(file, html);

const home = mirror ? '/ipynb-viewer/' : '/';
writeFileSync(
  new URL('404.html', dist),
  `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="robots" content="noindex">
<title>Not found</title>
<style>
body{margin:0;min-height:100vh;display:grid;place-content:center;gap:.5rem;text-align:center;font:16px/1.5 system-ui,sans-serif;background:#fff;color:#1d1d1f}
@media(prefers-color-scheme:dark){body{background:#0a0a0c;color:#f5f5f7}}
p{margin:0;opacity:.6}a{color:inherit}
</style>
</head>
<body>
<h1 style="font-size:1.25rem;font-weight:600;margin:0">Nothing here</h1>
<p><a href="${home}">Back to the viewer</a></p>
</body>
</html>
`,
);

if (mirror) {
  console.log('dist ready for GitHub Pages');
  process.exit(0);
}

// The app puts a stricter policy on itself once it shows notebook markup (src/lib/guard.ts). A policy can only be
// tightened, so this one has to allow what the first screen needs: https for `?url=` downloads, the sandbox frame.
const csp = [
  "default-src 'none'",
  `script-src 'self' ${hashes.join(' ')}`.trim(),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https:",
  "frame-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

// Rules that match one path add up, and a header set twice is joined with a comma, so each header lives in one rule.
writeFileSync(
  new URL('_headers', dist),
  `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()
  Cross-Origin-Opener-Policy: same-origin
  Strict-Transport-Security: max-age=31536000

/
  Content-Security-Policy: ${csp}

/index.html
  Content-Security-Policy: ${csp}

# The page interactive outputs run in. The app frames it with sandbox="allow-scripts"; this makes the page sandboxed
# even when something opens it directly, and keeps other sites from framing it.
/box.html
  Content-Security-Policy: sandbox allow-scripts; frame-ancestors 'self'

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/fonts/*
  Cache-Control: public, max-age=604800
`,
);
console.log(`dist ready for Cloudflare (${hashes.length} inline script hashed)`);
