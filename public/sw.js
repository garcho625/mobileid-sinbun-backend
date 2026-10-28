/* App shell only. Credentials, private keys and API responses never enter Cache Storage. */
const PREFIX = 'ansim-shell-';
let installingCache;
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const response = await fetch('/offline-assets.json', { cache: 'no-store' });
    if (!response.ok) throw Error('Production offline manifest unavailable');
    const manifest = await response.json();
    if (!/^[a-f0-9]{20}$/.test(manifest.version) || !Array.isArray(manifest.assets)) throw Error('Invalid manifest');
    installingCache = PREFIX + manifest.version;
    const cache = await caches.open(installingCache);
    try {
      for (const asset of manifest.assets) {
        const url = new URL(asset, self.location.origin);
        if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) throw Error('Invalid asset');
        const r = await fetch(url, { cache: 'reload' });
        if (!r.ok) throw Error('Incomplete offline assets');
        await cache.put(url.pathname, r);
      }
    } catch (e) { await caches.delete(installingCache); throw e; }
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    // The active worker's cache is identified again after a process restart.
    const manifest = await fetch('/offline-assets.json', { cache: 'no-store' }).then(r => r.json()).catch(() => null);
    const current = installingCache || (manifest && PREFIX + manifest.version);
    if (current) await Promise.all(names.filter(n => n.startsWith(PREFIX) && n !== current).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (event.request.mode === 'navigate' && url.pathname === '/') {
    event.respondWith((async () => {
      const cached = await caches.match('/');
      return cached || fetch(event.request);
    })());
  } else if (url.pathname !== '/') {
    event.respondWith((async () => (await caches.match(url.pathname)) || fetch(event.request))());
  }
});
