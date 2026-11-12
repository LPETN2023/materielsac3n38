// ============================================================
// SERVICE WORKER - chemins relatifs pour GitHub Pages
// Stratégie « réseau d'abord » : en ligne, on récupère TOUJOURS la dernière
// version publiée ; le cache ne sert que hors connexion. Plus besoin de
// vider le cache après une mise à jour (CACHE_NAME ne change que si la
// liste des fichiers ci-dessous change).
// ============================================================
const CACHE_NAME = 'inventaire-v6';

// Le SW est installé depuis /materielsac3n38/sw.js : on déduit la base
const BASE = self.location.pathname.replace(/\/sw\.js$/, '');

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

// Bibliothèques externes mises en cache pour l'usage hors connexion
const CDN_HOSTS = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

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
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function putInCache(request, response) {
  if (response && (response.ok || response.type === 'opaque')) {
    const clone = response.clone();
    caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
  }
  return response;
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Supabase (données, connexion) : jamais de cache
  if (url.hostname.endsWith('supabase.co')) return;

  // Fichiers du site : réseau d'abord, cache si hors connexion
  if (url.origin === self.location.origin && url.pathname.startsWith(BASE)) {
    event.respondWith(
      fetch(req, { cache: 'no-cache' })
        .then(res => putInCache(req, res))
        .catch(() => caches.match(req).then(c => c || caches.match(`${BASE}/index.html`)))
    );
    return;
  }

  // Bibliothèques et polices (versions figées) : cache d'abord
  if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => putInCache(req, res)))
    );
  }
});
