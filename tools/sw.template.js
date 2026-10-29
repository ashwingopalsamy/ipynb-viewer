// The offline copy. Every file the app can ask for is kept on this device after the first visit, so a notebook opens
// with the network off and the page makes no request at all. Generated into dist/sw.js by the build (see vite.config.ts).
const KEY = 'ipynb-__VERSION__';
const FILES = __FILES__;
const scope = self.registration.scope;
const at = (path) => new URL(path, scope).href;
const rootPath = new URL(scope).pathname;

// A new version waits until the windows of the old one are closed, so an open tab never loses a chunk. The one way out is a page
// asking to update (below), which is only granted to the app's single window.
// Files named by their content (assets/…-hash.js) are copied from an older copy instead of downloaded again.
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(KEY);
      await Promise.all(
        FILES.map(async (path) => {
          const url = at(path);
          const old = /-[\w-]{8}\.\w+$/.test(path) && (await caches.match(url));
          const res = old || (await fetch(url, { cache: 'reload' }));
          if (!res.ok) throw new Error(`${path}: ${res.status}`);
          // A redirected response (Cloudflare sends /index.html to /) cannot answer a page load; the browser fails it.
          await cache.put(url, res.redirected ? new Response(res.body, res) : res);
        }),
      );
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key.startsWith('ipynb-') && key !== KEY) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

// A page that finds a new version waiting asks for it. It gets it only when it is the app's one window; the frames of notebook tabs
// are not windows of their own and reload with the page around them.
self.addEventListener('message', (event) => {
  if (event.data !== 'update') return;
  event.waitUntil(
    (async () => {
      const tops = (await self.clients.matchAll({ type: 'window', includeUncontrolled: true })).filter((c) => c.frameType !== 'nested');
      if (tops.length === 1 && tops[0].id === event.source?.id) await self.skipWaiting();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith(new URL('link/', scope).pathname)) return;
  // A file the app has is answered from the copy, and so is the home page at any search of the app. A page it does not have
  // (a guide the copy lacks) comes from the network; offline, the app itself answers.
  const page = request.mode === 'navigate';
  event.respondWith(
    (async () => {
      const hit = (await caches.match(request, { ignoreSearch: true, ignoreVary: true })) || (page && url.pathname === rootPath && (await caches.match(at('index.html'))));
      if (hit) return hit;
      if (!page) return fetch(request);
      try {
        return await fetch(request);
      } catch {
        return (url.pathname === rootPath && (await caches.match(at('index.html')))) || Response.error();
      }
    })(),
  );
});
