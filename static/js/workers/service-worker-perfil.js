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
  event.waitUntil(
    caches.open(cacheName).then(cache => {
      return Promise.allSettled(
        assets.map(url => {
          return cache.add(url).catch(err => console.warn('No se pudo cachear:', url));
        })
      );
    })
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (event.request.destination === 'image') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clonaRes = response.clone();
          caches.open(cacheName).then(cache => cache.put(event.request, clonaRes));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    event.respondWith(
      caches.match(event.request).then(response => {
        return response || fetch(event.request);
      })
    );
  }
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