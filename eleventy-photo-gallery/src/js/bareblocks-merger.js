// ============================================================
// IMAGE MERGER — mobile-first progressive reveal
// ============================================================

// ── State ──────────────────────────────────────────────────
let mergeItems = [];
// Each item: { file, dataUrl, img, width, height, imageOffsetX, imageOffsetY }

let selectedTemplateId = null;
let imageFit        = 'cover'; // 'contain' | 'cover' | 'fill'
let spacing         = 6;         // px — gap + outer frame
let cornerRadius    = 0;         // px — cell corner rounding
let frameColor      = '#0d1117';
let outputScale     = 1.0;

// Image-pan state (cover mode drag)
let isPanningImage  = false;
let panCellIndex    = -1;
let panStartX       = 0;
let panStartY       = 0;
let panLastX        = 0;
let panLastY        = 0;
let panMoved        = false;

// Click-to-swap state
let selectedCellIndex = -1;

// ── State machine ───────────────────────────────────────────
function setState(state) {
    // state: 'empty' | 'loaded'
    document.getElementById('merger-dropzone').hidden = (state !== 'empty');
    document.getElementById('merger-loaded').hidden   = (state === 'empty');
}

function toggleAdvanced() {
    const panel  = document.getElementById('merger-advanced');
    const toggle = document.getElementById('merger-advanced-toggle');
    const icon   = document.getElementById('merger-toggle-icon');
    const isOpen = !panel.hidden;

    panel.hidden = isOpen;
    toggle.setAttribute('aria-expanded', String(!isOpen));
    icon.classList.toggle('open', !isOpen);
}

// ── Boot ────────────────────────────────────────────────────
function initMerger() {
    const dropzone   = document.getElementById('merger-dropzone');
    const fileInput  = document.getElementById('merger-file-input');
    const addBtn     = document.getElementById('merger-add-btn');
    const addInput   = document.getElementById('merger-add-input');
    const clearBtn   = document.getElementById('merger-clear-btn');
    const advToggle  = document.getElementById('merger-advanced-toggle');
    const dlBtn      = document.getElementById('merger-download-btn');

    if (!dropzone) return; // tab not on page

    // Drop zone click + drag
    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover',  e => { e.preventDefault(); dropzone.classList.add('drag-over'); });
    dropzone.addEventListener('dragleave', e => { if (e.target === dropzone) dropzone.classList.remove('drag-over'); });
    dropzone.addEventListener('drop', e => {
        e.preventDefault();
        dropzone.classList.remove('drag-over');
        handleFiles(e.dataTransfer.files);
    });

    fileInput.addEventListener('change', e => handleFiles(e.target.files));

    // Add more
    addBtn.addEventListener('click', () => addInput.click());
    addInput.addEventListener('change', e => handleFiles(e.target.files));

    // Clear
    clearBtn.addEventListener('click', () => {
        mergeItems = [];
        selectedTemplateId = null;
        selectedCellIndex  = -1;
        setState('empty');
    });

    // Advanced toggle
    advToggle.addEventListener('click', toggleAdvanced);

    // Download
    dlBtn.addEventListener('click', openDownloadModal);

    // Advanced controls
    wireAdvancedControls();

    // Modal
    wireModal();

    // Image pan (cover mode)
    wirePan();

    // Initial state
    setState('empty');
}

// ── File handling ────────────────────────────────────────────
async function handleFiles(files) {
    if (!files || files.length === 0) return;

    const promises = Array.from(files)
        .filter(f => f.type.startsWith('image/'))
        .map(file => loadImageFile(file));

    const loaded = await Promise.all(promises);
    loaded.forEach(item => { if (item) mergeItems.push(item); });

    if (mergeItems.length === 0) return;

    // On first load, pick default template for count
    if (selectedTemplateId === null || !templateFitsCount(selectedTemplateId, mergeItems.length)) {
        selectedTemplateId = defaultTemplateFor(mergeItems.length);
    }

    selectedCellIndex = -1;
    setState('loaded');
    renderTemplateStrip();
    updatePreview();
    updateDownloadButton();
}

