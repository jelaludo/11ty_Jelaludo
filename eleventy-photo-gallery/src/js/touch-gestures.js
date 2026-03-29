/**
 * Touch gesture handler for lightbox views.
 * Provides: tap detection, swipe navigation, pinch-to-zoom with pan.
 * Designed for iOS Safari and mobile Chrome.
 */
const createTouchGestures = (imageEl, {
    onTap,
    onSwipeLeft,
    onSwipeRight,
    onZoomChange,
} = {}) => {
    // --- State ---
    let touchCount = 0;
    let wasMultiTouch = false;
    let touchStartTime = 0;
    let touchStartPos = null;
    let touchStartDistance = 0;

    // Zoom state
    let currentScale = 1;
    let targetScale = 1;
    let panX = 0;
    let panY = 0;
    let panStartX = 0;
    let panStartY = 0;
    let lastPanX = 0;
    let lastPanY = 0;
    let isPanning = false;
    let lastTapTime = 0;
    let animFrame = null;

    const MIN_SCALE = 1;
    const MAX_SCALE = 4;
    const SWIPE_THRESHOLD = 50;
    const SWIPE_VELOCITY_THRESHOLD = 0.3; // px/ms
    const TAP_MAX_DURATION = 300;
    const TAP_MAX_MOVEMENT = 12;
    const DOUBLE_TAP_DELAY = 300;

    // --- Helpers ---
    const getDistance = (t1, t2) => {
        const dx = t1.clientX - t2.clientX;
        const dy = t1.clientY - t2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    };

    const getMidpoint = (t1, t2) => ({
        x: (t1.clientX + t2.clientX) / 2,
        y: (t1.clientY + t2.clientY) / 2,
    });

    const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

    const applyTransform = () => {
        // Constrain pan so image doesn't fly off screen
        if (currentScale <= 1) {
            panX = 0;
            panY = 0;
        } else {
            const rect = imageEl.getBoundingClientRect();
            const imgW = rect.width / currentScale;
            const imgH = rect.height / currentScale;
            const maxPanX = (imgW * (currentScale - 1)) / 2;
            const maxPanY = (imgH * (currentScale - 1)) / 2;
            panX = clamp(panX, -maxPanX, maxPanX);
            panY = clamp(panY, -maxPanY, maxPanY);
        }
        imageEl.style.transform = `translate(${panX}px, ${panY}px) scale(${currentScale})`;
        imageEl.style.transformOrigin = 'center center';
    };

    const resetZoom = (animate = true) => {
        currentScale = 1;
        targetScale = 1;
        panX = 0;
        panY = 0;
        if (animate) {
            imageEl.style.transition = 'transform 0.3s ease';
            applyTransform();
            setTimeout(() => { imageEl.style.transition = ''; }, 300);
        } else {
            imageEl.style.transition = '';
            applyTransform();
        }
        if (onZoomChange) onZoomChange(currentScale);
    };

    const isZoomed = () => currentScale > 1.05;

    // --- Touch handlers ---
    const onTouchStart = (e) => {
        touchCount = e.touches.length;
        if (touchCount > 1) wasMultiTouch = true;

        if (touchCount === 1) {
            touchStartTime = Date.now();
            touchStartPos = {
                x: e.touches[0].clientX,
                y: e.touches[0].clientY,
            };

            if (isZoomed()) {
                // Start panning when zoomed
                isPanning = true;
                panStartX = e.touches[0].clientX - panX;
                panStartY = e.touches[0].clientY - panY;
                lastPanX = e.touches[0].clientX;
                lastPanY = e.touches[0].clientY;
                e.preventDefault();
            }
        }

        if (touchCount === 2) {
            // Pinch start
            touchStartDistance = getDistance(e.touches[0], e.touches[1]);
            targetScale = currentScale;
            e.preventDefault();
        }
    };

    const onTouchMove = (e) => {
        if (e.touches.length === 2) {
            // Pinch zoom
            const dist = getDistance(e.touches[0], e.touches[1]);
            const scaleDelta = dist / touchStartDistance;
            const newScale = clamp(targetScale * scaleDelta, MIN_SCALE * 0.8, MAX_SCALE);

            // Zoom towards midpoint
            const mid = getMidpoint(e.touches[0], e.touches[1]);
            if (currentScale !== newScale) {
                currentScale = newScale;
                imageEl.style.transition = '';
                applyTransform();
                if (onZoomChange) onZoomChange(currentScale);
            }
            e.preventDefault();
        } else if (e.touches.length === 1 && isPanning && isZoomed()) {
            // Pan while zoomed
            panX = e.touches[0].clientX - panStartX;
            panY = e.touches[0].clientY - panStartY;
            lastPanX = e.touches[0].clientX;
            lastPanY = e.touches[0].clientY;
            imageEl.style.transition = '';
            applyTransform();
            e.preventDefault();
        }
    };

    const onTouchEnd = (e) => {
        const endTime = Date.now();
        const remaining = e.touches.length;

        // If fingers are still down, update distance for continued pinch
        if (remaining === 1 && touchCount === 2) {
            // Went from 2 fingers to 1 — reset single-touch tracking
            touchStartPos = {
                x: e.touches[0].clientX,
                y: e.touches[0].clientY,
            };
            touchStartTime = endTime;
            touchStartDistance = 0;
            isPanning = true;
            panStartX = e.touches[0].clientX - panX;
            panStartY = e.touches[0].clientY - panY;
            touchCount = 1;
            return;
        }

        if (remaining > 0) {
            touchCount = remaining;
            return;
        }

        // All fingers lifted
        const wasPinch = wasMultiTouch;
        const prevTouchCount = touchCount;
        touchCount = 0;
        wasMultiTouch = false;
        isPanning = false;

        // After pinch, snap scale
        if (wasPinch) {
            if (currentScale < MIN_SCALE + 0.1) {
                resetZoom(true);
            } else {
                currentScale = clamp(currentScale, MIN_SCALE, MAX_SCALE);
                applyTransform();
                if (onZoomChange) onZoomChange(currentScale);
            }
            return; // Never trigger tap/swipe after pinch
        }

        // Single finger gesture ended
        if (prevTouchCount !== 1 || !touchStartPos) return;

        const changedTouch = e.changedTouches[0];
        if (!changedTouch) return;

        const dx = changedTouch.clientX - touchStartPos.x;
        const dy = changedTouch.clientY - touchStartPos.y;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        const duration = endTime - touchStartTime;
        const velocity = absDx / duration;

        // If zoomed, don't process swipes or taps for nav
        if (isZoomed()) {
            // Double-tap to reset zoom
            if (absDx < TAP_MAX_MOVEMENT && absDy < TAP_MAX_MOVEMENT && duration < TAP_MAX_DURATION) {
                const now = endTime;
                if (now - lastTapTime < DOUBLE_TAP_DELAY) {
                    resetZoom(true);
                    lastTapTime = 0;
                    return;
                }
                lastTapTime = now;
            }
            return;
        }

        // Horizontal swipe detection (only when not zoomed)
        if (absDx > SWIPE_THRESHOLD && absDx > absDy * 1.5 && velocity > SWIPE_VELOCITY_THRESHOLD) {
            if (dx < 0 && onSwipeLeft) {
                onSwipeLeft();
            } else if (dx > 0 && onSwipeRight) {
                onSwipeRight();
            }
            return;
        }

        // Tap detection
        if (absDx < TAP_MAX_MOVEMENT && absDy < TAP_MAX_MOVEMENT && duration < TAP_MAX_DURATION) {
            const now = endTime;
            // Double-tap to zoom in
            if (now - lastTapTime < DOUBLE_TAP_DELAY) {
                lastTapTime = 0;
                currentScale = 2.5;
                // Zoom towards tap point
                const rect = imageEl.getBoundingClientRect();
                const cx = rect.left + rect.width / 2;
                const cy = rect.top + rect.height / 2;
                panX = (cx - changedTouch.clientX) * 0.8;
                panY = (cy - changedTouch.clientY) * 0.8;
                imageEl.style.transition = 'transform 0.3s ease';
                applyTransform();
                setTimeout(() => { imageEl.style.transition = ''; }, 300);
                if (onZoomChange) onZoomChange(currentScale);
                return;
            }

            // Wait for possible double-tap before firing single tap
            lastTapTime = now;
            const tapTimer = setTimeout(() => {
                if (lastTapTime === now && onTap) {
                    onTap(e);
                }
            }, DOUBLE_TAP_DELAY);
            return;
        }
    };

    // Safari gesture events (more precise on iOS)
    let gestureStartScale = 1;
    const onGestureStart = (e) => {
        e.preventDefault();
        gestureStartScale = currentScale;
    };
    const onGestureChange = (e) => {
        e.preventDefault();
        currentScale = clamp(gestureStartScale * e.scale, MIN_SCALE * 0.8, MAX_SCALE);
        imageEl.style.transition = '';
        applyTransform();
        if (onZoomChange) onZoomChange(currentScale);
    };
    const onGestureEnd = (e) => {
        e.preventDefault();
        if (currentScale < MIN_SCALE + 0.1) {
            resetZoom(true);
        } else {
            currentScale = clamp(currentScale, MIN_SCALE, MAX_SCALE);
            applyTransform();
        }
    };

    // --- Bind ---
    imageEl.addEventListener('touchstart', onTouchStart, { passive: false });
    imageEl.addEventListener('touchmove', onTouchMove, { passive: false });
    imageEl.addEventListener('touchend', onTouchEnd, { passive: false });
    imageEl.addEventListener('gesturestart', onGestureStart, { passive: false });
    imageEl.addEventListener('gesturechange', onGestureChange, { passive: false });
    imageEl.addEventListener('gestureend', onGestureEnd, { passive: false });

    // --- Public API ---
    return {
        resetZoom,
        isZoomed,
        destroy: () => {
            imageEl.removeEventListener('touchstart', onTouchStart);
            imageEl.removeEventListener('touchmove', onTouchMove);
            imageEl.removeEventListener('touchend', onTouchEnd);
            imageEl.removeEventListener('gesturestart', onGestureStart);
            imageEl.removeEventListener('gesturechange', onGestureChange);
            imageEl.removeEventListener('gestureend', onGestureEnd);
            if (animFrame) cancelAnimationFrame(animFrame);
            resetZoom(false);
        },
    };
};

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.createTouchGestures = createTouchGestures;
}
