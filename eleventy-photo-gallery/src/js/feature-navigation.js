// Feature page navigation - return to gallery with filters preserved
// Integrates with touch-gestures.js for mobile pinch-zoom, swipe, and tap
(function() {
    const featureImage = document.querySelector('.feature-frame__img');
    if (!featureImage) return;

    const mediaContainer = document.querySelector('.feature-frame__media');

    // Check if we came from gallery (has URL parameters)
    const urlParams = new URLSearchParams(window.location.search);
    const tagFilter = urlParams.get('tag');
    const lensFilter = urlParams.get('lens');

    const navigateToGallery = () => {
        const galleryUrl = new URL('/gallery/', window.location.origin);
        if (tagFilter) galleryUrl.searchParams.set('tag', tagFilter);
        if (lensFilter) galleryUrl.searchParams.set('lens', lensFilter);
        window.location.href = galleryUrl.toString();
    };

    // Find prev/next links from the arrow navigation
    const prevLink = document.querySelector('.feature-frame__arrow[href][aria-label*="Previous"]');
    const nextLink = document.querySelector('.feature-frame__arrow[href][aria-label*="Next"]');

    // Always make image clickable to return to gallery
    featureImage.style.cursor = 'pointer';
    featureImage.setAttribute('title', 'Click to return to gallery');

    if (window.createTouchGestures) {
        // Use managed touch gestures — prevents zoom-release from navigating
        featureImage.style.touchAction = 'none';

        window.createTouchGestures(featureImage, {
            onTap: () => navigateToGallery(),
            onSwipeLeft: () => { if (nextLink) window.location.href = nextLink.href; },
            onSwipeRight: () => { if (prevLink) window.location.href = prevLink.href; },
            onZoomChange: (scale) => {
                // Allow zoomed image to overflow its container
                if (mediaContainer) {
                    mediaContainer.style.overflow = scale > 1.05 ? 'visible' : '';
                }
            },
        });

        // Desktop click still works (touch-gestures only handles touch events)
        // On touch devices, taps are handled by createTouchGestures, so skip
        // the click to avoid double-firing
        if (!('ontouchstart' in window)) {
            featureImage.addEventListener('click', () => navigateToGallery());
        }
    } else {
        // Fallback: simple click handler (no touch-gestures loaded)
        featureImage.addEventListener('click', () => navigateToGallery());
    }
})();
