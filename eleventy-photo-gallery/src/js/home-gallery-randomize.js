// Randomize gallery order on HOME page on each reload
// Also update hero image to use first randomized image
(function() {
    const gallery = document.querySelector('[data-gallery]');
    if (!gallery) return;

    const slides = Array.from(gallery.querySelectorAll('.gallery-slide'));
    if (slides.length <= 1) return;

    // Remove first class and overlay from all slides
    slides.forEach(slide => {
        slide.classList.remove('gallery-slide--first');
        const overlay = slide.querySelector('.gallery-slide__bokeh-overlay');
        if (overlay) {
            overlay.remove();
        }
    });

    // Fisher-Yates shuffle algorithm
    for (let i = slides.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [slides[i], slides[j]] = [slides[j], slides[i]];
    }

    // Add first class and overlay to the new first slide
    if (slides.length > 0) {
        const firstSlide = slides[0];
        firstSlide.classList.add('gallery-slide--first');
        
        // Add the bokeh overlay if it doesn't exist
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
    }

    // Re-append slides in randomized order
    const fragment = document.createDocumentFragment();
    slides.forEach(slide => fragment.appendChild(slide));
    gallery.innerHTML = '';
    gallery.appendChild(fragment);
    
    // Update hero image after randomization
    // Trigger a custom event that splash-hero.js can listen to
    gallery.dispatchEvent(new CustomEvent('galleryRandomized'));
})();

