/**
 * Service Worker GTT Web App
 * Strategia: Cache-first per assets statici, Network-first per API.
 */

const CACHE_NAME = 'gtt-v1';
const STATIC_CACHE = 'gtt-static-v1';

// Assets da precachare (shell dell'app)
const PRECACHE_URLS = [
  '/',
  '/index.html',
];

// ─── Install ──────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// ─── Activate ─────────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== STATIC_CACHE)
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ─── Fetch ────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API: Network-first, fallback cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Assets statici: Cache-first
  event.respondWith(cacheFirst(request));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    // Metti in cache solo risposte valide
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Fallback: risposta dalla cache
    const cached = await cache.match(request);
    if (cached) return cached;
    // Risposta di fallback per arrivi offline
    return new Response(
      JSON.stringify({
        offline: true,
        message: 'Connessione non disponibile. I dati mostrati potrebbero non essere aggiornati.',
        arrivals: [],
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone());
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}
