const CACHE_NAME = 'perfil-cache-v2';
const STATIC_ASSETS = [
    '/',
    '/mi_perfil',
    '/static/css/style_mi_perfil.css',
    '/static/js/perfil.js',
    '/static/uploads/logo.ico',
    '/static/default_icon_profile.png',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js',
    'https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js'
];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return Promise.allSettled(
                STATIC_ASSETS.map(url => 
                    fetch(url).then(response => {
                        if (response.ok) return cache.put(url, response);
                        throw new Error();
                    }).catch(() => {})
                )
            );
        })
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.map(key => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        })
    );
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);
    const isDynamic = event.request.mode === 'navigate' || 
                      url.pathname.startsWith('/listar_usuarios') || 
                      url.pathname.startsWith('/mi_perfil');

    if (isDynamic) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    if (response && response.status === 200) {
                        const copy = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
                    }
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            const fetchPromise = fetch(event.request).then(networkResponse => {
                if (networkResponse && networkResponse.status === 200) {
                    const cacheCopy = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, cacheCopy));
                }
                return networkResponse;
            }).catch(() => cachedResponse);

            return cachedResponse || fetchPromise;
        })
    );
});