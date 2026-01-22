const CACHE_NAME = 'dantojitos-login-cache-v2';
const STATIC_ASSETS = [
    '/',
    '/login',
    '/static/css/style_login.css',
    '/static/uploads/logo.ico',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js'
];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);
    const isNavigation = event.request.mode === 'navigate' || url.pathname === '/login';

    if (isNavigation) {
        event.respondWith(networkFirst(event.request));
    } else {
        event.respondWith(staleWhileRevalidate(event.request));
    }
});

async function networkFirst(request) {
    const cache = await caches.open(CACHE_NAME);
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) cache.put(request, networkResponse.clone());
        return networkResponse;
    } catch (error) {
        return await cache.match(request) || await cache.match('/login');
    }
}

async function staleWhileRevalidate(request) {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    const fetchPromise = fetch(request).then(networkResponse => {
        if (networkResponse.ok) cache.put(request, networkResponse.clone());
        return networkResponse;
    });
    return cachedResponse || fetchPromise;
}