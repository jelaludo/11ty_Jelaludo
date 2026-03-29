/**
 * Detects browser-native viewport zoom (pinch-zoom on the page itself)
 * and toggles body classes so CSS can react:
 *
 * - .is-viewport-zoomed  — viewport scale > 1 (disables scroll-snap)
 * - .is-pinch-active      — multi-touch gesture in progress or just ended
 *                           (blocks accidental clicks from sloppy pinch release)
 *
 * Uses the Visual Viewport API (supported in all modern mobile browsers).
 */
(function () {
    var vv = window.visualViewport;
    if (!vv) return;

    var body = document.body;
    var zoomed = false;
    var pinchTimeout = null;

    // --- Viewport zoom detection ---
    function checkZoom() {
        var isZoomed = vv.scale > 1.05;
        if (isZoomed !== zoomed) {
            zoomed = isZoomed;
            body.classList.toggle('is-viewport-zoomed', zoomed);
        }
    }

    vv.addEventListener('resize', checkZoom);
    vv.addEventListener('scroll', checkZoom);

    // --- Pinch gesture cooldown ---
    // When 2+ fingers touch the screen, mark as pinching.
    // On release, keep the class for 400ms to absorb accidental taps
    // from one finger lifting before the other.
    function onTouchStart(e) {
        if (e.touches.length >= 2) {
            clearTimeout(pinchTimeout);
            body.classList.add('is-pinch-active');
        }
    }

    function onTouchEnd(e) {
        // Still fingers down — stay in pinch mode
        if (e.touches.length >= 1 && body.classList.contains('is-pinch-active')) {
            return;
        }
        // All fingers lifted after a pinch — start cooldown
        if (body.classList.contains('is-pinch-active')) {
            clearTimeout(pinchTimeout);
            pinchTimeout = setTimeout(function () {
                body.classList.remove('is-pinch-active');
            }, 400);
        }
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    document.addEventListener('touchcancel', onTouchEnd, { passive: true });
})();
