const SELECTORS = {
    grid: '[data-gallery-grid]',
    items: '[data-gallery-item]',
    tagFilter: '[data-tag-filter]',
    tagFilterSelect: '[data-tag-filter-select]',
    lensFilter: '[data-lens-filter]',
    sortFilter: '[data-sort-filter]',
    lightbox: '[data-lightbox]',
    lightboxTrigger: '[data-lightbox-trigger]',
    lightboxImg: '[data-lightbox-img]',
    lightboxLink: '[data-lightbox-link]',
};

// Slugify function matching galleryThemes.js
const slugify = (value = '') =>
    value
        .toString()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-{2,}/g, '-');

const applyFilters = (state) => {
    const { items, activeTag, activeLens, tagSlugMap } = state;
    items.forEach((item) => {
        const tagData = item.dataset.tags || '';
        const tagValues = tagData ? tagData.split('|') : [];
        // Convert tag values to slugs for comparison
        const tagSlugs = tagValues.map(tag => tagSlugMap.get(tag) || slugify(tag));
        const lens = item.dataset.lens || '';
        const matchesTag = activeTag === 'all' || tagSlugs.includes(activeTag);
        const matchesLens = activeLens === 'all' || lens === activeLens;
        item.hidden = !(matchesTag && matchesLens);
    });
};

