// Register service worker and show non-blocking update toast.
(function () {
    if (!('serviceWorker' in navigator)) return;

    const params = new URLSearchParams(window.location.search);
    const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    const force = params.get('sw') === '1';
    if (isLocalhost && !force) return;

    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js', { scope: '/' }).then((reg) => {
            // Update was already waiting when this page loaded — surface toast immediately.
            if (reg.waiting && navigator.serviceWorker.controller) {
                showUpdateToast(reg);
            }
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
