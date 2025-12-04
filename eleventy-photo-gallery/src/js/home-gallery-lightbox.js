// Home gallery lightbox functionality
const SELECTORS = {
    gallery: '[data-gallery]',
    items: '[data-gallery-item]',
    lightbox: '[data-lightbox]',
    lightboxTrigger: '[data-lightbox-trigger]',
    lightboxImg: '[data-lightbox-img]',
    lightboxLink: '[data-lightbox-link]',
    lightboxGallery: '[data-lightbox-gallery]',
    lightboxCopy: '[data-lightbox-copy]',
};

const mountHomeLightbox = () => {
    const gallery = document.querySelector(SELECTORS.gallery);
    if (!gallery) return;

    const items = Array.from(gallery.querySelectorAll(SELECTORS.items));
    const lightbox = document.querySelector(SELECTORS.lightbox);
    if (!lightbox) return;

    const imageEl = lightbox.querySelector(SELECTORS.lightboxImg);
    const linkEl = lightbox.querySelector(SELECTORS.lightboxLink);
    const copyBtn = lightbox.querySelector(SELECTORS.lightboxCopy);
    const header = document.querySelector('[data-site-nav]');
    const footer = document.querySelector('footer');

    // Store the previous page URL (home or gallery)
    let previousUrl = '/';

    const closeLightbox = () => {
        lightbox.setAttribute('hidden', '');
        lightbox.classList.remove('is-open');
        imageEl.removeAttribute('src');
        imageEl.removeAttribute('alt');
        linkEl.removeAttribute('href');
        document.body.classList.remove('is-lightbox-open');
        // Show header and footer
        if (header) header.style.display = '';
        if (footer) footer.style.display = '';
        
        // Restore scroll position if we're on home page
        if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
            try {
                const savedScroll = sessionStorage.getItem('homeGalleryScrollPosition');
                if (savedScroll !== null) {
                    const scrollY = parseInt(savedScroll, 10);
                    // Use requestAnimationFrame to ensure smooth scroll restoration
                    requestAnimationFrame(() => {
                        window.scrollTo({
                            top: scrollY,
                            behavior: 'instant'
                        });
                        // Clear stored scroll position after restoring
                        sessionStorage.removeItem('homeGalleryScrollPosition');
                    });
                }
            } catch (e) {
                console.warn('Failed to restore scroll position:', e);
            }
        }
    };

    const openLightbox = (item) => {
        const src = item.dataset.src;
        const alt = item.dataset.alt || item.dataset.title || '';
        const linkHref = item.dataset.href || '';

        if (src) {
            imageEl.src = src;
            imageEl.alt = alt;
        }

        if (linkHref) {
            linkEl.href = linkHref;
        } else {
            linkEl.removeAttribute('href');
        }

        // Store current page as previous URL
        previousUrl = window.location.pathname;

        // Store scroll position before opening lightbox
        try {
            sessionStorage.setItem('homeGalleryScrollPosition', window.scrollY.toString());
        } catch (e) {
            console.warn('Failed to store scroll position:', e);
        }

        lightbox.classList.add('is-open');
        lightbox.removeAttribute('hidden');
        document.body.classList.add('is-lightbox-open');
        // Hide header and footer
        if (header) header.style.display = 'none';
        if (footer) footer.style.display = 'none';
    };

    const copyLinkToClipboard = async () => {
        const linkHref = linkEl.getAttribute('href');
        if (!linkHref) return;

        const fullUrl = new URL(linkHref, window.location.origin).toString();
        
        try {
            await navigator.clipboard.writeText(fullUrl);
            // Visual feedback
            const originalText = copyBtn.textContent;
            copyBtn.textContent = 'Copied!';
            setTimeout(() => {
                copyBtn.textContent = originalText;
            }, 2000);
        } catch (err) {
            console.error('Failed to copy link:', err);
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = fullUrl;
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                const originalText = copyBtn.textContent;
                copyBtn.textContent = 'Copied!';
                setTimeout(() => {
                    copyBtn.textContent = originalText;
                }, 2000);
            } catch (e) {
                console.error('Fallback copy failed:', e);
            }
            document.body.removeChild(textArea);
        }
    };

    const onKeyDown = (event) => {
        if (event.key === 'Escape') {
            closeLightbox();
        }
    };

    items.forEach((item) => {
        const trigger = item.querySelector(SELECTORS.lightboxTrigger);
        if (!trigger) return;
        
        // Touch handling with robust scroll detection
        let touchStartX = 0;
        let touchStartY = 0;
        let touchStartScrollY = 0;
        let touchMoved = false;
        let touchWasScroll = false;
        let touchHandled = false;
        const tapThreshold = 10; // Maximum movement in pixels to consider it a tap
        
        // Track touch start
        trigger.addEventListener('touchstart', (event) => {
            touchStartX = event.touches[0].clientX;
            touchStartY = event.touches[0].clientY;
            touchStartScrollY = window.scrollY || window.pageYOffset;
            touchMoved = false;
            touchWasScroll = false;
            touchHandled = false;
        }, { passive: true });
        
        // Track touch movement to detect scrolling
        trigger.addEventListener('touchmove', (event) => {
            if (!touchMoved) {
                const deltaX = Math.abs(event.touches[0].clientX - touchStartX);
                const deltaY = Math.abs(event.touches[0].clientY - touchStartY);
                // If vertical movement exceeds threshold, it's likely a scroll
                if (deltaY > tapThreshold) {
                    touchMoved = true;
                    touchWasScroll = true;
                } else if (deltaX > tapThreshold || deltaY > tapThreshold) {
                    touchMoved = true;
                }
            }
        }, { passive: true });
        
        // Handle touch end - only trigger if it was a clear tap (not a scroll)
        trigger.addEventListener('touchend', (event) => {
            // Use requestAnimationFrame to check scroll after browser has processed it
            requestAnimationFrame(() => {
                const currentScrollY = window.scrollY || window.pageYOffset;
                const scrollDelta = Math.abs(currentScrollY - touchStartScrollY);
                
                // Check if page actually scrolled (most reliable indicator)
                const didScroll = scrollDelta > 5;
                
                // Only trigger if: no movement detected AND page didn't scroll
                if (!touchMoved && !touchWasScroll && !didScroll && !touchHandled) {
                    // It was a clear tap - trigger lightbox
                    touchHandled = true;
                    event.preventDefault();
                    event.stopPropagation();
                    openLightbox(item);
                    
                    // Prevent click event from firing
                    setTimeout(() => {
                        touchHandled = false;
                    }, 300);
                }
            });
        }, { passive: false });
        
        // Click events for desktop (prevent double-firing on mobile)
        trigger.addEventListener('click', (event) => {
            // On mobile, if touch was handled, ignore click
            if (touchHandled) {
                event.preventDefault();
                event.stopPropagation();
                return;
            }
            
            // Desktop click - trigger lightbox
            event.preventDefault();
            event.stopPropagation();
            openLightbox(item);
        });
    });

    // Click/touch image to close lightbox and return to home
    const handleImageBack = (event) => {
        event.stopPropagation();
        event.preventDefault();
        
        // If we're on the home page, just close the lightbox (no navigation)
        if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
            closeLightbox();
        } else {
            // If we're on gallery page, navigate back to gallery
            window.location.href = previousUrl;
        }
    };
    imageEl.addEventListener('click', handleImageBack);
    imageEl.addEventListener('touchend', handleImageBack);

    // Click/touch lightbox background to close
    const handleBackgroundClose = (event) => {
        if (event.target === lightbox) {
            event.preventDefault();
            closeLightbox();
        }
    };
    lightbox.addEventListener('click', handleBackgroundClose);
    lightbox.addEventListener('touchend', handleBackgroundClose);

    // Prevent link clicks from closing lightbox
    linkEl.addEventListener('click', (event) => {
        event.stopPropagation();
        // Link will navigate naturally
    });

    // Handle gallery button click
    const galleryBtn = lightbox.querySelector(SELECTORS.lightboxGallery);
    if (galleryBtn) {
        galleryBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            // Link will navigate naturally to /gallery/
        });
    }

    // Handle copy button click
    if (copyBtn) {
        copyBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            copyLinkToClipboard();
        });
    }

    document.addEventListener('keydown', onKeyDown);
};

const init = () => {
    mountHomeLightbox();
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

