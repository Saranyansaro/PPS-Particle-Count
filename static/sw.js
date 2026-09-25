/* PPS Particle Count – offline support for the hosted app (GitHub Pages / iPhone home screen).
   The deploy workflow replaces __BUILD__ with the commit id, so every release refreshes the cache.
   If you publish some other way, change VERSION when you change any file. */
const VERSION = '2.0.0';
const CACHE = 'ppspc-' + VERSION + '-__BUILD__';
const ASSETS = [
  './', 'index.html', 'manual.html', 'manifest.webmanifest', 'logo.png',
  'js/calc.js', 'js/store.js', 'js/app.js',
  'lib/html2canvas.min.js', 'lib/jspdf.umd.min.js',
  'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('ppspc-') && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

/* The page asks for this when the user taps "Update now" */
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes('/api/')) return; // data from a laptop server is never cached
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok && res.type === 'basic' && url.pathname.startsWith(new URL('./', self.location).pathname)) cache.put(req, res.clone());
      return res;
    } catch (err) {
      if (req.mode === 'navigate') {
        const shell = await cache.match('./') || await cache.match('index.html');
        if (shell) return shell;
      }
      throw err;
    }
  })());
});
