/**
 * Detects browser-native viewport zoom (pinch-zoom on the page itself)
 * and toggles body.is-viewport-zoomed so CSS can react — e.g. disabling
 * scroll-snap that causes jump-back when the viewport is zoomed.
 *
 * Uses the Visual Viewport API (supported in all modern mobile browsers).
 */
(function () {
    var vv = window.visualViewport;
    if (!vv) return;

    var zoomed = false;

    function check() {
        // visualViewport.scale > 1 means the user has pinch-zoomed the page
        var isZoomed = vv.scale > 1.05;
        if (isZoomed !== zoomed) {
            zoomed = isZoomed;
            document.body.classList.toggle('is-viewport-zoomed', zoomed);
        }
    }

    vv.addEventListener('resize', check);
    vv.addEventListener('scroll', check);
})();
