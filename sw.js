// Offline cache for Water Town. Bump VERSION when files change.
const VERSION = 'wt-v2';
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './css/app.css', './vendor/animate.min.css',
  './vendor/three.module.min.js', './vendor/RoundedBoxGeometry.js',
  './js/main.js', './js/app.js', './js/loader.js', './js/data.js', './js/i18n.js', './js/game.js',
  './js/models.js', './js/scene.js', './js/ui.js', './js/icons.js',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Network first for our own files (so updates arrive), cache as fallback when offline.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return res;
    }).catch(() => hit)));
    return;
  }
  e.respondWith(fetch(req).then((res) => {
    const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return res;
  }).catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html'))));
});
