const CACHE_NAME = 'dantojitos-admin-v2';
const STATIC_FILES = [
    '/',
    '/publicidad_page',
    '/static/css/style_publicidad.css',
    '/static/js/publicidad.js',
    '/static/uploads/logo.ico',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js'
];

self.addEventListener('install', (e) => {
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return Promise.allSettled(
                STATIC_FILES.map(url => cache.add(url))
            );
        })
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            );
        })
    );
    return self.clients.claim();
});

self.addEventListener('fetch', (e) => {
    if (e.request.method !== 'GET') return;

    const url = new URL(e.request.url);
    const isNavigation = e.request.mode === 'navigate' || url.pathname.includes('/publicidad_page');
    const isApi = url.pathname.includes('/api/');
    const isStaticAsset = url.pathname.includes('/static/') || 
                          url.pathname.includes('/uploads/') || 
                          e.request.destination === 'font' || 
                          e.request.destination === 'script' || 
                          e.request.destination === 'style';

    if (isNavigation || isApi) {
        e.respondWith(
            fetch(e.request)
                .then((res) => {
                    if (res.ok) {
                        const clone = res.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
                    }
                    return res;
                })
                .catch(() => {
                    return caches.match(e.request).then((cached) => {
                        return cached || (isNavigation ? caches.match('/publicidad_page') : Response.error());
                    });
                })
        );
    } else if (isStaticAsset) {
        e.respondWith(
            caches.open(CACHE_NAME).then((cache) => {
                return cache.match(e.request).then((cachedResponse) => {
                    const fetchPromise = fetch(e.request).then((networkResponse) => {
                        if (networkResponse.ok) {
                            cache.put(e.request, networkResponse.clone());
                        }
                        return networkResponse;
                    });
                    return cachedResponse || fetchPromise;
                });
            })
        );
    } else {
        e.respondWith(
            caches.match(e.request).then((res) => {
                return res || fetch(e.request);
            })
        );
    }
});