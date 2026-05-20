// ============================================================
// SERVICE WORKER - Cache pour PWA
// Chemin de base : /materielsac3n38/
// ============================================================
const CACHE_NAME = 'inventaire-v2';
const BASE = '/materielsac3n38';
const STATIC_ASSETS = [
  `${BASE}/`,
  `${BASE}/index.html`,
  `${BASE}/css/style.css`,
  `${BASE}/js/config.js`,
  `${BASE}/js/pages.js`,
  `${BASE}/js/app.js`,
  `${BASE}/js/pwa.js`,
  `${BASE}/manifest.json`
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Ignore Supabase et CDN externes (toujours réseau)
  if (url.hostname.includes('supabase') ||
      url.hostname.includes('jsdelivr') ||
      url.hostname.includes('googleapis')) {
    return;
  }

  // Assets statiques : cache first
  if (STATIC_ASSETS.some(asset => url.pathname === asset || url.pathname.startsWith(asset))) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        const networkFetch = fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        });
        return cached || networkFetch;
      })
    );
    return;
  }

  // Reste : network first
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
