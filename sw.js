/* ============================================================
   SnapSight — Service Worker
   Caches the app shell for offline use
   ============================================================ */

const CACHE = 'snapsight-v2';
const ASSETS = [
  '/snapsight/',
  '/snapsight/index.html',
  '/snapsight/styles.css',
  '/snapsight/app.js',
  '/snapsight/manifest.json',
  '/snapsight/icons/icon-192.png',
  '/snapsight/icons/icon-512.png',
];

// Install — cache all assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate — clear old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — serve from cache, fallback to network
self.addEventListener('fetch', e => {
  // Don't cache API calls
  if (e.request.url.includes('groq.com') || e.request.url.includes('googleapis.com')) {
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
