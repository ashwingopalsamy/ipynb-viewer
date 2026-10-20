// The offline copy. Every file the app can ask for is kept on this device after the first visit, so a notebook opens
// with the network off and the page makes no request at all. Generated into dist/sw.js by the build (see vite.config.ts).
const KEY = 'ipynb-__VERSION__';
const FILES = __FILES__;
const scope = self.registration.scope;
const at = (path) => new URL(path, scope).href;

// A new version waits until the tabs of the old one are closed (no skipWaiting), so an open tab never loses a chunk.
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

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== location.origin) return;
  // A file the app has is answered from the copy. Any other page address is the home page, which is the app too.
  const page = request.mode === 'navigate' && at('index.html');
  event.respondWith(caches.match(request, { ignoreSearch: true, ignoreVary: true }).then((hit) => hit || (page && caches.match(page)) || fetch(request)));
});
