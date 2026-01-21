const cacheName = 'perfil-cache-v1';
const assets = [
  '/',
  '/mi_perfil',
  '/static/css/style_mi_perfil.css',
  '/static/uploads/logo.ico',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(cacheName).then(cache => {
      return Promise.allSettled(
        assets.map(url => cache.add(url))
      );
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== cacheName).map(key => caches.delete(key))
      );
    })
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const isNavigation = event.request.mode === 'navigate' || event.request.url.includes('/mi_perfil');
  const isImage = event.request.destination === 'image';

  if (isNavigation || isImage) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clonaRes = response.clone();
          caches.open(cacheName).then(cache => cache.put(event.request, clonaRes));
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then(res => {
            return res || (isNavigation ? caches.match('/mi_perfil') : null);
          });
        })
    );
  } else {
    event.respondWith(
      caches.match(event.request).then(response => {
        return response || fetch(event.request).then(fetchRes => {
          return caches.open(cacheName).then(cache => {
            if (event.request.url.includes('/static/')) {
              cache.put(event.request, fetchRes.clone());
            }
            return fetchRes;
          });
        });
      })
    );
  }
});