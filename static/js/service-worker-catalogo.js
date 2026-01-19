const CACHE_NAME = 'dantojitos-v1';
const ASSETS = [
    '/',
    '/catalogo_page',
    '/static/css/style_catalogo.css',
    '/static/js/catalogo.js',
    '/static/uploads/logo.ico',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request).then(response => {
            const fetchPromise = fetch(event.request).then(networkResponse => {
                if (networkResponse && networkResponse.status === 200 && !event.request.url.includes('/obtener_catalogo')) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch(() => {
                if (event.request.mode === 'navigate') {
                    return caches.match('/catalogo_page');
                }
            });
            return response || fetchPromise;
        })
    );
});

self.addEventListener('sync', event => {
    if (event.tag === 'sync-carrito') {
        event.waitUntil(enviarCarritoPendiente());
    }
});

async function enviarCarritoPendiente() {
    const cache = await caches.open('offline-requests');
    const requests = await cache.keys();
    
    return Promise.all(
        requests.map(async (request) => {
            try {
                await fetch(request);
                await cache.delete(request);
            } catch (err) {
                console.error("Fallo sincronización", err);
            }
        })
    );
}