const updateActiveTag = (buttons, nextTag) => {
    buttons.forEach((button) => {
        const isActive = button.dataset.tagFilter === nextTag;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
};

const mountFilters = () => {
    const grid = document.querySelector(SELECTORS.grid);
    if (!grid) return null;

    const items = Array.from(grid.querySelectorAll(SELECTORS.items));
    const tagButtons = Array.from(document.querySelectorAll(SELECTORS.tagFilter));
    const tagSelect = document.querySelector(SELECTORS.tagFilterSelect);
    const lensSelect = document.querySelector(SELECTORS.lensFilter);
    const sortSelect = document.querySelector(SELECTORS.sortFilter);

    // Build a map from tag labels to slugs for filtering
    const tagSlugMap = new Map();
    tagButtons.forEach((button) => {
        const slug = button.dataset.tagFilter;
        const label = button.dataset.tagLabel;
        if (slug && label && slug !== 'all') {
            // Map both the original label and lowercase version to the slug
            tagSlugMap.set(label.toLowerCase(), slug);
            tagSlugMap.set(label, slug);
        }
    });
    if (tagSelect) {
        Array.from(tagSelect.options).forEach((option) => {
            const slug = option.value;
            const label = option.dataset.tagLabel;
            if (slug && label) {
                tagSlugMap.set(label.toLowerCase(), slug);
                tagSlugMap.set(label, slug);
            }
        });
    }

    // Check URL parameters for filter state (when returning from detail page)
    const urlParams = new URLSearchParams(window.location.search);
    const urlTag = urlParams.get('tag');
    const urlLens = urlParams.get('lens');

    const state = {
        items,
        activeTag: urlTag || 'all',
        activeLens: urlLens || 'all',
        sortOrder: 'default',
        tagSlugMap,
    };

    // Restore filter UI from URL parameters
    if (urlTag) {
        // Check if tag matches a button
        const matchingButton = tagButtons.find(btn => btn.dataset.tagFilter === urlTag);
        if (matchingButton) {
            updateActiveTag(tagButtons, urlTag);
            if (tagSelect) {
                tagSelect.value = '';
            }
        } else if (tagSelect) {
            // Tag might be from dropdown, check and set it
            const matchingOption = Array.from(tagSelect.options).find(opt => opt.value === urlTag);
            if (matchingOption) {
                tagSelect.value = urlTag;
                updateActiveTag(tagButtons, urlTag);
            }
        }
    }
    if (urlLens && lensSelect) {
        lensSelect.value = urlLens;
    }

    tagButtons.forEach((button) => {
        button.addEventListener('click', () => {
            const nextTag = button.dataset.tagFilter || 'all';
            state.activeTag = nextTag;
            updateActiveTag(tagButtons, nextTag);
            // Reset dropdown if a button is clicked
            if (tagSelect) {
                tagSelect.value = '';
            }
            applyFilters(state);
        });
    });

    if (tagSelect) {
        tagSelect.addEventListener('change', (event) => {
            const selectedTag = event.target.value;
            if (selectedTag) {
                state.activeTag = selectedTag;
                updateActiveTag(tagButtons, selectedTag);
                applyFilters(state);
            } else {
                // If "More tags..." placeholder is selected, reset to "all"
                state.activeTag = 'all';
                updateActiveTag(tagButtons, 'all');
                applyFilters(state);
            }
        });
    }

    if (lensSelect) {
        lensSelect.addEventListener('change', (event) => {
            state.activeLens = event.target.value || 'all';
            applyFilters(state);
        });
    }

    // Store original order for restoring default sort
    const originalOrder = [...items];
    
    // Sort functionality
    const sortItems = (order) => {
        const fragment = document.createDocumentFragment();
        let sortedItems;
        
        if (order === 'latest') {
            sortedItems = [...items].sort((a, b) => {
                const dateA = a.dataset.date || '';
                const dateB = b.dataset.date || '';
                // Parse dates if available
                if (dateA && dateB) {
                    const parsedA = new Date(dateA);
                    const parsedB = new Date(dateB);
                    if (!isNaN(parsedA.getTime()) && !isNaN(parsedB.getTime())) {
                        return parsedB - parsedA; // Latest first
                    }
                }
                // If one has a date and the other doesn't, prioritize the one with date
                if (dateA && !dateB) return -1;
                if (!dateA && dateB) return 1;
                // If dates are equal or invalid, maintain original order
                return 0;
            });
        } else {
            // Default order - restore original order
            sortedItems = [...originalOrder];
        }

        // Re-append items in sorted order
        sortedItems.forEach(item => fragment.appendChild(item));
        grid.innerHTML = ''; // Clear grid
        grid.appendChild(fragment);
        
        // Update state.items to reflect new order
        state.items = sortedItems;
    };

    if (sortSelect) {
        sortSelect.addEventListener('change', (event) => {
            state.sortOrder = event.target.value || 'default';
            sortItems(state.sortOrder);
            applyFilters(state);
        });
    }

    applyFilters(state);

    return { grid, items, state };
};

const mountLightbox = ({ items, state }) => {
    const lightbox = document.querySelector(SELECTORS.lightbox);
    if (!lightbox) return;

    const imageEl = lightbox.querySelector(SELECTORS.lightboxImg);
    const linkEl = lightbox.querySelector(SELECTORS.lightboxLink);
    const header = document.querySelector('[data-site-nav]');
    const footer = document.querySelector('footer');

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
    };

    const openLightbox = (item) => {
        const src = item.dataset.src;
        const alt = item.dataset.alt || item.dataset.title || '';
        let linkHref = item.dataset.href || '';

        if (src) {
            imageEl.src = src;
            imageEl.alt = alt;
        }

        // Store current filter state and append to detail page URL
        if (linkHref && state) {
            const urlParams = new URLSearchParams();
            if (state.activeTag && state.activeTag !== 'all') {
                urlParams.set('tag', state.activeTag);
            }
            if (state.activeLens && state.activeLens !== 'all') {
                urlParams.set('lens', state.activeLens);
            }
            const queryString = urlParams.toString();
            if (queryString) {
                linkHref += (linkHref.includes('?') ? '&' : '?') + queryString;
            }
            linkEl.href = linkHref;
        } else if (linkHref) {
            linkEl.href = linkHref;
        } else {
            linkEl.removeAttribute('href');
        }

        lightbox.classList.add('is-open');
        lightbox.removeAttribute('hidden');
        document.body.classList.add('is-lightbox-open');
        // Hide header and footer
        if (header) header.style.display = 'none';
        if (footer) footer.style.display = 'none';
    };

    const onKeyDown = (event) => {
        if (event.key === 'Escape') {
            closeLightbox();
        }
    };

    items.forEach((item) => {
        const trigger = item.querySelector(SELECTORS.lightboxTrigger);
        if (!trigger) return;
        
        // Handle both mouse clicks and touch events for mobile compatibility
        let touchHandled = false;
        
        // Touch events for mobile (iOS/Safari)
        trigger.addEventListener('touchend', (event) => {
            touchHandled = true;
            event.preventDefault();
            event.stopPropagation();
            openLightbox(item);
            // Reset flag after delay to prevent blocking future clicks
            setTimeout(() => {
                touchHandled = false;
            }, 300);
        }, { passive: false });
        
        // Click events for desktop and as fallback
        trigger.addEventListener('click', (event) => {
            // Prevent double-firing on mobile (ignore click if touch was just handled)
            if (touchHandled) {
                event.preventDefault();
                event.stopPropagation();
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            openLightbox(item);
        });
    });

    // Click/touch image to close
    const handleImageClose = (event) => {
        event.stopPropagation();
        event.preventDefault();
        closeLightbox();
    };
    imageEl.addEventListener('click', handleImageClose);
    imageEl.addEventListener('touchend', handleImageClose);

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

    document.addEventListener('keydown', onKeyDown);
};

const init = () => {
    const data = mountFilters();
    if (data) {
        mountLightbox(data);
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

