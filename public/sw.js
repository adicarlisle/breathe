// Offline support for the Smoking Calculator apps (installable tracker). Pages: network first,
// falling back to the saved copy. Assets: saved copy first, refreshed in the background.
// Only this app's own GET requests are handled; nothing personal is ever cached (it lives in localStorage).
const CACHE = 'bt-smoking-v1';
const CORE = [
  '/smoking-calculator/tracker',
  '/smoking-calculator/manifest.webmanifest',
  '/smoking-calculator/assets/style.css',
  '/smoking-calculator/assets/health.js',
  '/smoking-calculator/assets/tracker.js',
  '/smoking-calculator/assets/tracker-ui.js',
  '/smoking-calculator/assets/icon-192.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || !url.pathname.startsWith('/smoking-calculator/')) return;
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then((res) => {
      if (res.ok && !url.search) caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || caches.match('/smoking-calculator/tracker'))));
    return;
  }
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(e.request);
    const fresh = fetch(e.request).then((res) => { if (res.ok) c.put(e.request, res.clone()); return res; }).catch(() => hit);
    return hit || fresh;
  }));
});