function loadImageFile(file) {
    return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = e => {
            const img = new Image();
            img.onload = () => resolve({
                file,
                dataUrl: e.target.result,
                img,
                width:  img.width,
                height: img.height,
                imageOffsetX: 50,
                imageOffsetY: 50
            });
            img.onerror = () => resolve(null);
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// ── Layout builders (keep as-is from original) ──────────────
function buildGridLayout(count, columns) {
    const rows = Math.max(1, Math.ceil(count / columns));
    const cells = [];
    for (let index = 0; index < count; index++) {
        const row = Math.floor(index / columns);
        const col = index % columns;
        cells.push({ index, row, col, rowSpan: 1, colSpan: 1 });
    }
    return { columns, rows, cells };
}

function buildHeroLeftLayout(count) {
    if (count < 3) return null;
    if (count > 4) return null;
    if (count === 3) {
        return {
            columns: 3,
            rows: 2,
            cells: [
                { index: 0, row: 0, col: 0, rowSpan: 2, colSpan: 2 },
                { index: 1, row: 0, col: 2, rowSpan: 1, colSpan: 1 },
                { index: 2, row: 1, col: 2, rowSpan: 1, colSpan: 1 }
            ]
        };
    }
    return {
        columns: 3,
        rows: 3,
        cells: [
            { index: 0, row: 0, col: 0, rowSpan: 3, colSpan: 2 },
            { index: 1, row: 0, col: 2, rowSpan: 1, colSpan: 1 },
            { index: 2, row: 1, col: 2, rowSpan: 1, colSpan: 1 },
            { index: 3, row: 2, col: 2, rowSpan: 1, colSpan: 1 }
        ]
    };
}

function buildHeroRightLayout(count) {
    if (count < 3) return null;
    if (count > 4) return null;
    if (count === 3) {
        return {
            columns: 3,
            rows: 2,
            cells: [
                { index: 0, row: 0, col: 1, rowSpan: 2, colSpan: 2 },
                { index: 1, row: 0, col: 0, rowSpan: 1, colSpan: 1 },
                { index: 2, row: 1, col: 0, rowSpan: 1, colSpan: 1 }
            ]
        };
    }
    return {
        columns: 3,
        rows: 3,
        cells: [
            { index: 0, row: 0, col: 1, rowSpan: 3, colSpan: 2 },
            { index: 1, row: 0, col: 0, rowSpan: 1, colSpan: 1 },
            { index: 2, row: 1, col: 0, rowSpan: 1, colSpan: 1 },
            { index: 3, row: 2, col: 0, rowSpan: 1, colSpan: 1 }
        ]
    };
}

function buildHeroTopLayout(count) {
    if (count < 3) return null;
    if (count > 4) return null;
    if (count === 3) {
        return {
            columns: 3,
            rows: 2,
            cells: [
                { index: 0, row: 0, col: 0, rowSpan: 1, colSpan: 3 },
                { index: 1, row: 1, col: 0, rowSpan: 1, colSpan: 1 },
                { index: 2, row: 1, col: 1, rowSpan: 1, colSpan: 1 }
            ]
        };
    }
    return {
        columns: 3,
        rows: 2,
        cells: [
            { index: 0, row: 0, col: 0, rowSpan: 1, colSpan: 3 },
            { index: 1, row: 1, col: 0, rowSpan: 1, colSpan: 1 },
            { index: 2, row: 1, col: 1, rowSpan: 1, colSpan: 1 },
            { index: 3, row: 1, col: 2, rowSpan: 1, colSpan: 1 }
        ]
    };
}

function buildHeroBottomLayout(count) {
    if (count < 3) return null;
    if (count > 4) return null;
    if (count === 3) {
        return {
            columns: 3,
            rows: 2,
            cells: [
                { index: 0, row: 1, col: 0, rowSpan: 1, colSpan: 3 },
                { index: 1, row: 0, col: 0, rowSpan: 1, colSpan: 1 },
                { index: 2, row: 0, col: 1, rowSpan: 1, colSpan: 1 }
            ]
        };
    }
    return {
        columns: 3,
        rows: 2,
        cells: [
            { index: 0, row: 1, col: 0, rowSpan: 1, colSpan: 3 },
            { index: 1, row: 0, col: 0, rowSpan: 1, colSpan: 1 },
            { index: 2, row: 0, col: 1, rowSpan: 1, colSpan: 1 },
            { index: 3, row: 0, col: 2, rowSpan: 1, colSpan: 1 }
        ]
    };
}

function buildSpotlightLayout(count) {
    if (count !== 3) return null;
    return {
        columns: 2,
        rows: 2,
        cells: [
            { index: 0, row: 0, col: 0, rowSpan: 2, colSpan: 1 },
            { index: 1, row: 0, col: 1, rowSpan: 1, colSpan: 1 },
            { index: 2, row: 1, col: 1, rowSpan: 1, colSpan: 1 }
        ]
    };
}

function buildSplitLayout(count) {
    if (count !== 4) return null;
    return {
        columns: 3,
        rows: 2,
        cells: [
            { index: 0, row: 0, col: 0, rowSpan: 1, colSpan: 2 },
            { index: 1, row: 0, col: 2, rowSpan: 1, colSpan: 1 },
            { index: 2, row: 1, col: 0, rowSpan: 1, colSpan: 1 },
            { index: 3, row: 1, col: 1, rowSpan: 1, colSpan: 2 }
        ]
    };
}

function getClipPolygonArray(type) {
    if (type === 'diag-left') {
        return [[0, 0], [1, 0], [0, 1]];
    }
    if (type === 'diag-right') {
        return [[1, 0], [1, 1], [0, 1]];
    }
    if (type === 'hex') {
        return [[0.5, 0.06], [0.9, 0.28], [0.9, 0.72], [0.5, 0.94], [0.1, 0.72], [0.1, 0.28]];
    }
    if (type === 'heart') {
        return [[0.5, 0.92], [0.15, 0.58], [0.08, 0.35], [0.22, 0.18], [0.38, 0.18], [0.5, 0.3], [0.62, 0.18], [0.78, 0.18], [0.92, 0.35], [0.85, 0.58]];
    }
    return null;
}

function getClipPolygonPoints(type) {
    const points = getClipPolygonArray(type);
    if (!points) return null;
    return points.map(point => `${point[0] * 100}% ${point[1] * 100}%`).join(', ');
}

function extendLayoutWithOverflow(layout, count) {
    if (!layout || count <= layout.cells.length) {
        return layout;
    }
    const extraCount = count - layout.cells.length;
    const extraRows = Math.ceil(extraCount / layout.columns);
    const startRow = layout.rows;
    const extraCells = [];
    for (let i = 0; i < extraCount; i++) {
        const row = startRow + Math.floor(i / layout.columns);
        const col = i % layout.columns;
        extraCells.push({ index: layout.cells.length + i, row, col, rowSpan: 1, colSpan: 1 });
    }
    return {
        columns: layout.columns,
        rows: layout.rows + extraRows,
        cells: layout.cells.concat(extraCells)
    };
}

// ── Template library ─────────────────────────────────────────
const templateLibrary = [
    {
        id: 'split-vertical',
        minImages: 2,
        maxImages: 2,
        layout: () => buildGridLayout(2, 2),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="6" y="6" width="40" height="88" rx="3"/><rect x="54" y="6" width="40" height="88" rx="3"/></svg>'
    },
    {
        id: 'split-horizontal',
        minImages: 2,
        maxImages: 2,
        layout: () => buildGridLayout(2, 1),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="6" y="6" width="88" height="40" rx="3"/><rect x="6" y="54" width="88" height="40" rx="3"/></svg>'
    },
    {
        id: 'hero-left',
        minImages: 3,
        maxImages: 4,
        layout: (count) => buildHeroLeftLayout(count),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="6" y="6" width="58" height="88" rx="3"/><rect x="70" y="6" width="24" height="40" rx="3"/><rect x="70" y="54" width="24" height="40" rx="3"/></svg>'
    },
    {
        id: 'hero-right',
        minImages: 3,
        maxImages: 4,
        layout: (count) => buildHeroRightLayout(count),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="36" y="6" width="58" height="88" rx="3"/><rect x="6" y="6" width="24" height="40" rx="3"/><rect x="6" y="54" width="24" height="40" rx="3"/></svg>'
    },
    {
        id: 'hero-top',
        minImages: 3,
        maxImages: 4,
        layout: (count) => buildHeroTopLayout(count),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="6" y="6" width="88" height="42" rx="3"/><rect x="6" y="54" width="26" height="40" rx="3"/><rect x="37" y="54" width="26" height="40" rx="3"/><rect x="68" y="54" width="26" height="40" rx="3"/></svg>'
    },
    {
        id: 'hero-bottom',
        minImages: 3,
        maxImages: 4,
        layout: (count) => buildHeroBottomLayout(count),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="6" y="6" width="26" height="40" rx="3"/><rect x="37" y="6" width="26" height="40" rx="3"/><rect x="68" y="6" width="26" height="40" rx="3"/><rect x="6" y="54" width="88" height="40" rx="3"/></svg>'
    },
    {
        id: 'spotlight',
        minImages: 3,
        maxImages: 3,
        layout: (count) => buildSpotlightLayout(count),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="6" y="6" width="44" height="88" rx="3"/><rect x="56" y="6" width="38" height="40" rx="3"/><rect x="56" y="54" width="38" height="40" rx="3"/></svg>'
    },
    {
        id: 'split-mix',
        minImages: 4,
        maxImages: 4,
        layout: (count) => buildSplitLayout(count),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="6" y="6" width="56" height="40" rx="3"/><rect x="66" y="6" width="28" height="40" rx="3"/><rect x="6" y="54" width="28" height="40" rx="3"/><rect x="38" y="54" width="56" height="40" rx="3"/></svg>'
    },
    {
        id: 'quad-grid',
        minImages: 4,
        maxImages: 4,
        layout: () => buildGridLayout(4, 2),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="6" y="6" width="40" height="40" rx="3"/><rect x="54" y="6" width="40" height="40" rx="3"/><rect x="6" y="54" width="40" height="40" rx="3"/><rect x="54" y="54" width="40" height="40" rx="3"/></svg>'
    },
    {
        id: 'diagonal-split',
        minImages: 2,
        maxImages: 2,
        layout: () => ({
            columns: 2,
            rows: 1,
            cells: [
                { index: 0, row: 0, col: 0, rowSpan: 1, colSpan: 1, clip: 'diag-left' },
                { index: 1, row: 0, col: 1, rowSpan: 1, colSpan: 1, clip: 'diag-right' }
            ]
        }),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><polygon points="6,6 94,6 6,94" /><polygon points="94,6 94,94 6,94" /></svg>'
    },
    {
        id: 'hex-focus',
        minImages: 1,
        maxImages: 1,
        layout: () => ({
            columns: 1,
            rows: 1,
            cells: [
                { index: 0, row: 0, col: 0, rowSpan: 1, colSpan: 1, clip: 'hex' }
            ]
        }),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><polygon points="50,8 90,30 90,70 50,92 10,70 10,30"/></svg>'
    },
    {
        id: 'heart-focus',
        minImages: 1,
        maxImages: 1,
        layout: () => ({
            columns: 1,
            rows: 1,
            cells: [
                { index: 0, row: 0, col: 0, rowSpan: 1, colSpan: 1, clip: 'heart' }
            ]
        }),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><path d="M50 86 L18 54 C8 44 8 28 22 20 C32 14 44 18 50 28 C56 18 68 14 78 20 C92 28 92 44 82 54 Z"/></svg>'
    },

    // ── Count-specific layouts (5–10) ────────────────────────────────

    // COUNT 5
    {
        id: 'hero-5',
        minImages: 5,
        maxImages: 5,
        layout: () => ({
            columns: 4, rows: 2,
            cells: [
                { index: 0, row: 0, col: 0, rowSpan: 2, colSpan: 2 },
                { index: 1, row: 0, col: 2, rowSpan: 1, colSpan: 1 },
                { index: 2, row: 0, col: 3, rowSpan: 1, colSpan: 1 },
                { index: 3, row: 1, col: 2, rowSpan: 1, colSpan: 1 },
                { index: 4, row: 1, col: 3, rowSpan: 1, colSpan: 1 }
            ]
        }),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="6" y="6" width="42" height="88" rx="3"/><rect x="52" y="6" width="19" height="41" rx="3"/><rect x="75" y="6" width="19" height="41" rx="3"/><rect x="52" y="53" width="19" height="41" rx="3"/><rect x="75" y="53" width="19" height="41" rx="3"/></svg>'
    },
    {
        id: 'panorama-top-5',
        minImages: 5,
        maxImages: 5,
        layout: () => ({
            columns: 4, rows: 2,
            cells: [
                { index: 0, row: 0, col: 0, rowSpan: 1, colSpan: 4 },
                { index: 1, row: 1, col: 0, rowSpan: 1, colSpan: 1 },
                { index: 2, row: 1, col: 1, rowSpan: 1, colSpan: 1 },
                { index: 3, row: 1, col: 2, rowSpan: 1, colSpan: 1 },
                { index: 4, row: 1, col: 3, rowSpan: 1, colSpan: 1 }
            ]
        }),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="6" y="6" width="88" height="41" rx="3"/><rect x="6" y="53" width="19" height="41" rx="3"/><rect x="29" y="53" width="19" height="41" rx="3"/><rect x="52" y="53" width="19" height="41" rx="3"/><rect x="75" y="53" width="19" height="41" rx="3"/></svg>'
    },
    {
        id: 'panorama-bottom-5',
        minImages: 5,
        maxImages: 5,
        layout: () => ({
            columns: 4, rows: 2,
            cells: [
                { index: 0, row: 1, col: 0, rowSpan: 1, colSpan: 4 },
                { index: 1, row: 0, col: 0, rowSpan: 1, colSpan: 1 },
                { index: 2, row: 0, col: 1, rowSpan: 1, colSpan: 1 },
                { index: 3, row: 0, col: 2, rowSpan: 1, colSpan: 1 },
                { index: 4, row: 0, col: 3, rowSpan: 1, colSpan: 1 }
            ]
        }),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="6" y="6" width="19" height="41" rx="3"/><rect x="29" y="6" width="19" height="41" rx="3"/><rect x="52" y="6" width="19" height="41" rx="3"/><rect x="75" y="6" width="19" height="41" rx="3"/><rect x="6" y="53" width="88" height="41" rx="3"/></svg>'
    },
    {
        id: 'featured-5',
        minImages: 5,
        maxImages: 5,
        layout: () => ({
            columns: 4, rows: 3,
            cells: [
                { index: 0, row: 0, col: 0, rowSpan: 2, colSpan: 2 },
                { index: 1, row: 0, col: 2, rowSpan: 1, colSpan: 2 },
                { index: 2, row: 1, col: 2, rowSpan: 1, colSpan: 1 },
                { index: 3, row: 1, col: 3, rowSpan: 1, colSpan: 1 },
                { index: 4, row: 2, col: 0, rowSpan: 1, colSpan: 4 }
            ]
        }),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="6" y="6" width="42" height="57" rx="3"/><rect x="52" y="6" width="42" height="26" rx="3"/><rect x="52" y="37" width="19" height="26" rx="3"/><rect x="75" y="37" width="19" height="26" rx="3"/><rect x="6" y="68" width="88" height="26" rx="3"/></svg>'
    },
    {
        id: 't-shape-5',
        minImages: 5,
        maxImages: 5,
        layout: () => ({
            columns: 3, rows: 2,
            cells: [
                { index: 0, row: 0, col: 0, rowSpan: 1, colSpan: 1 },
                { index: 1, row: 0, col: 1, rowSpan: 1, colSpan: 1 },
                { index: 2, row: 0, col: 2, rowSpan: 1, colSpan: 1 },
                { index: 3, row: 1, col: 0, rowSpan: 1, colSpan: 2 },
                { index: 4, row: 1, col: 2, rowSpan: 1, colSpan: 1 }
            ]
        }),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="6" y="6" width="26" height="41" rx="3"/><rect x="37" y="6" width="26" height="41" rx="3"/><rect x="68" y="6" width="26" height="41" rx="3"/><rect x="6" y="53" width="57" height="41" rx="3"/><rect x="68" y="53" width="26" height="41" rx="3"/></svg>'
    },
    {
        id: 'tall-strip-5',
        minImages: 5,
        maxImages: 5,
        layout: () => ({
            columns: 3, rows: 3,
            cells: [
                { index: 0, row: 0, col: 0, rowSpan: 3, colSpan: 1 },
                { index: 1, row: 0, col: 1, rowSpan: 1, colSpan: 2 },
                { index: 2, row: 1, col: 1, rowSpan: 1, colSpan: 1 },
                { index: 3, row: 1, col: 2, rowSpan: 1, colSpan: 1 },
                { index: 4, row: 2, col: 1, rowSpan: 1, colSpan: 2 }
            ]
        }),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="6" y="6" width="26" height="88" rx="3"/><rect x="37" y="6" width="57" height="26" rx="3"/><rect x="37" y="37" width="26" height="26" rx="3"/><rect x="68" y="37" width="26" height="26" rx="3"/><rect x="37" y="68" width="57" height="26" rx="3"/></svg>'
    },
    {
        id: 'row-5',
        minImages: 5,
        maxImages: 5,
        layout: () => buildGridLayout(5, 5),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="6" y="6" width="16" height="88" rx="3"/><rect x="24" y="6" width="16" height="88" rx="3"/><rect x="42" y="6" width="16" height="88" rx="3"/><rect x="60" y="6" width="16" height="88" rx="3"/><rect x="78" y="6" width="16" height="88" rx="3"/></svg>'
    },

    // COUNT 6
    {
        id: 'hero-tl-6',
        minImages: 6,
        maxImages: 6,
        layout: () => ({
            columns: 3, rows: 3,
            cells: [
                { index: 0, row: 0, col: 0, rowSpan: 2, colSpan: 2 },
                { index: 1, row: 0, col: 2, rowSpan: 1, colSpan: 1 },
                { index: 2, row: 1, col: 2, rowSpan: 1, colSpan: 1 },
                { index: 3, row: 2, col: 0, rowSpan: 1, colSpan: 1 },
                { index: 4, row: 2, col: 1, rowSpan: 1, colSpan: 1 },
                { index: 5, row: 2, col: 2, rowSpan: 1, colSpan: 1 }
            ]
        }),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="6" y="6" width="57" height="57" rx="3"/><rect x="68" y="6" width="26" height="26" rx="3"/><rect x="68" y="37" width="26" height="26" rx="3"/><rect x="6" y="68" width="26" height="26" rx="3"/><rect x="37" y="68" width="26" height="26" rx="3"/><rect x="68" y="68" width="26" height="26" rx="3"/></svg>'
    },
    {
        id: 'hero-tr-6',
        minImages: 6,
        maxImages: 6,
        layout: () => ({
            columns: 3, rows: 3,
            cells: [
                { index: 0, row: 0, col: 1, rowSpan: 2, colSpan: 2 },
                { index: 1, row: 0, col: 0, rowSpan: 1, colSpan: 1 },
                { index: 2, row: 1, col: 0, rowSpan: 1, colSpan: 1 },
                { index: 3, row: 2, col: 0, rowSpan: 1, colSpan: 1 },
                { index: 4, row: 2, col: 1, rowSpan: 1, colSpan: 1 },
                { index: 5, row: 2, col: 2, rowSpan: 1, colSpan: 1 }
            ]
        }),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="37" y="6" width="57" height="57" rx="3"/><rect x="6" y="6" width="26" height="26" rx="3"/><rect x="6" y="37" width="26" height="26" rx="3"/><rect x="6" y="68" width="26" height="26" rx="3"/><rect x="37" y="68" width="26" height="26" rx="3"/><rect x="68" y="68" width="26" height="26" rx="3"/></svg>'
    },
    {
        id: 'tall-left-6',
        minImages: 6,
        maxImages: 6,
        layout: () => ({
            columns: 3, rows: 3,
            cells: [
                { index: 0, row: 0, col: 0, rowSpan: 3, colSpan: 1 },
                { index: 1, row: 0, col: 1, rowSpan: 1, colSpan: 2 },
                { index: 2, row: 1, col: 1, rowSpan: 1, colSpan: 1 },
                { index: 3, row: 1, col: 2, rowSpan: 1, colSpan: 1 },
                { index: 4, row: 2, col: 1, rowSpan: 1, colSpan: 1 },
                { index: 5, row: 2, col: 2, rowSpan: 1, colSpan: 1 }
            ]
        }),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="6" y="6" width="26" height="88" rx="3"/><rect x="37" y="6" width="57" height="26" rx="3"/><rect x="37" y="37" width="26" height="26" rx="3"/><rect x="68" y="37" width="26" height="26" rx="3"/><rect x="37" y="68" width="26" height="26" rx="3"/><rect x="68" y="68" width="26" height="26" rx="3"/></svg>'
    },
    {
        id: 'tall-right-6',
        minImages: 6,
        maxImages: 6,
        layout: () => ({
            columns: 3, rows: 3,
            cells: [
                { index: 0, row: 0, col: 2, rowSpan: 3, colSpan: 1 },
                { index: 1, row: 0, col: 0, rowSpan: 1, colSpan: 2 },
                { index: 2, row: 1, col: 0, rowSpan: 1, colSpan: 1 },
                { index: 3, row: 1, col: 1, rowSpan: 1, colSpan: 1 },
                { index: 4, row: 2, col: 0, rowSpan: 1, colSpan: 1 },
                { index: 5, row: 2, col: 1, rowSpan: 1, colSpan: 1 }
            ]
        }),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="68" y="6" width="26" height="88" rx="3"/><rect x="6" y="6" width="57" height="26" rx="3"/><rect x="6" y="37" width="26" height="26" rx="3"/><rect x="37" y="37" width="26" height="26" rx="3"/><rect x="6" y="68" width="26" height="26" rx="3"/><rect x="37" y="68" width="26" height="26" rx="3"/></svg>'
    },
    {
        id: 'panorama-top-6',
        minImages: 6,
        maxImages: 6,
        layout: () => ({
            columns: 5, rows: 2,
            cells: [
                { index: 0, row: 0, col: 0, rowSpan: 1, colSpan: 5 },
                { index: 1, row: 1, col: 0, rowSpan: 1, colSpan: 1 },
                { index: 2, row: 1, col: 1, rowSpan: 1, colSpan: 1 },
                { index: 3, row: 1, col: 2, rowSpan: 1, colSpan: 1 },
                { index: 4, row: 1, col: 3, rowSpan: 1, colSpan: 1 },
                { index: 5, row: 1, col: 4, rowSpan: 1, colSpan: 1 }
            ]
        }),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="6" y="6" width="88" height="41" rx="3"/><rect x="6" y="53" width="16" height="41" rx="3"/><rect x="24" y="53" width="16" height="41" rx="3"/><rect x="42" y="53" width="16" height="41" rx="3"/><rect x="60" y="53" width="16" height="41" rx="3"/><rect x="78" y="53" width="16" height="41" rx="3"/></svg>'
    },
    {
        id: 'panorama-bottom-6',
        minImages: 6,
        maxImages: 6,
        layout: () => ({
            columns: 5, rows: 2,
            cells: [
                { index: 0, row: 1, col: 0, rowSpan: 1, colSpan: 5 },
                { index: 1, row: 0, col: 0, rowSpan: 1, colSpan: 1 },
                { index: 2, row: 0, col: 1, rowSpan: 1, colSpan: 1 },
                { index: 3, row: 0, col: 2, rowSpan: 1, colSpan: 1 },
                { index: 4, row: 0, col: 3, rowSpan: 1, colSpan: 1 },
                { index: 5, row: 0, col: 4, rowSpan: 1, colSpan: 1 }
            ]
        }),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="6" y="6" width="16" height="41" rx="3"/><rect x="24" y="6" width="16" height="41" rx="3"/><rect x="42" y="6" width="16" height="41" rx="3"/><rect x="60" y="6" width="16" height="41" rx="3"/><rect x="78" y="6" width="16" height="41" rx="3"/><rect x="6" y="53" width="88" height="41" rx="3"/></svg>'
    },
    {
        id: 'mosaic-6',
        minImages: 6,
        maxImages: 6,
        layout: () => ({
            columns: 4, rows: 3,
            cells: [
                { index: 0, row: 0, col: 0, rowSpan: 2, colSpan: 2 },
                { index: 1, row: 0, col: 2, rowSpan: 1, colSpan: 1 },
                { index: 2, row: 0, col: 3, rowSpan: 1, colSpan: 1 },
                { index: 3, row: 1, col: 2, rowSpan: 1, colSpan: 2 },
                { index: 4, row: 2, col: 0, rowSpan: 1, colSpan: 2 },
                { index: 5, row: 2, col: 2, rowSpan: 1, colSpan: 2 }
            ]
        }),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="6" y="6" width="42" height="57" rx="3"/><rect x="52" y="6" width="19" height="26" rx="3"/><rect x="75" y="6" width="19" height="26" rx="3"/><rect x="52" y="37" width="42" height="26" rx="3"/><rect x="6" y="68" width="42" height="26" rx="3"/><rect x="52" y="68" width="42" height="26" rx="3"/></svg>'
    },
    {
        id: 'double-hero-6',
        minImages: 6,
        maxImages: 6,
        layout: () => ({
            columns: 4, rows: 3,
            cells: [
                { index: 0, row: 0, col: 0, rowSpan: 2, colSpan: 2 },
                { index: 1, row: 0, col: 2, rowSpan: 2, colSpan: 2 },
                { index: 2, row: 2, col: 0, rowSpan: 1, colSpan: 1 },
                { index: 3, row: 2, col: 1, rowSpan: 1, colSpan: 1 },
                { index: 4, row: 2, col: 2, rowSpan: 1, colSpan: 1 },
                { index: 5, row: 2, col: 3, rowSpan: 1, colSpan: 1 }
            ]
        }),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="6" y="6" width="42" height="57" rx="3"/><rect x="52" y="6" width="42" height="57" rx="3"/><rect x="6" y="68" width="19" height="26" rx="3"/><rect x="29" y="68" width="19" height="26" rx="3"/><rect x="52" y="68" width="19" height="26" rx="3"/><rect x="75" y="68" width="19" height="26" rx="3"/></svg>'
    },
    {
        id: 'diptych-6',
        minImages: 6,
        maxImages: 6,
        layout: () => ({
            columns: 4, rows: 2,
            cells: [
                { index: 0, row: 0, col: 0, rowSpan: 1, colSpan: 2 },
                { index: 1, row: 0, col: 2, rowSpan: 1, colSpan: 2 },
                { index: 2, row: 1, col: 0, rowSpan: 1, colSpan: 1 },
                { index: 3, row: 1, col: 1, rowSpan: 1, colSpan: 1 },
                { index: 4, row: 1, col: 2, rowSpan: 1, colSpan: 1 },
                { index: 5, row: 1, col: 3, rowSpan: 1, colSpan: 1 }
            ]
        }),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="6" y="6" width="42" height="41" rx="3"/><rect x="52" y="6" width="42" height="41" rx="3"/><rect x="6" y="53" width="19" height="41" rx="3"/><rect x="29" y="53" width="19" height="41" rx="3"/><rect x="52" y="53" width="19" height="41" rx="3"/><rect x="75" y="53" width="19" height="41" rx="3"/></svg>'
    },
    {
        id: 'panorama-mid-6',
        minImages: 6,
        maxImages: 6,
        layout: () => ({
            columns: 3, rows: 3,
            cells: [
                { index: 0, row: 0, col: 0, rowSpan: 1, colSpan: 1 },
                { index: 1, row: 0, col: 1, rowSpan: 1, colSpan: 1 },
                { index: 2, row: 0, col: 2, rowSpan: 1, colSpan: 1 },
                { index: 3, row: 1, col: 0, rowSpan: 1, colSpan: 3 },
                { index: 4, row: 2, col: 0, rowSpan: 1, colSpan: 2 },
                { index: 5, row: 2, col: 2, rowSpan: 1, colSpan: 1 }
            ]
        }),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="6" y="6" width="26" height="26" rx="3"/><rect x="37" y="6" width="26" height="26" rx="3"/><rect x="68" y="6" width="26" height="26" rx="3"/><rect x="6" y="37" width="88" height="26" rx="3"/><rect x="6" y="68" width="57" height="26" rx="3"/><rect x="68" y="68" width="26" height="26" rx="3"/></svg>'
    },
    {
        id: 'mosaic-alt-6',
        minImages: 6,
        maxImages: 6,
        layout: () => ({
            columns: 4, rows: 3,
            cells: [
                { index: 0, row: 0, col: 0, rowSpan: 1, colSpan: 2 },
                { index: 1, row: 0, col: 2, rowSpan: 1, colSpan: 2 },
                { index: 2, row: 1, col: 0, rowSpan: 2, colSpan: 1 },
                { index: 3, row: 1, col: 1, rowSpan: 2, colSpan: 1 },
                { index: 4, row: 1, col: 2, rowSpan: 1, colSpan: 2 },
                { index: 5, row: 2, col: 2, rowSpan: 1, colSpan: 2 }
            ]
        }),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="6" y="6" width="42" height="26" rx="3"/><rect x="52" y="6" width="42" height="26" rx="3"/><rect x="6" y="37" width="19" height="57" rx="3"/><rect x="29" y="37" width="19" height="57" rx="3"/><rect x="52" y="37" width="42" height="26" rx="3"/><rect x="52" y="68" width="42" height="26" rx="3"/></svg>'
    },

    // COUNT 7
    {
        id: 'hero-tl-7',
        minImages: 7,
        maxImages: 7,
        layout: () => ({
            columns: 4, rows: 3,
            cells: [
                { index: 0, row: 0, col: 0, rowSpan: 2, colSpan: 2 },
                { index: 1, row: 0, col: 2, rowSpan: 1, colSpan: 1 },
                { index: 2, row: 0, col: 3, rowSpan: 1, colSpan: 1 },
                { index: 3, row: 1, col: 2, rowSpan: 1, colSpan: 1 },
                { index: 4, row: 1, col: 3, rowSpan: 1, colSpan: 1 },
                { index: 5, row: 2, col: 0, rowSpan: 1, colSpan: 2 },
                { index: 6, row: 2, col: 2, rowSpan: 1, colSpan: 2 }
            ]
        }),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="6" y="6" width="42" height="57" rx="3"/><rect x="52" y="6" width="19" height="26" rx="3"/><rect x="75" y="6" width="19" height="26" rx="3"/><rect x="52" y="37" width="19" height="26" rx="3"/><rect x="75" y="37" width="19" height="26" rx="3"/><rect x="6" y="68" width="42" height="26" rx="3"/><rect x="52" y="68" width="42" height="26" rx="3"/></svg>'
    },
    {
        id: 'panorama-top-7',
        minImages: 7,
        maxImages: 7,
        layout: () => ({
            columns: 3, rows: 3,
            cells: [
                { index: 0, row: 0, col: 0, rowSpan: 1, colSpan: 3 },
                { index: 1, row: 1, col: 0, rowSpan: 1, colSpan: 1 },
                { index: 2, row: 1, col: 1, rowSpan: 1, colSpan: 1 },
                { index: 3, row: 1, col: 2, rowSpan: 1, colSpan: 1 },
                { index: 4, row: 2, col: 0, rowSpan: 1, colSpan: 1 },
                { index: 5, row: 2, col: 1, rowSpan: 1, colSpan: 1 },
                { index: 6, row: 2, col: 2, rowSpan: 1, colSpan: 1 }
            ]
        }),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="6" y="6" width="88" height="26" rx="3"/><rect x="6" y="37" width="26" height="26" rx="3"/><rect x="37" y="37" width="26" height="26" rx="3"/><rect x="68" y="37" width="26" height="26" rx="3"/><rect x="6" y="68" width="26" height="26" rx="3"/><rect x="37" y="68" width="26" height="26" rx="3"/><rect x="68" y="68" width="26" height="26" rx="3"/></svg>'
    },
    {
        id: 'tall-strip-7',
        minImages: 7,
        maxImages: 7,
        layout: () => ({
            columns: 3, rows: 3,
            cells: [
                { index: 0, row: 0, col: 0, rowSpan: 3, colSpan: 1 },
                { index: 1, row: 0, col: 1, rowSpan: 1, colSpan: 1 },
                { index: 2, row: 0, col: 2, rowSpan: 1, colSpan: 1 },
                { index: 3, row: 1, col: 1, rowSpan: 1, colSpan: 1 },
                { index: 4, row: 1, col: 2, rowSpan: 1, colSpan: 1 },
                { index: 5, row: 2, col: 1, rowSpan: 1, colSpan: 1 },
                { index: 6, row: 2, col: 2, rowSpan: 1, colSpan: 1 }
            ]
        }),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="6" y="6" width="26" height="88" rx="3"/><rect x="37" y="6" width="26" height="26" rx="3"/><rect x="68" y="6" width="26" height="26" rx="3"/><rect x="37" y="37" width="26" height="26" rx="3"/><rect x="68" y="37" width="26" height="26" rx="3"/><rect x="37" y="68" width="26" height="26" rx="3"/><rect x="68" y="68" width="26" height="26" rx="3"/></svg>'
    },
    {
        id: 'mosaic-7',
        minImages: 7,
        maxImages: 7,
        layout: () => ({
            columns: 4, rows: 3,
            cells: [
                { index: 0, row: 0, col: 0, rowSpan: 2, colSpan: 2 },
                { index: 1, row: 0, col: 2, rowSpan: 1, colSpan: 2 },
                { index: 2, row: 1, col: 2, rowSpan: 1, colSpan: 1 },
                { index: 3, row: 1, col: 3, rowSpan: 1, colSpan: 1 },
                { index: 4, row: 2, col: 0, rowSpan: 1, colSpan: 1 },
                { index: 5, row: 2, col: 1, rowSpan: 1, colSpan: 1 },
                { index: 6, row: 2, col: 2, rowSpan: 1, colSpan: 2 }
            ]
        }),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="6" y="6" width="42" height="57" rx="3"/><rect x="52" y="6" width="42" height="26" rx="3"/><rect x="52" y="37" width="19" height="26" rx="3"/><rect x="75" y="37" width="19" height="26" rx="3"/><rect x="6" y="68" width="19" height="26" rx="3"/><rect x="29" y="68" width="19" height="26" rx="3"/><rect x="52" y="68" width="42" height="26" rx="3"/></svg>'
    },
    {
        id: 'three-two-two-7',
        minImages: 7,
        maxImages: 7,
        layout: () => ({
            columns: 3, rows: 3,
            cells: [
                { index: 0, row: 0, col: 0, rowSpan: 1, colSpan: 1 },
                { index: 1, row: 0, col: 1, rowSpan: 1, colSpan: 1 },
                { index: 2, row: 0, col: 2, rowSpan: 1, colSpan: 1 },
                { index: 3, row: 1, col: 0, rowSpan: 1, colSpan: 2 },
                { index: 4, row: 1, col: 2, rowSpan: 1, colSpan: 1 },
                { index: 5, row: 2, col: 0, rowSpan: 1, colSpan: 1 },
                { index: 6, row: 2, col: 1, rowSpan: 1, colSpan: 2 }
            ]
        }),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="6" y="6" width="26" height="26" rx="3"/><rect x="37" y="6" width="26" height="26" rx="3"/><rect x="68" y="6" width="26" height="26" rx="3"/><rect x="6" y="37" width="57" height="26" rx="3"/><rect x="68" y="37" width="26" height="26" rx="3"/><rect x="6" y="68" width="26" height="26" rx="3"/><rect x="37" y="68" width="57" height="26" rx="3"/></svg>'
    },

    // COUNT 8
    {
        id: 'hero-tl-8',
        minImages: 8,
        maxImages: 8,
        layout: () => ({
            columns: 4, rows: 3,
            cells: [
                { index: 0, row: 0, col: 0, rowSpan: 2, colSpan: 2 },
                { index: 1, row: 0, col: 2, rowSpan: 1, colSpan: 1 },
                { index: 2, row: 0, col: 3, rowSpan: 1, colSpan: 1 },
                { index: 3, row: 1, col: 2, rowSpan: 1, colSpan: 1 },
                { index: 4, row: 1, col: 3, rowSpan: 1, colSpan: 1 },
                { index: 5, row: 2, col: 0, rowSpan: 1, colSpan: 1 },
                { index: 6, row: 2, col: 1, rowSpan: 1, colSpan: 2 },
                { index: 7, row: 2, col: 3, rowSpan: 1, colSpan: 1 }
            ]
        }),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="6" y="6" width="42" height="57" rx="3"/><rect x="52" y="6" width="19" height="26" rx="3"/><rect x="75" y="6" width="19" height="26" rx="3"/><rect x="52" y="37" width="19" height="26" rx="3"/><rect x="75" y="37" width="19" height="26" rx="3"/><rect x="6" y="68" width="19" height="26" rx="3"/><rect x="29" y="68" width="42" height="26" rx="3"/><rect x="75" y="68" width="19" height="26" rx="3"/></svg>'
    },
    {
        id: 'panorama-top-8',
        minImages: 8,
        maxImages: 8,
        layout: () => ({
            columns: 4, rows: 3,
            cells: [
                { index: 0, row: 0, col: 0, rowSpan: 1, colSpan: 4 },
                { index: 1, row: 1, col: 0, rowSpan: 1, colSpan: 2 },
                { index: 2, row: 1, col: 2, rowSpan: 1, colSpan: 1 },
                { index: 3, row: 1, col: 3, rowSpan: 1, colSpan: 1 },
                { index: 4, row: 2, col: 0, rowSpan: 1, colSpan: 1 },
                { index: 5, row: 2, col: 1, rowSpan: 1, colSpan: 1 },
                { index: 6, row: 2, col: 2, rowSpan: 1, colSpan: 1 },
                { index: 7, row: 2, col: 3, rowSpan: 1, colSpan: 1 }
            ]
        }),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="6" y="6" width="88" height="26" rx="3"/><rect x="6" y="37" width="42" height="26" rx="3"/><rect x="52" y="37" width="19" height="26" rx="3"/><rect x="75" y="37" width="19" height="26" rx="3"/><rect x="6" y="68" width="19" height="26" rx="3"/><rect x="29" y="68" width="19" height="26" rx="3"/><rect x="52" y="68" width="19" height="26" rx="3"/><rect x="75" y="68" width="19" height="26" rx="3"/></svg>'
    },
    {
        id: 'tall-left-8',
        minImages: 8,
        maxImages: 8,
        layout: () => ({
            columns: 4, rows: 3,
            cells: [
                { index: 0, row: 0, col: 0, rowSpan: 3, colSpan: 1 },
                { index: 1, row: 0, col: 1, rowSpan: 1, colSpan: 3 },
                { index: 2, row: 1, col: 1, rowSpan: 1, colSpan: 1 },
                { index: 3, row: 1, col: 2, rowSpan: 1, colSpan: 1 },
                { index: 4, row: 1, col: 3, rowSpan: 1, colSpan: 1 },
                { index: 5, row: 2, col: 1, rowSpan: 1, colSpan: 1 },
                { index: 6, row: 2, col: 2, rowSpan: 1, colSpan: 1 },
                { index: 7, row: 2, col: 3, rowSpan: 1, colSpan: 1 }
            ]
        }),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="6" y="6" width="19" height="88" rx="3"/><rect x="29" y="6" width="65" height="26" rx="3"/><rect x="29" y="37" width="19" height="26" rx="3"/><rect x="52" y="37" width="19" height="26" rx="3"/><rect x="75" y="37" width="19" height="26" rx="3"/><rect x="29" y="68" width="19" height="26" rx="3"/><rect x="52" y="68" width="19" height="26" rx="3"/><rect x="75" y="68" width="19" height="26" rx="3"/></svg>'
    },
    {
        id: 'mosaic-8',
        minImages: 8,
        maxImages: 8,
        layout: () => ({
            columns: 4, rows: 3,
            cells: [
                { index: 0, row: 0, col: 0, rowSpan: 2, colSpan: 2 },
                { index: 1, row: 0, col: 2, rowSpan: 1, colSpan: 1 },
                { index: 2, row: 0, col: 3, rowSpan: 1, colSpan: 1 },
                { index: 3, row: 1, col: 2, rowSpan: 1, colSpan: 2 },
                { index: 4, row: 2, col: 0, rowSpan: 1, colSpan: 1 },
                { index: 5, row: 2, col: 1, rowSpan: 1, colSpan: 1 },
                { index: 6, row: 2, col: 2, rowSpan: 1, colSpan: 1 },
                { index: 7, row: 2, col: 3, rowSpan: 1, colSpan: 1 }
            ]
        }),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="6" y="6" width="42" height="57" rx="3"/><rect x="52" y="6" width="19" height="26" rx="3"/><rect x="75" y="6" width="19" height="26" rx="3"/><rect x="52" y="37" width="42" height="26" rx="3"/><rect x="6" y="68" width="19" height="26" rx="3"/><rect x="29" y="68" width="19" height="26" rx="3"/><rect x="52" y="68" width="19" height="26" rx="3"/><rect x="75" y="68" width="19" height="26" rx="3"/></svg>'
    },
    {
        id: 'double-panorama-8',
        minImages: 8,
        maxImages: 8,
        layout: () => ({
            columns: 3, rows: 4,
            cells: [
                { index: 0, row: 0, col: 0, rowSpan: 1, colSpan: 3 },
                { index: 1, row: 1, col: 0, rowSpan: 1, colSpan: 1 },
                { index: 2, row: 1, col: 1, rowSpan: 1, colSpan: 1 },
                { index: 3, row: 1, col: 2, rowSpan: 1, colSpan: 1 },
                { index: 4, row: 2, col: 0, rowSpan: 1, colSpan: 1 },
                { index: 5, row: 2, col: 1, rowSpan: 1, colSpan: 1 },
                { index: 6, row: 2, col: 2, rowSpan: 1, colSpan: 1 },
                { index: 7, row: 3, col: 0, rowSpan: 1, colSpan: 3 }
            ]
        }),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="6" y="6" width="88" height="19" rx="2"/><rect x="6" y="29" width="26" height="19" rx="2"/><rect x="37" y="29" width="26" height="19" rx="2"/><rect x="68" y="29" width="26" height="19" rx="2"/><rect x="6" y="52" width="26" height="19" rx="2"/><rect x="37" y="52" width="26" height="19" rx="2"/><rect x="68" y="52" width="26" height="19" rx="2"/><rect x="6" y="75" width="88" height="19" rx="2"/></svg>'
    },

    // COUNT 9
    {
        id: 'hero-tl-9',
        minImages: 9,
        maxImages: 9,
        layout: () => ({
            columns: 4, rows: 3,
            cells: [
                { index: 0, row: 0, col: 0, rowSpan: 2, colSpan: 2 },
                { index: 1, row: 0, col: 2, rowSpan: 1, colSpan: 1 },
                { index: 2, row: 0, col: 3, rowSpan: 1, colSpan: 1 },
                { index: 3, row: 1, col: 2, rowSpan: 1, colSpan: 1 },
                { index: 4, row: 1, col: 3, rowSpan: 1, colSpan: 1 },
                { index: 5, row: 2, col: 0, rowSpan: 1, colSpan: 1 },
                { index: 6, row: 2, col: 1, rowSpan: 1, colSpan: 1 },
                { index: 7, row: 2, col: 2, rowSpan: 1, colSpan: 1 },
                { index: 8, row: 2, col: 3, rowSpan: 1, colSpan: 1 }
            ]
        }),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="6" y="6" width="42" height="57" rx="3"/><rect x="52" y="6" width="19" height="26" rx="3"/><rect x="75" y="6" width="19" height="26" rx="3"/><rect x="52" y="37" width="19" height="26" rx="3"/><rect x="75" y="37" width="19" height="26" rx="3"/><rect x="6" y="68" width="19" height="26" rx="3"/><rect x="29" y="68" width="19" height="26" rx="3"/><rect x="52" y="68" width="19" height="26" rx="3"/><rect x="75" y="68" width="19" height="26" rx="3"/></svg>'
    },
    {
        id: 'banner-top-9',
        minImages: 9,
        maxImages: 9,
        layout: () => ({
            columns: 4, rows: 3,
            cells: [
                { index: 0, row: 0, col: 0, rowSpan: 1, colSpan: 4 },
                { index: 1, row: 1, col: 0, rowSpan: 1, colSpan: 1 },
                { index: 2, row: 1, col: 1, rowSpan: 1, colSpan: 1 },
                { index: 3, row: 1, col: 2, rowSpan: 1, colSpan: 1 },
                { index: 4, row: 1, col: 3, rowSpan: 1, colSpan: 1 },
                { index: 5, row: 2, col: 0, rowSpan: 1, colSpan: 1 },
                { index: 6, row: 2, col: 1, rowSpan: 1, colSpan: 1 },
                { index: 7, row: 2, col: 2, rowSpan: 1, colSpan: 1 },
                { index: 8, row: 2, col: 3, rowSpan: 1, colSpan: 1 }
            ]
        }),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="6" y="6" width="88" height="26" rx="3"/><rect x="6" y="37" width="19" height="26" rx="3"/><rect x="29" y="37" width="19" height="26" rx="3"/><rect x="52" y="37" width="19" height="26" rx="3"/><rect x="75" y="37" width="19" height="26" rx="3"/><rect x="6" y="68" width="19" height="26" rx="3"/><rect x="29" y="68" width="19" height="26" rx="3"/><rect x="52" y="68" width="19" height="26" rx="3"/><rect x="75" y="68" width="19" height="26" rx="3"/></svg>'
    },
    {
        id: 'asymmetric-9',
        minImages: 9,
        maxImages: 9,
        layout: () => ({
            columns: 4, rows: 3,
            cells: [
                { index: 0, row: 0, col: 0, rowSpan: 1, colSpan: 2 },
                { index: 1, row: 0, col: 2, rowSpan: 1, colSpan: 1 },
                { index: 2, row: 0, col: 3, rowSpan: 1, colSpan: 1 },
                { index: 3, row: 1, col: 0, rowSpan: 2, colSpan: 1 },
                { index: 4, row: 1, col: 1, rowSpan: 1, colSpan: 2 },
                { index: 5, row: 1, col: 3, rowSpan: 1, colSpan: 1 },
                { index: 6, row: 2, col: 1, rowSpan: 1, colSpan: 1 },
                { index: 7, row: 2, col: 2, rowSpan: 1, colSpan: 1 },
                { index: 8, row: 2, col: 3, rowSpan: 1, colSpan: 1 }
            ]
        }),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="6" y="6" width="42" height="26" rx="3"/><rect x="52" y="6" width="19" height="26" rx="3"/><rect x="75" y="6" width="19" height="26" rx="3"/><rect x="6" y="37" width="19" height="57" rx="3"/><rect x="29" y="37" width="42" height="26" rx="3"/><rect x="75" y="37" width="19" height="26" rx="3"/><rect x="29" y="68" width="19" height="26" rx="3"/><rect x="52" y="68" width="19" height="26" rx="3"/><rect x="75" y="68" width="19" height="26" rx="3"/></svg>'
    },

    // COUNT 10
    {
        id: 'panorama-top-10',
        minImages: 10,
        maxImages: 10,
        layout: () => ({
            columns: 3, rows: 4,
            cells: [
                { index: 0, row: 0, col: 0, rowSpan: 1, colSpan: 3 },
                { index: 1, row: 1, col: 0, rowSpan: 1, colSpan: 1 },
                { index: 2, row: 1, col: 1, rowSpan: 1, colSpan: 1 },
                { index: 3, row: 1, col: 2, rowSpan: 1, colSpan: 1 },
                { index: 4, row: 2, col: 0, rowSpan: 1, colSpan: 1 },
                { index: 5, row: 2, col: 1, rowSpan: 1, colSpan: 1 },
                { index: 6, row: 2, col: 2, rowSpan: 1, colSpan: 1 },
                { index: 7, row: 3, col: 0, rowSpan: 1, colSpan: 1 },
                { index: 8, row: 3, col: 1, rowSpan: 1, colSpan: 1 },
                { index: 9, row: 3, col: 2, rowSpan: 1, colSpan: 1 }
            ]
        }),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="6" y="6" width="88" height="19" rx="2"/><rect x="6" y="29" width="26" height="19" rx="2"/><rect x="37" y="29" width="26" height="19" rx="2"/><rect x="68" y="29" width="26" height="19" rx="2"/><rect x="6" y="52" width="26" height="19" rx="2"/><rect x="37" y="52" width="26" height="19" rx="2"/><rect x="68" y="52" width="26" height="19" rx="2"/><rect x="6" y="75" width="26" height="19" rx="2"/><rect x="37" y="75" width="26" height="19" rx="2"/><rect x="68" y="75" width="26" height="19" rx="2"/></svg>'
    },
    {
        id: 'hero-tl-10',
        minImages: 10,
        maxImages: 10,
        layout: () => ({
            columns: 5, rows: 3,
            cells: [
                { index: 0, row: 0, col: 0, rowSpan: 2, colSpan: 2 },
                { index: 1, row: 0, col: 2, rowSpan: 1, colSpan: 1 },
                { index: 2, row: 0, col: 3, rowSpan: 1, colSpan: 1 },
                { index: 3, row: 0, col: 4, rowSpan: 1, colSpan: 1 },
                { index: 4, row: 1, col: 2, rowSpan: 1, colSpan: 1 },
                { index: 5, row: 1, col: 3, rowSpan: 1, colSpan: 1 },
                { index: 6, row: 1, col: 4, rowSpan: 1, colSpan: 1 },
                { index: 7, row: 2, col: 0, rowSpan: 1, colSpan: 2 },
                { index: 8, row: 2, col: 2, rowSpan: 1, colSpan: 1 },
                { index: 9, row: 2, col: 3, rowSpan: 1, colSpan: 2 }
            ]
        }),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="6" y="6" width="34" height="57" rx="3"/><rect x="42" y="6" width="16" height="26" rx="3"/><rect x="60" y="6" width="16" height="26" rx="3"/><rect x="78" y="6" width="16" height="26" rx="3"/><rect x="42" y="37" width="16" height="26" rx="3"/><rect x="60" y="37" width="16" height="26" rx="3"/><rect x="78" y="37" width="16" height="26" rx="3"/><rect x="6" y="68" width="34" height="26" rx="3"/><rect x="42" y="68" width="16" height="26" rx="3"/><rect x="60" y="68" width="34" height="26" rx="3"/></svg>'
    },
    {
        id: 'mosaic-10',
        minImages: 10,
        maxImages: 10,
        layout: () => ({
            columns: 5, rows: 3,
            cells: [
                { index: 0, row: 0, col: 0, rowSpan: 2, colSpan: 2 },
                { index: 1, row: 0, col: 2, rowSpan: 1, colSpan: 2 },
                { index: 2, row: 0, col: 4, rowSpan: 1, colSpan: 1 },
                { index: 3, row: 1, col: 2, rowSpan: 1, colSpan: 1 },
                { index: 4, row: 1, col: 3, rowSpan: 1, colSpan: 1 },
                { index: 5, row: 1, col: 4, rowSpan: 1, colSpan: 1 },
                { index: 6, row: 2, col: 0, rowSpan: 1, colSpan: 2 },
                { index: 7, row: 2, col: 2, rowSpan: 1, colSpan: 1 },
                { index: 8, row: 2, col: 3, rowSpan: 1, colSpan: 1 },
                { index: 9, row: 2, col: 4, rowSpan: 1, colSpan: 1 }
            ]
        }),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="6" y="6" width="34" height="57" rx="3"/><rect x="42" y="6" width="34" height="26" rx="3"/><rect x="78" y="6" width="16" height="26" rx="3"/><rect x="42" y="37" width="16" height="26" rx="3"/><rect x="60" y="37" width="16" height="26" rx="3"/><rect x="78" y="37" width="16" height="26" rx="3"/><rect x="6" y="68" width="34" height="26" rx="3"/><rect x="42" y="68" width="16" height="26" rx="3"/><rect x="60" y="68" width="16" height="26" rx="3"/><rect x="78" y="68" width="16" height="26" rx="3"/></svg>'
    },
    {
        id: 'tall-strip-10',
        minImages: 10,
        maxImages: 10,
        layout: () => ({
            columns: 5, rows: 3,
            cells: [
                { index: 0, row: 0, col: 0, rowSpan: 3, colSpan: 1 },
                { index: 1, row: 0, col: 1, rowSpan: 1, colSpan: 2 },
                { index: 2, row: 0, col: 3, rowSpan: 1, colSpan: 2 },
                { index: 3, row: 1, col: 1, rowSpan: 1, colSpan: 1 },
                { index: 4, row: 1, col: 2, rowSpan: 1, colSpan: 1 },
                { index: 5, row: 1, col: 3, rowSpan: 1, colSpan: 1 },
                { index: 6, row: 1, col: 4, rowSpan: 1, colSpan: 1 },
                { index: 7, row: 2, col: 1, rowSpan: 1, colSpan: 1 },
                { index: 8, row: 2, col: 2, rowSpan: 1, colSpan: 1 },
                { index: 9, row: 2, col: 3, rowSpan: 1, colSpan: 2 }
            ]
        }),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="6" y="6" width="16" height="88" rx="3"/><rect x="24" y="6" width="34" height="26" rx="3"/><rect x="60" y="6" width="34" height="26" rx="3"/><rect x="24" y="37" width="16" height="26" rx="3"/><rect x="42" y="37" width="16" height="26" rx="3"/><rect x="60" y="37" width="16" height="26" rx="3"/><rect x="78" y="37" width="16" height="26" rx="3"/><rect x="24" y="68" width="16" height="26" rx="3"/><rect x="42" y="68" width="16" height="26" rx="3"/><rect x="60" y="68" width="34" height="26" rx="3"/></svg>'
    },
    {
        id: 'two-by-five-10',
        minImages: 10,
        maxImages: 10,
        layout: () => buildGridLayout(10, 5),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="6" y="6" width="16" height="41" rx="3"/><rect x="24" y="6" width="16" height="41" rx="3"/><rect x="42" y="6" width="16" height="41" rx="3"/><rect x="60" y="6" width="16" height="41" rx="3"/><rect x="78" y="6" width="16" height="41" rx="3"/><rect x="6" y="53" width="16" height="41" rx="3"/><rect x="24" y="53" width="16" height="41" rx="3"/><rect x="42" y="53" width="16" height="41" rx="3"/><rect x="60" y="53" width="16" height="41" rx="3"/><rect x="78" y="53" width="16" height="41" rx="3"/></svg>'
    },
    {
        id: 'grid-1col',
        minImages: 1,
        maxImages: 999,
        isGrid: true,
        layout: (count) => buildGridLayout(count, 1),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="6" y="6" width="88" height="26" rx="3"/><rect x="6" y="37" width="88" height="26" rx="3"/><rect x="6" y="68" width="88" height="26" rx="3"/></svg>'
    },
    {
        id: 'grid-2col',
        minImages: 2,
        maxImages: 999,
        isGrid: true,
        layout: (count) => buildGridLayout(count, 2),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="6" y="6" width="40" height="26" rx="3"/><rect x="54" y="6" width="40" height="26" rx="3"/><rect x="6" y="37" width="40" height="26" rx="3"/><rect x="54" y="37" width="40" height="26" rx="3"/><rect x="6" y="68" width="40" height="26" rx="3"/><rect x="54" y="68" width="40" height="26" rx="3"/></svg>'
    },
    {
        id: 'grid-3col',
        minImages: 3,
        maxImages: 999,
        isGrid: true,
        layout: (count) => buildGridLayout(count, 3),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="6" y="6" width="24" height="26" rx="3"/><rect x="38" y="6" width="24" height="26" rx="3"/><rect x="70" y="6" width="24" height="26" rx="3"/><rect x="6" y="37" width="24" height="26" rx="3"/><rect x="38" y="37" width="24" height="26" rx="3"/><rect x="70" y="37" width="24" height="26" rx="3"/><rect x="6" y="68" width="24" height="26" rx="3"/><rect x="38" y="68" width="24" height="26" rx="3"/><rect x="70" y="68" width="24" height="26" rx="3"/></svg>'
    },
    {
        id: 'grid-4col',
        minImages: 4,
        maxImages: 999,
        isGrid: true,
        layout: (count) => buildGridLayout(count, 4),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="4" y="6" width="18" height="26" rx="2"/><rect x="28" y="6" width="18" height="26" rx="2"/><rect x="54" y="6" width="18" height="26" rx="2"/><rect x="78" y="6" width="18" height="26" rx="2"/><rect x="4" y="37" width="18" height="26" rx="2"/><rect x="28" y="37" width="18" height="26" rx="2"/><rect x="54" y="37" width="18" height="26" rx="2"/><rect x="78" y="37" width="18" height="26" rx="2"/><rect x="4" y="68" width="18" height="26" rx="2"/><rect x="28" y="68" width="18" height="26" rx="2"/><rect x="54" y="68" width="18" height="26" rx="2"/><rect x="78" y="68" width="18" height="26" rx="2"/></svg>'
    },
    {
        id: 'grid-5col',
        minImages: 5,
        maxImages: 999,
        isGrid: true,
        layout: (count) => buildGridLayout(count, 5),
        thumbnail: '<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="6" y="6" width="16" height="41" rx="2"/><rect x="24" y="6" width="16" height="41" rx="2"/><rect x="42" y="6" width="16" height="41" rx="2"/><rect x="60" y="6" width="16" height="41" rx="2"/><rect x="78" y="6" width="16" height="41" rx="2"/><rect x="6" y="53" width="16" height="41" rx="2"/><rect x="24" y="53" width="16" height="41" rx="2"/><rect x="42" y="53" width="16" height="41" rx="2"/><rect x="60" y="53" width="16" height="41" rx="2"/><rect x="78" y="53" width="16" height="41" rx="2"/></svg>'
    }
];

// ── Template helpers ─────────────────────────────────────────
function getAutoGridColumns(count) {
    if (count <= 1) return 1;
    if (count <= 2) return 2;
    if (count <= 4) return 2;
    if (count <= 6) return 3;
    return 4;
}

function getLayoutConfig(count) {
    if (count === 0) return { columns: 1, rows: 1, cells: [] };

    if (selectedTemplateId) {
        const tpl = templateLibrary.find(t => t.id === selectedTemplateId);
        if (tpl) {
            if (tpl.isGrid) return tpl.layout(count);
            const base = Math.min(count, tpl.maxImages);
            const layout = tpl.layout(base);
            if (layout) return extendLayoutWithOverflow(layout, count);
        }
    }

    return buildGridLayout(count, getAutoGridColumns(count));
}

function templateFitsCount(templateId, count) {
    const tpl = templateLibrary.find(t => t.id === templateId);
    if (!tpl) return false;
    if (tpl.isGrid) return count >= tpl.minImages;
    return count >= tpl.minImages && count <= tpl.maxImages;
}

function defaultTemplateFor(count) {
    const named = templateLibrary.find(t => !t.isGrid && count >= t.minImages && count <= t.maxImages);
    if (named) return named.id;
    const cols = getAutoGridColumns(count);
    const gridId = `grid-${cols}col`;
    return templateLibrary.find(t => t.id === gridId) ? gridId : 'grid-2col';
}

// ── Template strip renderer ───────────────────────────────────
function renderTemplateStrip() {
    const strip = document.getElementById('merger-strip');
    if (!strip) return;

    const count = mergeItems.length;
    const available = templateLibrary.filter(t =>
        t.isGrid
            ? count >= t.minImages
            : count >= t.minImages && count <= t.maxImages
    );

    strip.innerHTML = available.map(tpl => {
        const isActive = tpl.id === selectedTemplateId;
        return `<button
            class="bb-merger__template-btn${isActive ? ' active' : ''}"
            data-template="${tpl.id}"
            title="${tpl.id.replace(/-/g, ' ')}"
            role="option"
            aria-selected="${isActive}"
        >${tpl.thumbnail}</button>`;
    }).join('');

    strip.querySelectorAll('.bb-merger__template-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            selectedTemplateId = btn.dataset.template;
            selectedCellIndex  = -1;
            renderTemplateStrip();
            updatePreview();
        });
    });
}

