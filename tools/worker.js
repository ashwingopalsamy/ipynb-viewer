// Fetches GitHub's public notebook files for the page, so the page itself only ever talks to this site (its policy is
// connect-src 'self'). Three hosts and fixed path shapes; no query strings and none of the reader's headers are passed on.
const HOSTS = {
  'raw.githubusercontent.com': /^\/[^/]+\/[^/]+\/[^/]+\/.+$/,
  'gist.githubusercontent.com': /^\/[^/]+\/[0-9a-f]{5,64}\/raw(?:\/.*)?$/i,
  'api.github.com': /^\/gists\/[0-9a-f]{5,64}$/i,
};
const LIMIT = 50 * 1024 * 1024; // the same as LIMIT in src/lib/link.ts
const allowed = (u) => u.protocol === 'https:' && !u.port && !!HOSTS[u.hostname]?.test(u.pathname);
const MAX_PATH = 512;
const TIMEOUT = 10_000;
const headersFor = (status, extra) => ({ 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...(status === 429 ? { 'retry-after': '60' } : {}), ...(status === 405 ? { allow: 'GET' } : {}), ...extra });
const no = (status) => new Response(null, { status, headers: headersFor(status) });
// Stops a body that grows past LIMIT even when the origin sent no content-length.
const capped = (body) => {
  let seen = 0;
  return body.pipeThrough(new TransformStream({
    transform(chunk, controller) {
      seen += chunk.byteLength;
      if (seen > LIMIT) controller.error(new Error('too large'));
      else controller.enqueue(chunk);
    },
  }));
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/link/')) return env.ASSETS.fetch(request);
    const started = Date.now();
    let hostKey = '';
    // One aggregate row per request: outcome, which allowed host, country, status, bytes, time. Never the path, address, IP or headers.
    const done = (outcome, res, bytes = 0) => {
      try {
        env.METRICS?.writeDataPoint({ indexes: [outcome], blobs: [outcome, hostKey, request.cf?.country ?? ''], doubles: [res.status, bytes, Date.now() - started] });
      } catch {}
      return res;
    };
    if (request.method !== 'GET') return done('method', no(405));
    // only the page itself may ask: no other site, no navigation, no <img> (the headers are absent only in old browsers)
    const site = request.headers.get('sec-fetch-site');
    const dest = request.headers.get('sec-fetch-dest');
    if ((site && site !== 'same-origin') || (dest && dest !== 'empty')) return done('blocked', no(403));
    const ip = request.headers.get('cf-connecting-ip');
    if (env.LINKS && ip && !(await env.LINKS.limit({ key: ip })).success) return done('rate_limited', no(429));
    if (url.pathname.length > MAX_PATH) return done('not_found', no(404));
    const [host, ...rest] = url.pathname.slice('/link/'.length).split('/');
    let target = new URL(`https://${host}/${rest.join('/')}`);
    if (!allowed(target)) return done('not_found', no(404));
    hostKey = target.hostname;
    let res;
    try {
      for (let hop = 0; ; hop++) {
        res = await fetch(target, {
          redirect: 'manual',
          signal: AbortSignal.timeout(TIMEOUT),
          headers: { 'user-agent': 'ipynb-viewer', ...(target.hostname === 'api.github.com' && env.GITHUB_TOKEN ? { authorization: `Bearer ${env.GITHUB_TOKEN}` } : {}) },
          // a commit-pinned file never changes; a branch is cached as briefly as GitHub caches it
          cf: { cacheEverything: true, cacheTtlByStatus: { '200-299': /\/[0-9a-f]{40}\//i.test(target.pathname) ? 86400 : 300, '300-599': 0 } },
        });
        if (res.status < 300 || res.status > 399) break;
        const next = new URL(res.headers.get('location') ?? '', target);
        if (hop === 3 || !allowed(next)) return done('upstream_error', no(502));
        target = next;
        hostKey = target.hostname;
      }
    } catch {
      return done('timeout', no(504));
    }
    if (!res.ok) return done('upstream_error', no(res.status)); // 404/401/403/429/5xx pass through so link.ts says the same things it says today
    if (Number(res.headers.get('content-length')) > LIMIT) return res.body?.cancel(), done('too_large', no(413));
    if (/^(?:text\/html|application\/xhtml)/i.test(res.headers.get('content-type') ?? '')) return res.body?.cancel(), done('html', no(415));
    const headers = {
      'content-type': 'text/plain; charset=utf-8',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; sandbox",
      'cross-origin-resource-policy': 'same-origin',
      'referrer-policy': 'no-referrer',
      'cache-control': 'no-store',
    };
    const modified = res.headers.get('last-modified');
    if (modified) headers['last-modified'] = modified;
    return done('ok', new Response(res.body && capped(res.body), { status: 200, headers }), Number(res.headers.get('content-length')) || 0);
  },
};
