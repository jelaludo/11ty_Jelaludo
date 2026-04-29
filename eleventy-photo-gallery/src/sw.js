// jelaludo.com service worker — vanilla, no Workbox.
// Bump CACHE_VERSION to invalidate all caches on next activate.
const CACHE_VERSION = 'v1';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const ASSET_CACHE  = `assets-${CACHE_VERSION}`;
const IMG_CACHE    = `img-${CACHE_VERSION}`;
const IMG_CACHE_LIMIT = 60;

const PRECACHE_URLS = [
    '/',
    '/offline.html',
    '/favicon_data/site.webmanifest',
    '/favicon_data/apple-touch-icon.png'
];

// ---------- install ----------
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
    );
});

// ---------- activate ----------
self.addEventListener('activate', (event) => {
    const keep = new Set([STATIC_CACHE, ASSET_CACHE, IMG_CACHE]);
    event.waitUntil(
        caches.keys()
            .then((names) => Promise.all(names.filter((n) => !keep.has(n)).map((n) => caches.delete(n))))
            .then(() => self.clients.claim())
    );
});

// ---------- messages ----------
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// ---------- helpers ----------
async function trimCache(cacheName, maxEntries) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length <= maxEntries) return;
    const excess = keys.length - maxEntries;
    for (let i = 0; i < excess; i++) {
        await cache.delete(keys[i]);
    }
}

function timeoutFetch(request, ms) {
    return new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('network timeout')), ms);
        fetch(request).then(
            (res) => { clearTimeout(t); resolve(res); },
            (err) => { clearTimeout(t); reject(err); }
        );
    });
}

async function networkFirstNav(request) {
    try {
        const res = await timeoutFetch(request, 3000);
        const cache = await caches.open(STATIC_CACHE);
        cache.put(request, res.clone());
        return res;
    } catch (err) {
        const cached = await caches.match(request);
        if (cached) return cached;
        const home = await caches.match('/');
        if (home) return home;
        return caches.match('/offline.html');
    }
}

async function cacheFirstImg(request) {
    const cache = await caches.open(IMG_CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
        const res = await fetch(request);
        if (res.ok) {
            cache.put(request, res.clone());
            trimCache(IMG_CACHE, IMG_CACHE_LIMIT);
        }
        return res;
    } catch (err) {
        return cached || Response.error();
    }
}

async function staleWhileRevalidate(request) {
    const cache = await caches.open(ASSET_CACHE);
    const cached = await cache.match(request);
    const fetchPromise = fetch(request).then((res) => {
        if (res.ok) cache.put(request, res.clone());
        return res;
    }).catch(() => cached);
    return cached || fetchPromise;
}

// ---------- fetch ----------
self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;
    if (url.pathname === '/kanri' || url.pathname.startsWith('/kanri/')) return;

    if (req.mode === 'navigate') {
        event.respondWith(networkFirstNav(req));
        return;
    }

    if (url.pathname.startsWith('/img/') || url.pathname.startsWith('/favicon_data/')) {
        event.respondWith(cacheFirstImg(req));
        return;
    }

    if (url.pathname.startsWith('/js/')) {
        event.respondWith(staleWhileRevalidate(req));
        return;
    }

    // Everything else: pass-through
});