// ── Dimensions ──────────────────────────────────────────────
function calculateMergeDimensions() {
    if (mergeItems.length === 0) return null;

    // Find max dimensions for cell sizing
    let cellWidth = 0, cellHeight = 0;
    mergeItems.forEach(item => {
        cellWidth  = Math.max(cellWidth,  item.width);
        cellHeight = Math.max(cellHeight, item.height);
    });

    // Default cell size if no images
    if (cellWidth  === 0) cellWidth  = 800;
    if (cellHeight === 0) cellHeight = 600;

    const layout = getLayoutConfig(mergeItems.length);
    const canvasWidth  = cellWidth  * layout.columns;
    const canvasHeight = cellHeight * layout.rows;

    return { width: canvasWidth, height: canvasHeight, cellWidth, cellHeight, layout };
}

// ── Preview renderer ────────────────────────────────────────
function updatePreview() {
    const container = document.getElementById('merger-preview');
    if (!container) return;

    if (mergeItems.length === 0) {
        container.innerHTML = '';
        return;
    }

    const dims = calculateMergeDimensions();
    const layout = dims.layout;

    // Responsive: constrain to container width
    const maxW = container.clientWidth  || 800;
    const maxH = Math.min(window.innerHeight * 0.55, 600);
    const aspect = dims.width / dims.height;

    let previewW, previewH;
    if (aspect > maxW / maxH) {
        previewW = maxW;
        previewH = maxW / aspect;
    } else {
        previewH = maxH;
        previewW = maxH * aspect;
    }

    // Scale spacing for preview
    const spacingPx = Math.max(0, Math.round(spacing * (previewW / dims.width)));
    const radiusPx  = Math.max(0, Math.round(cornerRadius * (previewW / dims.width)));

    let gridStyle = [
        `display:grid`,
        `width:${previewW}px`,
        `height:${previewH}px`,
        `margin:0 auto`,
        `grid-template-columns:repeat(${layout.columns},1fr)`,
        `grid-template-rows:repeat(${layout.rows},1fr)`,
        `gap:0`
    ].join(';');

    let html = `<div style="${gridStyle}">`;

    mergeItems.forEach((item, index) => {
        const cell = layout.cells[index];
        if (!cell) return;

        const fitCss = imageFit === 'cover' ? 'cover'
                     : imageFit === 'fill'  ? 'fill'
                     : 'contain';

        const clipPoints = cell.clip ? getClipPolygonPoints(cell.clip) : null;
        const clipStyle  = clipPoints ? `clip-path:polygon(${clipPoints})` : '';

        const cellStyle = [
            `grid-column:${cell.col + 1}/span ${cell.colSpan}`,
            `grid-row:${cell.row + 1}/span ${cell.rowSpan}`,
            `background:${frameColor}`,
            `padding:${spacingPx}px`,
            `overflow:hidden`
        ].join(';');

        const innerStyle = [
            `position:relative`,
            `width:100%`,
            `height:100%`,
            `overflow:hidden`,
            `border-radius:${radiusPx}px`,
            clipStyle
        ].filter(Boolean).join(';');

        const posX = item.imageOffsetX ?? 50;
        const posY = item.imageOffsetY ?? 50;
        const imgStyle = [
            `width:100%`,
            `height:100%`,
            `object-fit:${fitCss}`,
            `object-position:${posX}% ${posY}%`,
            `position:absolute`,
            `top:0`,
            `left:0`,
            `display:block`
        ].join(';');

        html += `<div class="merger-cell" data-cell="${index}" style="${cellStyle}">`;
        html += `<div style="${innerStyle}">`;
        html += `<img src="${item.dataUrl}" class="merger-img${imageFit === 'cover' ? ' merger-image-cover' : ''}" data-cell="${index}" style="${imgStyle}">`;
        html += `</div></div>`;
    });

    html += '</div>';
    container.innerHTML = html;
    updateCellSelection();
}

