// Feature page navigation - return to gallery with filters preserved
(function() {
    const featureImage = document.querySelector('.feature-frame__img');
    if (!featureImage) return;

    // Check if we came from gallery (has URL parameters)
    const urlParams = new URLSearchParams(window.location.search);
    const tagFilter = urlParams.get('tag');
    const lensFilter = urlParams.get('lens');

    // Always make image clickable to return to gallery
    featureImage.style.cursor = 'pointer';
    featureImage.setAttribute('title', 'Click to return to gallery');

    featureImage.addEventListener('click', () => {
        // Build gallery URL with filters (if we came from gallery)
        const galleryUrl = new URL('/gallery/', window.location.origin);
        if (tagFilter) {
            galleryUrl.searchParams.set('tag', tagFilter);
        }
        if (lensFilter) {
            galleryUrl.searchParams.set('lens', lensFilter);
        }

        // Navigate to gallery
        window.location.href = galleryUrl.toString();
    });
})();

