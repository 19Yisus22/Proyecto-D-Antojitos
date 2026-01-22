const cacheName = 'dantojitos-chat-cache-v1';
const assets = [
    '/comentarios_page',
    '/static/css/style_comentarios.css',
    '/static/uploads/logo.ico',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js'
];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(cacheName).then(cache => {
            return cache.addAll(assets);
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
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;

    const requestUrl = new URL(event.request.url);

    if (requestUrl.pathname === '/comentarios_page' || assets.includes(requestUrl.pathname)) {
        event.respondWith(
            caches.match(event.request).then(cachedResponse => {
                const fetchPromise = fetch(event.request).then(networkResponse => {
                    if (networkResponse && networkResponse.status === 200) {
                        const responseToCache = networkResponse.clone();
                        caches.open(cacheName).then(cache => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                    return networkResponse;
                }).catch(() => {
                    return cachedResponse;
                });

                return cachedResponse || fetchPromise;
            })
        );
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then(networkResponse => {
                if (!networkResponse || networkResponse.status !== 200) {
                    return networkResponse;
                }
                const responseToCache = networkResponse.clone();
                caches.open(cacheName).then(cache => {
                    cache.put(event.request, responseToCache);
                });
                return networkResponse;
            })
            .catch(() => {
                return caches.match(event.request).then(fallbackResponse => {
                    if (fallbackResponse) {
                        return fallbackResponse;
                    }
                    if (event.request.mode === 'navigate') {
                        return caches.match('/comentarios_page');
                    }
                    return new Response(JSON.stringify({ error: "Sin conexión" }), {
                        headers: { 'Content-Type': 'application/json' }
                    });
                });
            })
    );
});