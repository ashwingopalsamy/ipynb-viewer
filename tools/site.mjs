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

const font = `${home}fonts/inter.woff2`;
writeFileSync(
  new URL('404.html', dist),
  `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="robots" content="noindex">
<title>404, page not found | ipynb viewer</title>
<link rel="icon" href="${home}favicon.svg">
<style>
@font-face{font-family:Inter;font-weight:100 900;font-display:swap;src:url(${font}) format("woff2")}
:root{--page:#f5f5f7;--paper:#fff;--well:#e6e8ef;--fg:#1d1d1f;--fg-2:#48484a;--fg-3:#636368;--line:rgba(0,0,0,.09);--warn:#b45309;--sans:Inter,-apple-system,system-ui,sans-serif;--mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace}
@media(prefers-color-scheme:dark){:root{--page:#0a0a0c;--paper:#1a1a21;--well:#272833;--fg:#f5f5f7;--fg-2:#cfcfd4;--fg-3:#9a9aa1;--line:rgba(255,255,255,.1);--warn:#f5b35a}}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:32px 20px;background:var(--page);color:var(--fg);font:16px/1.55 var(--sans);-webkit-font-smoothing:antialiased}
main{width:min(100%,460px);text-align:center}
.who{width:84px;height:101px;margin:0 auto 22px;display:block;filter:drop-shadow(0 14px 18px rgba(20,24,40,.18));animation:bob 4s ease-in-out infinite}
.look{animation:look 6s ease-in-out infinite}
h1{margin:0;font-size:clamp(34px,8vw,46px);line-height:1.05;letter-spacing:-.035em;font-weight:700}
h1 span{color:var(--fg-3)}
.lede{margin:14px auto 0;max-width:36ch;color:var(--fg-2)}
.cell{margin:26px 0 0;text-align:left;background:var(--paper);border:1px solid var(--line);border-radius:14px;box-shadow:0 1px 2px rgba(20,24,40,.06),0 12px 24px -16px rgba(20,24,40,.18);overflow:hidden;font:13px/1.65 var(--mono)}
.cell div{padding:10px 14px}
.cell div+div{border-top:1px solid var(--line);color:var(--warn)}
.cell b{color:var(--fg-3);font-weight:500;margin-right:8px;user-select:none}
.cell i{font-style:normal;color:var(--fg-3)}
.go{display:inline-flex;align-items:center;gap:8px;margin-top:26px;height:42px;padding:0 20px;border-radius:999px;background:var(--fg);color:var(--page);font-weight:600;font-size:15px;text-decoration:none;transition:transform .2s cubic-bezier(.3,1.25,.5,1)}
.go:hover{transform:translateY(-1px)}
.go:focus-visible{outline:2px solid var(--fg);outline-offset:3px}
.fine{margin:22px 0 0;font-size:13px;color:var(--fg-3)}
@keyframes bob{50%{transform:translateY(-5px) rotate(-1.5deg)}}
@keyframes look{0%,18%{transform:translateX(0)}28%,48%{transform:translateX(-2.5px)}58%,78%{transform:translateX(2.5px)}88%,100%{transform:translateX(0)}}
@media(prefers-reduced-motion:reduce){.who,.look{animation:none}}
</style>
</head>
<body>
<main>
<svg class="who" viewBox="0 0 40 48" role="img" aria-label="The ipynb viewer mark, looking around for the page">
<rect width="40" height="48" rx="10" fill="#1d1d1f"/>
<circle cx="12" cy="11" r="3.2" fill="#f59e0b"/>
<g class="look"><circle cx="13.5" cy="25" r="5" fill="#fff"/><circle cx="26.5" cy="25" r="5" fill="#fff"/><circle cx="12.2" cy="25.6" r="2.1" fill="#1d1d1f"/><circle cx="25.2" cy="25.6" r="2.1" fill="#1d1d1f"/></g>
<path d="M13 38.5c3-2 11-2 14 0" stroke="#fff" stroke-opacity=".6" stroke-width="2.4" stroke-linecap="round" fill="none"/>
</svg>
<h1>404.<br><span>Page not found.</span></h1>
<p class="lede">You asked for a page that does not exist. Impressive, really: most people can only open the ones that do.</p>
<div class="cell" aria-hidden="true">
<div><b>In&nbsp;[404]:</b>page = open("the/thing/you/typed")</div>
<div>FileNotFoundError: it was here a second ago.<br><i>(It was not.)</i></div>
</div>
<a class="go" href="${home}">Take me to the notebooks</a>
<p class="fine">Check the address for typos, or blame whoever sent you the link. We will not tell.</p>
</main>
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