// ── Advanced controls ────────────────────────────────────────
function wireAdvancedControls() {
    // Image Fit pills
    document.querySelectorAll('#merger-fit-pills .bb-merger__pill').forEach(btn => {
        btn.addEventListener('click', () => {
            imageFit = btn.dataset.fit;
            document.querySelectorAll('#merger-fit-pills .bb-merger__pill')
                .forEach(b => b.classList.toggle('active', b === btn));
            updatePreview();
        });
    });

    // Spacing slider
    const spacingSlider = document.getElementById('merger-spacing');
    const spacingValue  = document.getElementById('merger-spacing-value');
    spacingSlider.addEventListener('input', () => {
        spacing = parseInt(spacingSlider.value);
        spacingValue.textContent = spacing;
        updatePreview();
        updateDownloadButton();
    });

    // Corner radius slider
    const radiusSlider = document.getElementById('merger-radius');
    const radiusValue  = document.getElementById('merger-radius-value');
    radiusSlider.addEventListener('input', () => {
        cornerRadius = parseInt(radiusSlider.value);
        radiusValue.textContent = cornerRadius;
        updatePreview();
    });

    // Frame color pickers (keep in sync)
    const colorPicker = document.getElementById('merger-color');
    const colorText   = document.getElementById('merger-color-text');

    colorPicker.addEventListener('input', () => {
        frameColor = colorPicker.value;
        colorText.value = frameColor;
        updatePreview();
    });

    colorText.addEventListener('change', () => {
        const val = colorText.value.trim();
        if (/^#[0-9a-fA-F]{6}$/.test(val)) {
            frameColor = val;
            colorPicker.value = val;
            updatePreview();
        }
    });
}

