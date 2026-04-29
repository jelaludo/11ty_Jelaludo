# PWA + Mobile Experience Spec — jelaludo.com

Branch: `feat/pwa-mobile`. Eleventy 2.0.1, no bundler, SCSS via `sass` CLI, JS as plain scripts. Implementation agent should follow workstreams 1–8 in order.

## 1. Manifest rewrite

**Files**
- `src/favicon_data/site.webmanifest` (replace contents)

**Change**

Replace the entire file with:

```json
{
    "name": "Jelaludo Photography",
    "short_name": "Jelaludo",
    "id": "/",
    "start_url": "/?src=pwa",
    "scope": "/",
    "display": "standalone",
    "orientation": "any",
    "theme_color": "#111111",
    "background_color": "#111111",
    "icons": [
        { "src": "/favicon_data/favicon-16x16.png", "sizes": "16x16", "type": "image/png" },
        { "src": "/favicon_data/favicon-32x32.png", "sizes": "32x32", "type": "image/png" },
        { "src": "/favicon_data/apple-touch-icon.png", "sizes": "180x180", "type": "image/png" },
        { "src": "/favicon_data/android-chrome-192x192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
        { "src": "/favicon_data/android-chrome-512x512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
        { "src": "/favicon_data/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
    ]
}
```

**Deliverable flag (manual, out of code scope):** Generate a 512×512 maskable PNG with safe-zone padding (~80px on every side) and place it at `src/favicon_data/icon-maskable-512.png`. Until that file exists, the manifest entry will 404 but Chrome will still install (it just won't have a maskable icon).

**Acceptance**
- `_site/favicon_data/site.webmanifest` contains the new fields after build.
- Chrome DevTools → Application → Manifest reports no missing required fields and no warnings about `start_url`/`scope`/`id`.
- Lighthouse PWA audit "Web app manifest meets the installability requirements" passes.
- Theme/background colors render `#111` (no white flash on launch).

---

## 2. iOS head tags + viewport override

**Files**
- `src/_includes/layouts/base.njk` (insert after line 19 — after the existing `<link rel="manifest">` line)

**Change**

After the existing `<link rel="manifest">` line and before the `{% set css %}` block, add:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#111111">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Jelaludo">
<meta name="mobile-web-app-capable" content="yes">
```

Rationale for viewport approach: chose option (a) — emit a manual `<meta name="viewport">` AFTER `{% metagen %}`. Browsers honor the last-declared viewport meta. This avoids removing/forking the metagen plugin.

**Acceptance**
- View source on a built page shows the manual viewport meta AFTER metagen's viewport meta.
- On iPhone Safari with notch, content can extend under the dynamic island when `env(safe-area-inset-*)` is used (verified in workstream 3).
- iOS standalone mode hides the Safari chrome (status bar overlays content).

---

## 3. Safe-area insets

**Files**
- `src/_includes/sass/partials/_nav.scss` (modify `.top-nav` block)
- `src/_includes/sass/partials/_footer.scss` (modify `footer` block)

**Change**

In `_nav.scss`, append inside the existing `.top-nav` block (before its closing `}`):

```scss
@media all and (display-mode: standalone) {
    padding-top: env(safe-area-inset-top);
}
```

In `_footer.scss`, change the `footer` block from:

```scss
footer {
    position: relative;
    margin-top: 3rem;
    padding-top: 2rem;
    padding-bottom: 2rem;
}
```

to:

```scss
footer {
    position: relative;
    margin-top: 3rem;
    padding-top: 2rem;
    padding-bottom: 2rem;

    @media all and (display-mode: standalone) {
        padding-bottom: calc(2rem + env(safe-area-inset-bottom));
        padding-left: env(safe-area-inset-left);
        padding-right: env(safe-area-inset-right);
    }
}
```

(SCSS is rebuilt by `npm run build:sass` → `src/_includes/css/style.css`, then inlined by `cssmin` in `base.njk`.)

**Acceptance**
- Run `npm run build:sass`; verify `display-mode: standalone` blocks present in `src/_includes/css/style.css`.
- In a browser tab (non-standalone), nav and footer padding are unchanged.
- After installing PWA on iOS, top of nav clears the status bar/notch and bottom of footer clears the home-indicator.

---

## 4. Service worker

**Files**
- `src/sw.js` (new file — vanilla JS, no template processing)
- `.eleventy.js` (add passthrough — see workstream 7)

**Change**

Create `src/sw.js`:

```js
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
    if (url.pathname.startsWith('/kanri')) return;

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
```

**Acceptance**
- `_site/sw.js` exists after `npm run build` (depends on workstream 7 passthrough).
- Chrome DevTools → Application → Service Workers shows the SW registered with status "activated and is running."
- DevTools → Application → Cache Storage shows `static-v1` populated after first load.
- Throttle to "Offline" in DevTools, navigate to a previously visited gallery page → page renders from cache. Navigate to an unvisited URL → `/offline.html` renders.
- POST requests, requests to `/kanri/*`, and cross-origin requests bypass the SW (verify via Network tab "Service Worker" column).

---

## 5. Offline page

**Files**
- `src/offline.html` (new file — plain HTML, NOT a Nunjucks template)
- `.eleventy.js` (passthrough — see workstream 7)

**Change**

Create `src/offline.html` (no front matter, no template engine):

```html
<!DOCTYPE html>
<html lang="en-US" dir="ltr">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="theme-color" content="#111111">
    <title>Offline — Jelaludo</title>
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon_data/favicon-32x32.png">
    <link rel="apple-touch-icon" sizes="180x180" href="/favicon_data/apple-touch-icon.png">
    <link rel="manifest" href="/favicon_data/site.webmanifest">
    <style>
        :root { color-scheme: dark; }
        html, body { margin: 0; padding: 0; min-height: 100vh; background: #111; color: #f5f5f5;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        .wrap { min-height: 100vh; display: flex; flex-direction: column; align-items: center;
            justify-content: center; padding: 2rem; text-align: center;
            padding-bottom: calc(2rem + env(safe-area-inset-bottom));
            padding-top: calc(2rem + env(safe-area-inset-top)); }
        h1 { font-size: clamp(1.75rem, 6vw, 2.5rem); margin: 0 0 1rem; letter-spacing: 0.04em; }
        p { color: #bbb; max-width: 32rem; line-height: 1.6; margin: 0 0 2rem; }
        a.btn { color: #f5f5f5; text-decoration: none; border: 1px solid #555;
            padding: 0.75rem 1.5rem; letter-spacing: 0.12em; text-transform: uppercase;
            font-size: 0.85rem; transition: border-color 0.2s, color 0.2s; }
        a.btn:hover, a.btn:focus { border-color: #fff; color: #fff; }
    </style>
</head>
<body>
    <div class="wrap">
        <h1>You're offline</h1>
        <p>Try again when you have signal. Pages you've already visited will still load from cache.</p>
        <a class="btn" href="/">Back to home</a>
    </div>
</body>
</html>
```

**Acceptance**
- `_site/offline.html` exists post-build.
- Loading `/offline.html` directly in browser renders dark-themed page.
- All resources are inline or part of `favicon_data` (which the SW precaches), so it works fully offline.

---

## 6. SW registration + update toast

**Files**
- `src/js/sw-register.js` (new file)
- `src/_includes/layouts/base.njk` (add one `<script>` line at end of body, after the existing `orientation.js` line)

**Change**

Create `src/js/sw-register.js`:

```js
// Register service worker and show non-blocking update toast.
(function () {
    if (!('serviceWorker' in navigator)) return;

    const params = new URLSearchParams(window.location.search);
    const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    const force = params.get('sw') === '1';
    if (isLocalhost && !force) return;

    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js', { scope: '/' }).then((reg) => {
            reg.addEventListener('updatefound', () => {
                const newWorker = reg.installing;
                if (!newWorker) return;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        showUpdateToast(reg);
                    }
                });
            });
        }).catch((err) => {
            console.warn('SW registration failed:', err);
        });
    });

    function showUpdateToast(reg) {
        if (document.getElementById('sw-update-toast')) return;

        const toast = document.createElement('div');
        toast.id = 'sw-update-toast';
        toast.setAttribute('role', 'status');
        toast.style.cssText = [
            'position:fixed', 'right:1rem',
            'bottom:calc(1rem + env(safe-area-inset-bottom))',
            'background:#1a1a1a', 'color:#f5f5f5',
            'border:1px solid #444', 'border-radius:8px',
            'padding:0.75rem 1rem', 'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
            'font-size:0.85rem', 'box-shadow:0 8px 24px rgba(0,0,0,0.5)',
            'z-index:9999', 'display:flex', 'align-items:center', 'gap:0.75rem',
            'max-width:calc(100vw - 2rem)'
        ].join(';');

        const msg = document.createElement('span');
        msg.textContent = 'New version available';
        toast.appendChild(msg);

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = 'Refresh';
        btn.style.cssText = [
            'background:transparent', 'color:#f5f5f5',
            'border:1px solid #777', 'border-radius:4px',
            'padding:0.4rem 0.8rem', 'font:inherit',
            'letter-spacing:0.08em', 'text-transform:uppercase',
            'cursor:pointer'
        ].join(';');
        btn.addEventListener('click', () => {
            if (!reg.waiting) return;
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                window.location.reload();
            }, { once: true });
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        });
        toast.appendChild(btn);

        document.body.appendChild(toast);
    }
})();
```

In `src/_includes/layouts/base.njk`, after the existing `<script type="module" src="/js/orientation.js"></script>` line, add:

```html
<script src="/js/sw-register.js" defer></script>
```

`src/js/` is already passthrough-copied in `.eleventy.js`, so no config change needed for this file.

**Acceptance**
- On `localhost` without `?sw=1`, no SW registration occurs (verify via DevTools Application tab).
- On production (or `localhost?sw=1`), SW registers on first load.
- Bump `CACHE_VERSION` in `src/sw.js` → rebuild → reload → toast appears bottom-right with "New version available — Refresh" button.
- Click "Refresh" → page reloads, new SW takes over, no further toasts.
- Toast renders dark-themed and respects bottom safe-area on iPhone PWA.

---

## 7. Eleventy passthrough config

**Files**
- `.eleventy.js` (add two lines after the existing `addPassthroughCopy` block)

**Change**

Current `.eleventy.js` only copies directories (`./src/photos`, `./src/css`, `./src/js`, `./src/favicon_data`). Eleventy will not pick up `src/sw.js` or `src/offline.html` automatically. After the existing passthrough lines add:

```js
eleventyConfig.addPassthroughCopy({ "./src/sw.js": "/sw.js" });
eleventyConfig.addPassthroughCopy({ "./src/offline.html": "/offline.html" });
```

The object form pins the output path to the site root regardless of input directory layout.

**Acceptance**
- After `npm run build:eleventy`, both `_site/sw.js` and `_site/offline.html` exist.
- Visiting `http://localhost:8080/sw.js` returns the SW source verbatim with `Content-Type: application/javascript`.
- Visiting `http://localhost:8080/offline.html` returns the offline page.

---

## 8. Acceptance criteria & manual smoke test

**Build verification**
- `npm run build` exits 0 with no errors or warnings.
- `_site/sw.js`, `_site/offline.html`, `_site/favicon_data/site.webmanifest` all exist and contain the new content.
- `_site/index.html` contains: the override viewport meta AFTER metagen's viewport, the four `apple-mobile-web-app-*` metas, the `theme-color` meta, and `<script src="/js/sw-register.js" defer>`.

**Manifest validation**
- Chrome DevTools → Application → Manifest panel shows: name "Jelaludo Photography", short_name "Jelaludo", start_url `/?src=pwa`, scope `/`, theme_color `#111111`, no errors. The "Installability" section reports the site is installable.
- Lighthouse PWA audit: "Web app manifest meets the installability requirements" passes; "Has a `<meta name="viewport">` tag with `width` or `initial-scale`" passes; "Provides a valid `apple-touch-icon`" passes.

**Android install**
- On Android Chrome, three-dot menu → "Install app" shows "Jelaludo Photography." After install, app icon on home screen is the maskable icon (or `any` icon if maskable PNG not yet generated). Launching the app shows splash with `#111111` background and no URL bar.

**Offline behavior (DevTools)**
- Load `/`, `/gallery/`, and one feature page while online. DevTools → Application → Service Workers, check "Offline." Reload `/` and `/gallery/` → both render from cache. Navigate to a never-visited URL → `/offline.html` renders.
- POST to `/kanri/*` (or any kanri path) bypasses SW (Network tab: no "ServiceWorker" entry in the size column).

**Update toast**
- After a clean install, increment `CACHE_VERSION` in `src/sw.js` (e.g. `'v1'` → `'v2'`), rebuild, reload the page once → toast appears bottom-right after the new SW reaches `installed` state. Click "Refresh" → page reloads, toast does not reappear.

**iOS standalone**
- On iPhone Safari, Share → Add to Home Screen. Title prefilled to "Jelaludo." Launch the installed app → no Safari chrome, status bar overlays a `#111` background, nav clears the dynamic island/notch, footer clears the home-indicator. Status bar text is light (black-translucent style).

**Dev iteration sanity**
- `npm run dev` on `localhost:8080` (without `?sw=1`) → no SW registers; live reload works normally.
- `localhost:8080/?sw=1` → SW registers, useful for local SW testing.
