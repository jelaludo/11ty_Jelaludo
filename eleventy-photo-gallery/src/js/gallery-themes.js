const SELECTORS = {
    grid: '[data-gallery-grid]',
    items: '[data-gallery-item]',
    tagFilter: '[data-tag-filter]',
    tagFilterSelect: '[data-tag-filter-select]',
    lensFilter: '[data-lens-filter]',
    lightbox: '[data-lightbox]',
    lightboxTrigger: '[data-lightbox-trigger]',
    lightboxClose: '[data-lightbox-close]',
    lightboxImg: '[data-lightbox-img]',
    lightboxTitle: '[data-lightbox-title]',
    lightboxTags: '[data-lightbox-tags]',
    lightboxLens: '[data-lightbox-lens]',
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

    const state = {
        items,
        activeTag: 'all',
        activeLens: 'all',
        tagSlugMap,
    };

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

    return { grid, items };
};

const mountLightbox = ({ items }) => {
    const lightbox = document.querySelector(SELECTORS.lightbox);
    if (!lightbox) return;

    const closeButton = lightbox.querySelector(SELECTORS.lightboxClose);
    const imageEl = lightbox.querySelector(SELECTORS.lightboxImg);
    const titleEl = lightbox.querySelector(SELECTORS.lightboxTitle);
    const tagsEl = lightbox.querySelector(SELECTORS.lightboxTags);
    const lensEl = lightbox.querySelector(SELECTORS.lightboxLens);
    const linkEl = lightbox.querySelector(SELECTORS.lightboxLink);

    const closeLightbox = () => {
        lightbox.setAttribute('hidden', '');
        lightbox.classList.remove('is-open');
        imageEl.removeAttribute('src');
        imageEl.removeAttribute('alt');
        linkEl.removeAttribute('href');
        document.body.classList.remove('is-lightbox-open');
    };

    const openLightbox = (item) => {
        const src = item.dataset.src;
        const title = item.dataset.title || '';
        const alt = item.dataset.alt || title;
        const tags = item.dataset.tagLabels || '';
        const lensLabel = item.querySelector('.themes-gallery__lens-name')?.textContent || '';
        const linkHref = item.dataset.href || '';

        if (src) {
            imageEl.src = src;
            imageEl.alt = alt;
        }

        if (lensLabel) {
            lensEl.textContent = lensLabel;
            lensEl.removeAttribute('hidden');
        } else {
            lensEl.textContent = '';
            lensEl.setAttribute('hidden', '');
        }
        titleEl.textContent = title;
        tagsEl.textContent = tags;
        lensEl.textContent = lensLabel;
        if (linkHref) {
            linkEl.href = linkHref;
            linkEl.removeAttribute('hidden');
        } else {
            linkEl.removeAttribute('href');
            linkEl.setAttribute('hidden', '');
        }

        lightbox.classList.add('is-open');
        lightbox.removeAttribute('hidden');
        document.body.classList.add('is-lightbox-open');
        closeButton.focus({ preventScroll: true });
    };

    const onKeyDown = (event) => {
        if (event.key === 'Escape') {
            closeLightbox();
        }
    };

    items.forEach((item) => {
        const trigger = item.querySelector(SELECTORS.lightboxTrigger);
        if (!trigger) return;
        trigger.addEventListener('click', () => openLightbox(item));
    });

    closeButton.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', (event) => {
        if (event.target === lightbox) {
            closeLightbox();
        }
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

