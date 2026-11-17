// Service Worker: сохраняет файлы приложения на телефоне, чтобы оно работало без интернета.
// При каждом обновлении приложения увеличивайте VERSION — тогда телефон скачает новые файлы.
const VERSION = 'v1.0.0';
const CACHE = 'finance-app-' + VERSION;
const FILES = [
    './',
    './css/styles.css',
    './icons/apple-touch-icon.png',
    './icons/favicon.png',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/icon-maskable-512.png',
    './index.html',
    './js/app.js',
    './js/backup.js',
    './js/budget.js',
    './js/pwa.js',
    './js/recurring.js',
    './js/router.js',
    './js/screens/categories.js',
    './js/screens/category-form.js',
    './js/screens/expense-form.js',
    './js/screens/expenses.js',
    './js/screens/history.js',
    './js/screens/home.js',
    './js/screens/income-form.js',
    './js/screens/recurring.js',
    './js/screens/settings.js',
    './js/screens/stats.js',
    './js/store.js',
    './js/ui.js',
    './js/utils.js',
    './manifest.webmanifest',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('finance-app-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Сначала из кэша (быстро и офлайн), если нет — из сети
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(resp => {
        if (resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE).then(c => c.put(event.request, copy));
        }
        return resp;
      }).catch(() => (event.request.mode === 'navigate' ? caches.match('./index.html') : undefined));
    })
  );
});
