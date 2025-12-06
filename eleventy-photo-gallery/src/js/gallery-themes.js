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
    lightboxGallery: '[data-lightbox-gallery]',
    lightboxCopy: '[data-lightbox-copy]',
    lightboxPrev: '[data-lightbox-prev]',
    lightboxNext: '[data-lightbox-next]',
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
    const { activeTag, activeLens, tagSlugMap } = state;
    const grid = document.querySelector(SELECTORS.grid);
    if (!grid) return;
    
    // If "latest" tag is selected, sort by original array position (newest items are at the end)
    if (activeTag === 'latest') {
        const fragment = document.createDocumentFragment();
        // Sort by original index in reverse order (last items first = newest first)
        // Items with dates take priority, then use original order
        const sortedItems = [...state.items].sort((a, b) => {
            const dateA = a.dataset.date || '';
            const dateB = b.dataset.date || '';
            
            // If both have valid dates, sort by date
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
            
            // For items without dates, use original array position (reverse order)
            // Newest items are at the end of the original array, so we reverse
            const indexA = state.originalOrder.indexOf(a);
            const indexB = state.originalOrder.indexOf(b);
            return indexB - indexA; // Higher index (newer) first
        });
        
        // Re-append items in sorted order
        sortedItems.forEach(item => fragment.appendChild(item));
        grid.innerHTML = '';
        grid.appendChild(fragment);
        
        // Update state.items to reflect sorted order
        state.items = sortedItems;
    } else if (state.previousTag === 'latest' && state.originalOrder) {
        // Restore original order when switching away from "latest"
        const fragment = document.createDocumentFragment();
        state.originalOrder.forEach(item => fragment.appendChild(item));
        grid.innerHTML = '';
        grid.appendChild(fragment);
        state.items = [...state.originalOrder];
    }
    
    // Store previous tag for next comparison
    state.previousTag = activeTag;
    
    // Apply filters
    state.items.forEach((item, index) => {
        const tagData = item.dataset.tags || '';
        const tagValues = tagData ? tagData.split('|') : [];
        // Convert tag values to slugs for comparison
        const tagSlugs = tagValues.map(tag => tagSlugMap.get(tag) || slugify(tag));
        const lens = item.dataset.lens || '';
        
        let matchesTag;
        if (activeTag === 'latest') {
            // For "latest", show only the first 20 items (already sorted by date)
            matchesTag = index < 20;
        } else if (activeTag === 'all') {
            matchesTag = true;
        } else {
            matchesTag = tagSlugs.includes(activeTag);
        }
        
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

    // Store original order for restoring when switching away from "latest"
    const originalOrder = [...items];
    
    const state = {
        items,
        originalOrder,
        activeTag: urlTag || 'all',
        activeLens: urlLens || 'all',
        tagSlugMap,
        previousTag: null,
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

    applyFilters(state);

    return { grid, items, state };
};

const mountLightbox = ({ items, state }) => {
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
    let previousUrl = '/gallery/';
    
    // Track current item index for navigation (only visible/filtered items)
    let currentItemIndex = -1;
    let visibleItems = [];

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

    // Get visible items (not hidden by filters)
    const getVisibleItems = () => {
        return items.filter(item => !item.hidden);
    };

    const openLightbox = (item) => {
        // Update visible items list (in case filters changed)
        visibleItems = getVisibleItems();
        
        // Find the index of the current item in visible items
        currentItemIndex = visibleItems.indexOf(item);
        
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

        // Update arrow button visibility
        updateArrowButtons();

        // Store current page as previous URL (preserve filters)
        const currentUrl = new URL(window.location.href);
        previousUrl = currentUrl.pathname + currentUrl.search;

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
        if (currentItemIndex >= visibleItems.length - 1) {
            nextBtn.style.display = 'none';
        } else {
            nextBtn.style.display = '';
        }
    };
    
    const navigateToPrevious = () => {
        if (currentItemIndex > 0) {
            const prevItem = visibleItems[currentItemIndex - 1];
            openLightbox(prevItem);
        }
    };
    
    const navigateToNext = () => {
        if (currentItemIndex < visibleItems.length - 1) {
            const nextItem = visibleItems[currentItemIndex + 1];
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

    items.forEach((item) => {
        const trigger = item.querySelector(SELECTORS.lightboxTrigger);
        if (!trigger) return;
        
        // Use click events only - they work reliably on both desktop and mobile
        // Mobile browsers fire click events after touchend, naturally preventing
        // accidental triggers during scrolling
        trigger.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            openLightbox(item);
        });
    });

    // Click/touch image to go back to previous screen (gallery with filters preserved)
    const handleImageBack = (event) => {
        event.stopPropagation();
        event.preventDefault();
        // Navigate back to previous URL (gallery with filters)
        window.location.href = previousUrl;
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

