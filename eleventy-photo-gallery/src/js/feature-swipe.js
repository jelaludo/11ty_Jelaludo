// Swipe navigation for feature page on mobile devices
(function() {
    // Check if device supports touch
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!isTouchDevice) return;

    const featureFrame = document.querySelector('.feature-frame');
    if (!featureFrame) return;

    const arrows = document.querySelectorAll('.feature-frame__arrow');
    const prevArrow = Array.from(arrows).find(arrow => arrow.getAttribute('aria-label') === 'Previous image' || arrow.textContent.includes('<'));
    const nextArrow = Array.from(arrows).find(arrow => arrow.getAttribute('aria-label') === 'Next image' || arrow.textContent.includes('>'));
    
    if (!prevArrow && !nextArrow) return;

    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;
    const minSwipeDistance = 50; // Minimum distance in pixels to trigger swipe

    const handleTouchStart = (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    };

    const handleTouchEnd = (e) => {
        touchEndX = e.changedTouches[0].screenX;
        touchEndY = e.changedTouches[0].screenY;
        handleSwipe();
    };

    const handleSwipe = () => {
        const deltaX = touchEndX - touchStartX;
        const deltaY = touchEndY - touchStartY;
        const absDeltaX = Math.abs(deltaX);
        const absDeltaY = Math.abs(deltaY);

        // Only trigger if horizontal swipe is greater than vertical (to avoid conflicts with scrolling)
        if (absDeltaX > absDeltaY && absDeltaX > minSwipeDistance) {
            if (deltaX > 0 && prevArrow) {
                // Swipe right - go to previous
                prevArrow.click();
            } else if (deltaX < 0 && nextArrow) {
                // Swipe left - go to next
                nextArrow.click();
            }
        }
    };

    // Add touch event listeners to the feature frame
    featureFrame.addEventListener('touchstart', handleTouchStart, { passive: true });
    featureFrame.addEventListener('touchend', handleTouchEnd, { passive: true });
})();