// ── File size estimate ────────────────────────────────────────
function estimateSizeMB(w, h) {
    // PNG rough estimate: uncompressed RGBA ÷ 4 (typical PNG compression)
    return ((w * h * 4) / 4 / 1024 / 1024).toFixed(1);
}

function updateDownloadButton() {
    const btn = document.getElementById('merger-download-btn');
    if (!btn || mergeItems.length === 0) return;

    const dims = calculateMergeDimensions();
    const mb   = estimateSizeMB(
        Math.round(dims.width  * outputScale),
        Math.round(dims.height * outputScale)
    );
    btn.textContent = `⬇ Download  ·  ~${mb} MB`;
}

// ── Download modal ───────────────────────────────────────────
function openDownloadModal() {
    if (mergeItems.length === 0) return;

    outputScale = 1.0;
    updateModalInfo();

    // Reset scale pills
    document.querySelectorAll('#merger-modal-scales .bb-merger__pill')
        .forEach(b => b.classList.toggle('active', b.dataset.scale === '1.0'));
    document.getElementById('merger-custom-scale').value = '100';
    document.getElementById('merger-custom-scale-value').textContent = '100';

    document.getElementById('merger-modal').hidden = false;
}

function updateModalInfo() {
    const dims = calculateMergeDimensions();
    const w = Math.round(dims.width  * outputScale);
    const h = Math.round(dims.height * outputScale);
    const mb = estimateSizeMB(w, h);

    document.getElementById('merger-modal-dims').textContent = `${w} × ${h}px`;
    document.getElementById('merger-modal-size').textContent = `~${mb} MB`;
}

