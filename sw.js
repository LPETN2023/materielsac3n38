// ============================================================
// SERVICE WORKER - Cache pour PWA
// ============================================================
const CACHE_NAME = 'inventaire-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/config.js',
  '/js/pages.js',
  '/js/app.js',
  '/manifest.json'
];

// Installation : mise en cache des assets statiques
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activation : nettoyage des anciens caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch : stratégie Network First (données fraîches), fallback cache
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Ignore les requêtes Supabase (toujours réseau)
  if (url.hostname.includes('supabase') || url.hostname.includes('googleapis')) {
    return;
  }

  // Pour les assets statiques : cache first
  if (STATIC_ASSETS.some(asset => url.pathname === asset || url.pathname.endsWith(asset))) {
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

  // Pour le reste : network first
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
