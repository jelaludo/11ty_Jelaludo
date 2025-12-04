// Randomize gallery order on HOME page - persist order in sessionStorage
// Also update hero image to use first randomized image
(function() {
    const STORAGE_KEY = 'homeGalleryOrder';
    const gallery = document.querySelector('[data-gallery]');
    if (!gallery) return;

    const slides = Array.from(gallery.querySelectorAll('.gallery-slide'));
    if (slides.length <= 1) return;

    // Get image titles from current slides
    const getImageTitles = (slideList) => {
        return slideList.map(slide => {
            // The slide itself has the data-gallery-item attribute
            return slide.dataset.title || null;
        }).filter(title => title !== null);
    };

    // Create a map of title to slide element
    const createSlideMap = (slideList) => {
        const map = new Map();
        slideList.forEach(slide => {
            // The slide itself has the data-gallery-item attribute
            if (slide.dataset.title) {
                map.set(slide.dataset.title, slide);
            }
        });
        return map;
    };

    // Remove first class and overlay from all slides
    const resetSlides = () => {
        slides.forEach(slide => {
            slide.classList.remove('gallery-slide--first');
            const overlay = slide.querySelector('.gallery-slide__bokeh-overlay');
            if (overlay) {
                overlay.remove();
            }
        });
    };

    // Fisher-Yates shuffle algorithm
    const shuffleSlides = (slideList) => {
        const shuffled = [...slideList];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    };

    // Reorder slides based on stored order
    const reorderSlides = (slideList, orderedTitles) => {
        const slideMap = createSlideMap(slideList);
        const orderedSlides = [];
        const usedTitles = new Set();

        // Add slides in stored order
        orderedTitles.forEach(title => {
            const slide = slideMap.get(title);
            if (slide && !usedTitles.has(title)) {
                orderedSlides.push(slide);
                usedTitles.add(title);
            }
        });

        // Add any remaining slides that weren't in stored order (new images)
        slideList.forEach(slide => {
            // The slide itself has the data-gallery-item attribute
            const title = slide.dataset.title || null;
            if (title && !usedTitles.has(title)) {
                orderedSlides.push(slide);
            }
        });

        return orderedSlides;
    };

    // Add first class and overlay to the first slide
    const setupFirstSlide = (firstSlide) => {
        if (!firstSlide) return;
        firstSlide.classList.add('gallery-slide--first');
        
        const link = firstSlide.querySelector('.gallery-slide__link');
        if (link && !link.querySelector('.gallery-slide__bokeh-overlay')) {
            const overlay = document.createElement('div');
            overlay.className = 'gallery-slide__bokeh-overlay';
            overlay.innerHTML = `
                <p class="gallery-slide__cta">
                    <span class="gallery-slide__cta-line">Scroll to</span>
                    <span class="gallery-slide__cta-line">Explore</span>
                </p>
            `;
            link.appendChild(overlay);
        }
    };

    // Store order in sessionStorage
    const storeOrder = (orderedTitles) => {
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(orderedTitles));
        } catch (e) {
            console.warn('Failed to store gallery order:', e);
        }
    };

    // Get stored order from sessionStorage
    const getStoredOrder = () => {
        try {
            const stored = sessionStorage.getItem(STORAGE_KEY);
            return stored ? JSON.parse(stored) : null;
        } catch (e) {
            console.warn('Failed to retrieve gallery order:', e);
            return null;
        }
    };

    // Validate stored order matches current gallery
    const validateStoredOrder = (storedTitles, currentTitles) => {
        if (!storedTitles || !Array.isArray(storedTitles)) return false;
        if (storedTitles.length !== currentTitles.length) return false;
        
        // Check if all stored titles exist in current gallery
        const currentTitleSet = new Set(currentTitles);
        return storedTitles.every(title => currentTitleSet.has(title));
    };

    resetSlides();

    const currentTitles = getImageTitles(slides);
    const storedOrder = getStoredOrder();
    let orderedSlides;

    // Check if we have a valid stored order
    if (storedOrder && validateStoredOrder(storedOrder, currentTitles)) {
        // Restore stored order
        orderedSlides = reorderSlides(slides, storedOrder);
    } else {
        // Randomize and store new order
        orderedSlides = shuffleSlides(slides);
        const newOrder = getImageTitles(orderedSlides);
        storeOrder(newOrder);
    }

    // Safety check: ensure we have slides to display
    if (!orderedSlides || orderedSlides.length === 0) {
        console.warn('No slides to display, aborting reorder');
        return;
    }

    // Setup first slide
    setupFirstSlide(orderedSlides[0]);

    // Re-append slides in order
    const fragment = document.createDocumentFragment();
    orderedSlides.forEach(slide => fragment.appendChild(slide));
    gallery.innerHTML = '';
    gallery.appendChild(fragment);
    
    // Restore scroll position if available
    try {
        const savedScroll = sessionStorage.getItem('homeGalleryScrollPosition');
        if (savedScroll !== null) {
            const scrollY = parseInt(savedScroll, 10);
            // Use requestAnimationFrame to ensure DOM is ready
            requestAnimationFrame(() => {
                window.scrollTo(0, scrollY);
                // Clear stored scroll position after restoring
                sessionStorage.removeItem('homeGalleryScrollPosition');
            });
        }
    } catch (e) {
        console.warn('Failed to restore scroll position:', e);
    }
    
    // Update hero image after reordering
    // Trigger a custom event that splash-hero.js can listen to
    gallery.dispatchEvent(new CustomEvent('galleryRandomized'));
})();

