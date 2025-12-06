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
    lightboxPrev: '[data-lightbox-prev]',
    lightboxNext: '[data-lightbox-next]',
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
    const prevBtn = lightbox.querySelector(SELECTORS.lightboxPrev);
    const nextBtn = lightbox.querySelector(SELECTORS.lightboxNext);
    const header = document.querySelector('[data-site-nav]');
    const footer = document.querySelector('footer');

    // Store the previous page URL (home or gallery)
    let previousUrl = '/';
    
    // Track current item index for navigation
    let currentItemIndex = -1;

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
        // Find the index of the current item
        currentItemIndex = items.indexOf(item);
        
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

        // Update arrow button visibility
        updateArrowButtons();

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
    
    const updateArrowButtons = () => {
        if (!prevBtn || !nextBtn) return;
        
        // Hide prev button on first item
        if (currentItemIndex <= 0) {
            prevBtn.style.display = 'none';
        } else {
            prevBtn.style.display = '';
        }
        
        // Hide next button on last item
        if (currentItemIndex >= items.length - 1) {
            nextBtn.style.display = 'none';
        } else {
            nextBtn.style.display = '';
        }
    };
    
    const navigateToPrevious = () => {
        if (currentItemIndex > 0) {
            const prevItem = items[currentItemIndex - 1];
            openLightbox(prevItem);
        }
    };
    
    const navigateToNext = () => {
        if (currentItemIndex < items.length - 1) {
            const nextItem = items[currentItemIndex + 1];
            openLightbox(nextItem);
        }
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
        } else if (event.key === 'ArrowLeft') {
            navigateToPrevious();
        } else if (event.key === 'ArrowRight') {
            navigateToNext();
        }
    };

    // Simple approach: Disable pointer events during scroll
    let scrollTimeout;
    const handleScroll = () => {
        document.body.classList.add('is-scrolling');
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            document.body.classList.remove('is-scrolling');
        }, 150);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });

    // Simple click handlers - CSS will prevent clicks during scroll
    items.forEach((item) => {
        const trigger = item.querySelector(SELECTORS.lightboxTrigger);
        if (!trigger) return;

        trigger.addEventListener('click', (event) => {
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

    // Handle previous/next navigation buttons
    if (prevBtn) {
        prevBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            navigateToPrevious();
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            navigateToNext();
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

