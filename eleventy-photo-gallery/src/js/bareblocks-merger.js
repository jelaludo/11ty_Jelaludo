// ============================================================
// IMAGE MERGER — mobile-first progressive reveal
// ============================================================

// ── State ──────────────────────────────────────────────────
let mergeItems = [];
// Each item: { file, dataUrl, img, width, height, imageOffsetX, imageOffsetY }

let selectedTemplateId = null;
let imageFit        = 'contain'; // 'contain' | 'cover' | 'fill'
let spacing         = 6;         // px — gap + outer frame
let cornerRadius    = 0;         // px — cell corner rounding
let frameColor      = '#0d1117';
let outputScale     = 1.0;

// Image-pan state (cover mode drag)
let isPanningImage  = false;
let panCellIndex    = -1;
let panStartX       = 0;
let panStartY       = 0;

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
    return count >= tpl.minImages;
}

function defaultTemplateFor(count) {
    const match = templateLibrary.find(t => count >= t.minImages && count <= t.maxImages);
    return match ? match.id : null;
}

// ── Template strip renderer ───────────────────────────────────
function renderTemplateStrip() {
    const strip = document.getElementById('merger-strip');
    if (!strip) return;

    const count = mergeItems.length;
    // Show templates that work for this count, plus auto-grid always
    const available = templateLibrary.filter(t => count >= t.minImages && count <= t.maxImages + 2);

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

        html += `<div style="${cellStyle}">`;
        html += `<div style="${innerStyle}">`;
        html += `<img src="${item.dataUrl}" class="merger-img${imageFit === 'cover' ? ' merger-image-cover' : ''}" data-cell="${index}" style="${imgStyle}">`;
        html += `</div></div>`;
    });

    html += '</div>';
    container.innerHTML = html;
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

// ── Image pan in cover mode ──────────────────────────────────
function wirePan() {
    // Mouse
    document.addEventListener('mousedown', e => {
        const img = e.target.closest('.merger-image-cover');
        if (!img || imageFit !== 'cover') return;
        isPanningImage = true;
        panCellIndex   = parseInt(img.dataset.cell, 10);
        panStartX      = e.clientX;
        panStartY      = e.clientY;
        e.preventDefault();
    });

    document.addEventListener('mousemove', e => {
        if (!isPanningImage || panCellIndex < 0) return;
        const item = mergeItems[panCellIndex];
        if (!item) return;

        const dx = e.clientX - panStartX;
        const dy = e.clientY - panStartY;
        panStartX = e.clientX;
        panStartY = e.clientY;

        const preview = document.getElementById('merger-preview');
        const w = preview.clientWidth  || 400;
        const h = preview.clientHeight || 300;

        item.imageOffsetX = Math.max(0, Math.min(100, (item.imageOffsetX ?? 50) - (dx / w * 100)));
        item.imageOffsetY = Math.max(0, Math.min(100, (item.imageOffsetY ?? 50) - (dy / h * 100)));

        // Live update: just update the img element directly (no full re-render)
        const imgEl = preview.querySelector(`.merger-img[data-cell="${panCellIndex}"]`);
        if (imgEl) {
            imgEl.style.objectPosition = `${item.imageOffsetX}% ${item.imageOffsetY}%`;
        }
    });

    document.addEventListener('mouseup', () => {
        if (isPanningImage) {
            isPanningImage = false;
            panCellIndex   = -1;
        }
    });

    // Touch
    document.addEventListener('touchstart', e => {
        const img = e.target.closest('.merger-image-cover');
        if (!img || imageFit !== 'cover') return;
        isPanningImage = true;
        panCellIndex   = parseInt(img.dataset.cell, 10);
        panStartX      = e.touches[0].clientX;
        panStartY      = e.touches[0].clientY;
    }, { passive: true });

    document.addEventListener('touchmove', e => {
        if (!isPanningImage || panCellIndex < 0) return;
        const item = mergeItems[panCellIndex];
        if (!item) return;

        const dx = e.touches[0].clientX - panStartX;
        const dy = e.touches[0].clientY - panStartY;
        panStartX = e.touches[0].clientX;
        panStartY = e.touches[0].clientY;

        const preview = document.getElementById('merger-preview');
        const w = preview.clientWidth  || 400;
        const h = preview.clientHeight || 300;

        item.imageOffsetX = Math.max(0, Math.min(100, (item.imageOffsetX ?? 50) - (dx / w * 100)));
        item.imageOffsetY = Math.max(0, Math.min(100, (item.imageOffsetY ?? 50) - (dy / h * 100)));

        const imgEl = preview.querySelector(`.merger-img[data-cell="${panCellIndex}"]`);
        if (imgEl) {
            imgEl.style.objectPosition = `${item.imageOffsetX}% ${item.imageOffsetY}%`;
        }
    }, { passive: true });

    document.addEventListener('touchend', () => {
        isPanningImage = false;
        panCellIndex   = -1;
    });
}

initMerger();
