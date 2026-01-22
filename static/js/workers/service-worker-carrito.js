const CACHE_NAME = 'd-antojitos-cache-v2';
const STATIC_ASSETS = [
    '/',
    '/static/css/style_carrito.css',
    '/static/uploads/logo.png',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css'
];

const DYNAMIC_ROUTES = [
    '/obtener_carrito',
    '/obtener_catalogo',
    '/buscar_facturas'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    if (event.request.method !== 'GET') return;

    if (DYNAMIC_ROUTES.some(route => url.pathname.startsWith(route))) {
        event.respondWith(networkFirst(event.request));
    } else {
        event.respondWith(staleWhileRevalidate(event.request));
    }
});

async function networkFirst(request) {
    const cache = await caches.open(CACHE_NAME);
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        const cachedResponse = await cache.match(request);
        return cachedResponse || new Response(JSON.stringify({ error: "Sin conexión" }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

async function staleWhileRevalidate(request) {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);

    const networkFetch = fetch(request).then((networkResponse) => {
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    });

    return cachedResponse || networkFetch;
}