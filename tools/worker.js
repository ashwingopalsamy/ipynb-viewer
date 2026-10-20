// Fetches GitHub's public notebook files for the page, so the page itself only ever talks to this site (its policy is
// connect-src 'self'). Three hosts and fixed path shapes; no query strings and none of the reader's headers are passed on.
const HOSTS = {
  'raw.githubusercontent.com': /^\/[^/]+\/[^/]+\/[^/]+\/.+$/,
  'gist.githubusercontent.com': /^\/[^/]+\/[0-9a-f]{5,64}\/raw(?:\/.*)?$/i,
  'api.github.com': /^\/gists\/[0-9a-f]{5,64}$/i,
};
const LIMIT = 50 * 1024 * 1024; // the same as LIMIT in src/lib/link.ts
const allowed = (u) => u.protocol === 'https:' && !u.port && !!HOSTS[u.hostname]?.test(u.pathname);
const no = (status) => new Response(null, { status, headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/link/')) return env.ASSETS.fetch(request);
    if (request.method !== 'GET') return no(405);
    // only the page itself may ask: no other site, no navigation, no <img> (the headers are absent only in old browsers)
    const site = request.headers.get('sec-fetch-site');
    const dest = request.headers.get('sec-fetch-dest');
    if ((site && site !== 'same-origin') || (dest && dest !== 'empty')) return no(403);
    if (env.LINKS && !(await env.LINKS.limit({ key: request.headers.get('cf-connecting-ip') ?? '' })).success) return no(429);
    const [host, ...rest] = url.pathname.slice('/link/'.length).split('/');
    let target = new URL(`https://${host}/${rest.join('/')}`);
    if (!allowed(target)) return no(404);
    let res;
    for (let hop = 0; ; hop++) {
      res = await fetch(target, {
        redirect: 'manual',
        headers: { 'user-agent': 'ipynb-viewer', ...(target.hostname === 'api.github.com' && env.GITHUB_TOKEN ? { authorization: `Bearer ${env.GITHUB_TOKEN}` } : {}) },
        // a commit-pinned file never changes; a branch is cached as briefly as GitHub caches it
        cf: { cacheEverything: true, cacheTtlByStatus: { '200-299': /\/[0-9a-f]{40}\//i.test(target.pathname) ? 86400 : 300, '300-599': 0 } },
      });
      if (res.status < 300 || res.status > 399) break;
      const next = new URL(res.headers.get('location') ?? '', target);
      if (hop === 3 || !allowed(next)) return no(502);
      target = next;
    }
    if (!res.ok) return no(res.status); // 404/401/403/429/5xx pass through so link.ts says the same things it says today
    if (Number(res.headers.get('content-length')) > LIMIT) return res.body?.cancel(), no(413);
    if (/^(?:text\/html|application\/xhtml)/i.test(res.headers.get('content-type') ?? '')) return res.body?.cancel(), no(415);
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
    return new Response(res.body, { status: 200, headers });
  },
};
