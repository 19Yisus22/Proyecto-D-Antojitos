const CACHE_NAME = 'dantojitos-v2';
const ASSETS = [
    '/',
    '/catalogo_page',
    '/static/css/style_catalogo.css',
    '/static/js/catalogo.js',
    '/static/js/inicio.js',
    '/static/uploads/logo.ico',
    '/static/uploads/googlogo.ico',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js'
];

const EXCLUDED_PATHS = [
    '/obtener_catalogo',
    '/obtener_carrito',
    '/api/publicidad/activa',
    '/api/publicidad/actualizar',
    '/api/admin/notificaciones',
    '/guardar_catalogo',
    '/api/configuracion'
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

    const url = new URL(event.request.url);
    const isExcluded = EXCLUDED_PATHS.some(path => url.pathname.includes(path));

    if (isExcluded) {
        event.respondWith(
            fetch(event.request).catch(() => {
                return new Response(JSON.stringify({ 
                    error: true,
                    status: "offline",
                    productos: [], 
                    message: "Sin conexión al servidor." 
                }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            })
        );
        return;
    }

    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) {
                return cachedResponse;
            }

            return fetch(event.request).then(networkResponse => {
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch(() => {
                if (event.request.mode === 'navigate') {
                    return caches.match('/catalogo_page') || caches.match('/');
                }
            });
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
                const response = await fetch(request.clone());
                if (response.ok) {
                    await cache.delete(request);
                }
            } catch (err) {
                console.error(err);
            }
        })
    );
}