function wireModal() {
    const modal = document.getElementById('merger-modal');

    // Scale pills
    document.querySelectorAll('#merger-modal-scales .bb-merger__pill').forEach(btn => {
        btn.addEventListener('click', () => {
            outputScale = parseFloat(btn.dataset.scale);
            document.querySelectorAll('#merger-modal-scales .bb-merger__pill')
                .forEach(b => b.classList.toggle('active', b === btn));
            // Sync custom slider
            const pct = Math.round(outputScale * 100);
            document.getElementById('merger-custom-scale').value = pct;
            document.getElementById('merger-custom-scale-value').textContent = pct;
            updateModalInfo();
        });
    });

    // Custom scale slider
    document.getElementById('merger-custom-scale').addEventListener('input', function() {
        outputScale = parseInt(this.value) / 100;
        document.getElementById('merger-custom-scale-value').textContent = this.value;
        // Deactivate preset pills
        document.querySelectorAll('#merger-modal-scales .bb-merger__pill')
            .forEach(b => b.classList.remove('active'));
        updateModalInfo();
    });

    // Cancel
    document.getElementById('merger-modal-cancel').addEventListener('click', () => {
        modal.hidden = true;
    });

    // Confirm download
    document.getElementById('merger-modal-confirm').addEventListener('click', () => {
        modal.hidden = true;
        downloadMergedImage();
    });

    // Close on backdrop click
    modal.addEventListener('click', e => {
        if (e.target === modal) modal.hidden = true;
    });
}

