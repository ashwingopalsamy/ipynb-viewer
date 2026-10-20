// Finishes a build for hosting. Run after `vite build`.
//   node tools/site.mjs           the Cloudflare copy at ipynb.ashwingopalsamy.in (writes dist/_headers)
//   node tools/site.mjs --mirror  the GitHub Pages copy (noindex; Pages cannot set headers, so no headers file)
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

const mirror = process.argv.includes('--mirror');
const ORIGIN = 'https://ipynb.ashwingopalsamy.in';
const dist = new URL('../dist/', import.meta.url);

// Each page keeps one inline script (the theme, so there is no flash); the policy allows it by hash, nothing else inline. The same
// script is on every page, so it is one hash. JSON-LD is a data block that is never run, so it is left out.
const SKIP = new Set(['404.html', 'box.html']);
const pages = readdirSync(dist, { recursive: true })
  .map((f) => String(f).split('\\').join('/'))
  .filter((f) => f.endsWith('.html') && !SKIP.has(f))
  .sort();
if (!pages.includes('index.html')) throw new Error('dist/index.html is missing; run vite build first');
const hashes = new Set();
const paths = [];
for (const name of pages) {
  const file = new URL(name, dist);
  const html = readFileSync(file, 'utf8');
  if (!html.includes('</head>')) throw new Error(`dist/${name} has no </head>; run vite build first`);
  for (const m of html.matchAll(/<script(?![^>]*\s(?:src|type)=)[^>]*>([\s\S]*?)<\/script>/g)) hashes.add(`'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`);
  const path = `/${name.replace(/index\.html$/, '')}`;
  paths.push(path);
  const url = `${ORIGIN}${path}`;
  const head = [
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${ORIGIN}/social-preview.png" />`,
    '<meta property="og:image:width" content="1280" />',
    '<meta property="og:image:height" content="640" />',
    '<meta property="og:image:alt" content="ipynb viewer: Jupyter notebooks, without Jupyter" />',
    mirror && '<meta name="robots" content="noindex" />',
    // the Chrome origin trial for WebMCP, when a token for the main site is given
    !mirror && path === '/' && process.env.ORIGIN_TRIAL_TOKEN && `<meta http-equiv="origin-trial" content="${process.env.ORIGIN_TRIAL_TOKEN}" />`,
  ].filter(Boolean);
  writeFileSync(file, html.replace('</head>', `    ${head.join('\n    ')}\n  </head>`));
}

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
<p><a href="${home}">Back to ipynb viewer</a></p>
</body>
</html>
`,
);

if (mirror) {
  console.log('dist ready for GitHub Pages');
  process.exit(0);
}

// The viewer reads notebooks from the visitor's own device and never frames or runs anything. Its only requests go to the site itself
// (the /link/ relay for GitHub files), so the policy allows only the site itself. Inline styles stay allowed for the components and KaTeX.
const csp = [
  "default-src 'none'",
  `script-src 'self' ${[...hashes].join(' ')}`.trim(),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

// The guide pages get the same policy and their own Markdown copy.
const guides = paths
  .filter((p) => p !== '/')
  .map((p) => `\n${p}\n  Content-Security-Policy: ${csp}\n  Link: <index.md>; rel="alternate"; type="text/markdown"\n\n${p}index.html\n  Content-Security-Policy: ${csp}\n  Link: <index.md>; rel="alternate"; type="text/markdown"\n`)
  .join('');

// Rules that match one path add up, and a header set twice is joined with a comma, so each header lives in one rule.
writeFileSync(
  new URL('_headers', dist),
  `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()
  Cross-Origin-Opener-Policy: same-origin
  Strict-Transport-Security: max-age=31536000
  X-DNS-Prefetch-Control: off

/
  Content-Security-Policy: ${csp}
  Link: <index.md>; rel="alternate"; type="text/markdown"

/index.html
  Content-Security-Policy: ${csp}
  Link: <index.md>; rel="alternate"; type="text/markdown"
${guides}
/assets/*
  Cache-Control: public, max-age=31536000, immutable

/fonts/*
  Cache-Control: public, max-age=604800
`,
);
// Search and answer engines and assistants fetching a page for a person are welcome, and so are crawlers that train models: the pages are
// public documentation. The relay is not for crawlers; its own checks are what actually protect it.
writeFileSync(
  new URL('robots.txt', dist),
  `# Notebooks are read in the visitor's browser and never stored here; these pages are public documentation.
User-agent: *
Allow: /
Disallow: /link/
Content-Signal: search=yes, ai-input=yes, ai-train=yes

Sitemap: ${ORIGIN}/sitemap.xml
`,
);
writeFileSync(
  new URL('sitemap.xml', dist),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths.map((p) => `  <url><loc>${ORIGIN}${p}</loc></url>`).join('\n')}
</urlset>
`,
);
// The viewer used to be its own page; links already shared keep working.
writeFileSync(new URL('_redirects', dist), '/viewer / 301\n/viewer/* / 301\n');
console.log(`dist ready for Cloudflare (${hashes.size} inline script hashed)`);