// ── Canvas download engine ───────────────────────────────────
async function downloadMergedImage() {
    if (mergeItems.length === 0) return;

    const dims = calculateMergeDimensions();
    const canvasWidth  = Math.round(dims.width  * outputScale);
    const canvasHeight = Math.round(dims.height * outputScale);
    const baseCellW    = Math.round(dims.cellWidth  * outputScale);
    const baseCellH    = Math.round(dims.cellHeight * outputScale);
    const spacingOut   = Math.max(0, Math.round(spacing * outputScale));
    const layout       = dims.layout || getLayoutConfig(mergeItems.length);

    const canvas = document.createElement('canvas');
    canvas.width  = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = frameColor;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    for (const [index, item] of mergeItems.entries()) {
        const cell = layout.cells[index];
        if (!cell) continue;

        const x          = cell.col  * baseCellW;
        const y          = cell.row  * baseCellH;
        const cellWidth  = baseCellW * cell.colSpan;
        const cellHeight = baseCellH * cell.rowSpan;
        const innerX     = x + spacingOut;
        const innerY     = y + spacingOut;
        const innerW     = Math.max(1, cellWidth  - spacingOut * 2);
        const innerH     = Math.max(1, cellHeight - spacingOut * 2);

        // Draw frame background
        if (spacingOut > 0) {
            ctx.fillStyle = frameColor;
            ctx.fillRect(x, y, cellWidth, cellHeight);
        }

        // Clip polygon (diagonal split, hex, heart)
        const clipPts = cell.clip ? getClipPolygonArray(cell.clip) : null;
        if (clipPts) {
            ctx.save();
            ctx.beginPath();
            clipPts.forEach(([px, py], i) => {
                const cx = innerX + px * innerW;
                const cy = innerY + py * innerH;
                i === 0 ? ctx.moveTo(cx, cy) : ctx.lineTo(cx, cy);
            });
            ctx.closePath();
            ctx.clip();
        } else if (cornerRadius > 0) {
            const r = Math.max(0, Math.round(cornerRadius * outputScale));
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(innerX, innerY, innerW, innerH, r);
            ctx.clip();
        }

        // Draw image
        if (imageFit === 'cover' || imageFit === 'contain') {
            const scale = imageFit === 'cover'
                ? Math.max(innerW / item.width, innerH / item.height)
                : Math.min(innerW / item.width, innerH / item.height);
            const sw = item.width  * scale;
            const sh = item.height * scale;
            const ox = (innerW - sw) * ((item.imageOffsetX ?? 50) / 100);
            const oy = (innerH - sh) * ((item.imageOffsetY ?? 50) / 100);
            ctx.drawImage(item.img, innerX + ox, innerY + oy, sw, sh);
        } else {
            // fill
            ctx.drawImage(item.img, innerX, innerY, innerW, innerH);
        }

        if (clipPts || cornerRadius > 0) {
            ctx.restore();
        }
    }

    canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href     = url;
        a.download = `merged_${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(url);
    }, 'image/png');
}

// ── Click-to-swap ────────────────────────────────────────────
function handleCellClick(index) {
    if (selectedCellIndex === -1) {
        selectedCellIndex = index;
        updateCellSelection();
    } else if (selectedCellIndex === index) {
        selectedCellIndex = -1;
        updateCellSelection();
    } else {
        [mergeItems[selectedCellIndex], mergeItems[index]] =
            [mergeItems[index], mergeItems[selectedCellIndex]];
        selectedCellIndex = -1;
        updatePreview();
    }
}

function updateCellSelection() {
    const preview = document.getElementById('merger-preview');
    if (!preview) return;
    preview.querySelectorAll('.merger-cell').forEach(el => {
        const idx = parseInt(el.dataset.cell, 10);
        el.classList.toggle('merger-cell--selected', idx === selectedCellIndex);
    });
    preview.classList.toggle('merger-preview--selecting', selectedCellIndex >= 0);
}

// ── Image pan + tap-to-swap (unified) ───────────────────────
function wirePan() {
    // ── Mouse ────────────────────────────────────────────────
    document.addEventListener('mousedown', e => {
        const cell = e.target.closest('.merger-cell');
        if (!cell) return;
        panCellIndex = parseInt(cell.dataset.cell, 10);
        panStartX = e.clientX;
        panStartY = e.clientY;
        panLastX  = e.clientX;
        panLastY  = e.clientY;
        panMoved  = false;
        if (imageFit === 'cover') {
            isPanningImage = true;
            e.preventDefault();
        }
    });

    document.addEventListener('mousemove', e => {
        if (panCellIndex < 0) return;
        const totalDx = e.clientX - panStartX;
        const totalDy = e.clientY - panStartY;
        if (Math.abs(totalDx) > 4 || Math.abs(totalDy) > 4) panMoved = true;

        if (isPanningImage && panMoved) {
            const item = mergeItems[panCellIndex];
            if (item) {
                const dx = e.clientX - panLastX;
                const dy = e.clientY - panLastY;
                const preview = document.getElementById('merger-preview');
                const w = preview.clientWidth  || 400;
                const h = preview.clientHeight || 300;
                item.imageOffsetX = Math.max(0, Math.min(100, (item.imageOffsetX ?? 50) - (dx / w * 100)));
                item.imageOffsetY = Math.max(0, Math.min(100, (item.imageOffsetY ?? 50) - (dy / h * 100)));
                const imgEl = preview.querySelector(`.merger-img[data-cell="${panCellIndex}"]`);
                if (imgEl) imgEl.style.objectPosition = `${item.imageOffsetX}% ${item.imageOffsetY}%`;
            }
        }
        panLastX = e.clientX;
        panLastY = e.clientY;
    });

    document.addEventListener('mouseup', () => {
        if (!panMoved && panCellIndex >= 0) handleCellClick(panCellIndex);
        isPanningImage = false;
        panCellIndex   = -1;
        panMoved       = false;
    });

    // ── Touch ────────────────────────────────────────────────
    document.addEventListener('touchstart', e => {
        const cell = e.target.closest('.merger-cell');
        if (!cell) return;
        panCellIndex = parseInt(cell.dataset.cell, 10);
        panStartX = e.touches[0].clientX;
        panStartY = e.touches[0].clientY;
        panLastX  = e.touches[0].clientX;
        panLastY  = e.touches[0].clientY;
        panMoved  = false;
        if (imageFit === 'cover') {
            isPanningImage = true;
            e.preventDefault();
        }
    }, { passive: false });

    document.addEventListener('touchmove', e => {
        if (panCellIndex < 0) return;
        const totalDx = e.touches[0].clientX - panStartX;
        const totalDy = e.touches[0].clientY - panStartY;
        if (Math.abs(totalDx) > 4 || Math.abs(totalDy) > 4) panMoved = true;

        if (isPanningImage && panMoved) {
            const item = mergeItems[panCellIndex];
            if (item) {
                const dx = e.touches[0].clientX - panLastX;
                const dy = e.touches[0].clientY - panLastY;
                const preview = document.getElementById('merger-preview');
                const w = preview.clientWidth  || 400;
                const h = preview.clientHeight || 300;
                item.imageOffsetX = Math.max(0, Math.min(100, (item.imageOffsetX ?? 50) - (dx / w * 100)));
                item.imageOffsetY = Math.max(0, Math.min(100, (item.imageOffsetY ?? 50) - (dy / h * 100)));
                const imgEl = preview.querySelector(`.merger-img[data-cell="${panCellIndex}"]`);
                if (imgEl) imgEl.style.objectPosition = `${item.imageOffsetX}% ${item.imageOffsetY}%`;
            }
        }
        panLastX = e.touches[0].clientX;
        panLastY = e.touches[0].clientY;
    }, { passive: true });

    document.addEventListener('touchend', () => {
        if (!panMoved && panCellIndex >= 0) handleCellClick(panCellIndex);
        isPanningImage = false;
        panCellIndex   = -1;
        panMoved       = false;
    });
}

initMerger();
