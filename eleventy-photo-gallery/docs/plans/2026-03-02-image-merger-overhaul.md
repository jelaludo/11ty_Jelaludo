# Image Merger Overhaul — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rewrite the Image Merger tab with a mobile-first progressive reveal layout: drop zone → preview → template strip → advanced options → download.

**Architecture:** Single vertical column, three UI states (`empty`/`loaded`/`advanced-open`). All styles in SCSS under `.bb-merger`. JS rewritten to ~600 lines, keeping only the canvas rendering engine, layout builders, and template library. Text overlay and empty cells features dropped.

**Tech Stack:** Vanilla JS, SCSS (compiled by existing Sass watch), HTML in 11ty Nunjucks template. No new deps. Canvas API for download. No automated test framework — verify in browser at `http://localhost:8080/tools/` after `npm run dev`.

---

## Key files

| File | Action |
|------|--------|
| `src/tools.njk` | Modify: replace `imagetools-tab` div contents only |
| `src/js/bareblocks-merger.js` | Full rewrite (1657 → ~600 lines) |
| `src/_includes/sass/partials/_bareblocks.scss` | Add `.bb-merger` block at end of file |

**Do not touch:** Metadata tab HTML/JS, `bareblocks-metadata.js`, `base.njk`, any other file.

---

## What to keep from existing JS

The following functions are CORRECT and should be carried forward (copy, then adapt):

- `buildGridLayout(count, columns)` — line 787
- `buildHeroLeftLayout(count)` — line 798
- `buildHeroRightLayout(count)` — line 824
- `buildHeroTopLayout(count)` — line 850
- `buildHeroBottomLayout(count)` — line 876
- `buildSpotlightLayout(count)` — line 902
- `buildSplitLayout(count)` — line 915
- `getClipPolygonArray(type)` — line 929
- `getClipPolygonPoints(type)` — line 945
- `extendLayoutWithOverflow(layout, count)` — line 951
- `templateLibrary` array — line 971 (all 12 templates with SVG thumbnails)
- `calculateMergeDimensions()` — line 1142
- `downloadMergedImage()` — line 1472 (adapt: remove text rendering, add cornerRadius)
- Image pan drag logic (mousedown/mousemove/mouseup on `.merge-image`) — line 456

**Drop entirely:** `generateMetadataSummary`, `toggleEmptyCells`, `setEmptyCellPattern`, `setEmptyCellColor`, `rebuildMergeItems`, `selectCell`, `updateCellText`, `updateCellTextStyle`, `handleTextMouseDown`, `startDragText`, `openTextModal`, `closeTextModal`, `initializeMergerDefaults`, `setMergeLayout`, `setMergeDirection`, `setMergeTemplate` (replace with new), `setImageFit` (replace with new), `setFrameSize`, `setFrameColor`, `updateGridColumns`, `getAutoGridColumns`, `renderTemplateLibrary`, `updateMergeUI`, `openOutputSizeModal`, `closeOutputSizeModal`, `setOutputScale`, `updateCustomScale`, `updateOutputSizePreview`, `proceedWithDownload`, modal drag logic.

---

## Task 1: Create the feature branch

**Step 1: Create and switch to branch**
```bash
cd eleventy-photo-gallery
git checkout -b feature/image-merger-overhaul
```

**Step 2: Verify**
```bash
git branch
```
Expected: `* feature/image-merger-overhaul` shown as current branch.

---

## Task 2: Rewrite the `imagetools-tab` HTML in `tools.njk`

**Files:**
- Modify: `src/tools.njk` lines 86–214 (the `imagetools-tab` div)

Replace the entire `<div id="imagetools-tab" class="tab-content">` ... closing `</div>` block (lines 86–214) with this new structure. Keep everything outside that range untouched.

**New HTML:**
```html
<!-- Image Tools Tab -->
<div id="imagetools-tab" class="tab-content">
    <div class="bb-merger">
        <!-- EMPTY STATE: drop zone -->
        <div class="bb-merger__dropzone" id="merger-dropzone">
            <input type="file" id="merger-file-input" accept="image/*" multiple hidden>
            <div class="upload-icon">[   ]</div>
            <p class="bb-merger__drop-label">Drop images here · or tap to browse</p>
            <p class="info">JPEG · PNG · TIFF · HEIC · Stays in your browser</p>
        </div>

        <!-- LOADED STATE: everything else -->
        <div class="bb-merger__loaded" id="merger-loaded" hidden>

            <!-- Live preview -->
            <div class="bb-merger__preview" id="merger-preview"></div>

            <!-- Template strip -->
            <div class="bb-merger__strip" id="merger-strip" role="listbox" aria-label="Layout templates"></div>

            <!-- Add / Clear actions -->
            <div class="bb-merger__actions">
                <input type="file" id="merger-add-input" accept="image/*" multiple hidden>
                <button class="bb-merger__add-btn" id="merger-add-btn">+ Add images</button>
                <button class="bb-merger__clear-btn" id="merger-clear-btn">× Clear all</button>
            </div>

            <!-- Advanced options toggle -->
            <button class="bb-merger__advanced-toggle" id="merger-advanced-toggle" aria-expanded="false">
                <span class="bb-merger__toggle-icon" id="merger-toggle-icon">▾</span>
                Advanced options
            </button>

            <!-- Advanced options panel (hidden by default) -->
            <div class="bb-merger__advanced" id="merger-advanced" hidden>

                <!-- Image Fit -->
                <div class="bb-merger__control">
                    <span class="bb-merger__label">Image Fit</span>
                    <div class="bb-merger__pills" id="merger-fit-pills">
                        <button class="bb-merger__pill active" data-fit="contain">Contain</button>
                        <button class="bb-merger__pill" data-fit="cover">Cover</button>
                        <button class="bb-merger__pill" data-fit="fill">Fill</button>
                    </div>
                </div>

                <!-- Spacing -->
                <div class="bb-merger__control">
                    <label for="merger-spacing" class="bb-merger__label">
                        Spacing: <span id="merger-spacing-value">6</span>px
                    </label>
                    <input type="range" id="merger-spacing" class="bb-merger__slider"
                           min="0" max="40" value="6">
                </div>

                <!-- Corner Radius -->
                <div class="bb-merger__control">
                    <label for="merger-radius" class="bb-merger__label">
                        Corner Radius: <span id="merger-radius-value">0</span>px
                    </label>
                    <input type="range" id="merger-radius" class="bb-merger__slider"
                           min="0" max="20" value="0">
                </div>

                <!-- Frame Color -->
                <div class="bb-merger__control">
                    <span class="bb-merger__label">Frame Color</span>
                    <div class="bb-merger__color-row">
                        <input type="color" id="merger-color" value="#0d1117">
                        <input type="text" id="merger-color-text" value="#0d1117"
                               maxlength="7" placeholder="#0d1117">
                    </div>
                </div>

            </div><!-- /advanced -->

            <!-- Download button -->
            <button class="bb-merger__download" id="merger-download-btn">
                ⬇ Download
            </button>

        </div><!-- /loaded -->
    </div><!-- /bb-merger -->

    <!-- Download size modal -->
    <div class="bb-merger__modal" id="merger-modal" hidden>
        <div class="bb-merger__modal-inner">
            <h3 class="bb-merger__modal-title">Output Size</h3>
            <div class="bb-merger__modal-info">
                <div class="bb-merger__modal-dims" id="merger-modal-dims">—</div>
                <div class="bb-merger__modal-size" id="merger-modal-size">~— MB</div>
            </div>
            <div class="bb-merger__modal-scales" id="merger-modal-scales">
                <button class="bb-merger__pill active" data-scale="1.0">100%</button>
                <button class="bb-merger__pill" data-scale="0.75">75%</button>
                <button class="bb-merger__pill" data-scale="0.5">50%</button>
                <button class="bb-merger__pill" data-scale="0.25">25%</button>
            </div>
            <div class="bb-merger__control">
                <label for="merger-custom-scale" class="bb-merger__label">
                    Custom: <span id="merger-custom-scale-value">100</span>%
                </label>
                <input type="range" id="merger-custom-scale" class="bb-merger__slider"
                       min="10" max="200" value="100">
            </div>
            <div class="bb-merger__modal-footer">
                <button class="bb-merger__cancel-btn" id="merger-modal-cancel">Cancel</button>
                <button class="bb-merger__confirm-btn" id="merger-modal-confirm">Download</button>
            </div>
        </div>
    </div><!-- /modal -->

</div><!-- /imagetools-tab -->
```

Also **remove** the two modal divs that are currently after the main content (the `text-edit-modal` and `output-size-modal` divs, lines 219–296) — they are being replaced by the new `merger-modal` above. The script tags at lines 299–303 remain untouched.

**Step: Verify in browser**
Open `http://localhost:8080/tools/` → click "Image Tools" tab.
Expected: You see a drop zone with `[   ]` icon and "Drop images here" text. Nothing else. No error in console.

**Step: Commit**
```bash
git add src/tools.njk
git commit -m "feat(merger): new mobile-first HTML structure — progressive reveal"
```

---

## Task 3: Add `.bb-merger` CSS block to `_bareblocks.scss`

**Files:**
- Modify: `src/_includes/sass/partials/_bareblocks.scss` — append after line 779 (end of `.bb-app {}`)

Append this entire block **after** the closing `}` of `.bb-app`:

```scss
// ================================================================
// BB-Merger — Image combination tool, mobile-first
// Scoped separately from .bb-app to avoid specificity conflicts
// ================================================================

.bb-app .bb-merger {
    max-width: 900px;
    margin: 0 auto;

    // ── Drop zone ──────────────────────────────────────────────
    &__dropzone {
        border: 2px dashed #30363d;
        border-radius: 8px;
        padding: 60px 20px;
        text-align: center;
        cursor: pointer;
        background: #161b22;
        min-height: 220px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        transition: border-color 0.2s, background 0.2s;

        &:hover,
        &.drag-over {
            border-color: #6FC3DF;
            background: #1c2128;
        }
    }

    &__drop-label {
        font-size: 14px;
        color: #c9d1d9;
    }

    // ── Preview ────────────────────────────────────────────────
    &__preview {
        width: 100%;
        background: #161b22;
        border: 1px solid #30363d;
        border-radius: 6px;
        overflow: hidden;
        min-height: 200px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 12px;

        // Preview grid fills width; JS sets aspect ratio via padding-top trick
        > div {
            width: 100%;
        }
    }

    // ── Template strip ─────────────────────────────────────────
    &__strip {
        display: flex;
        gap: 8px;
        overflow-x: auto;
        padding: 4px 0 10px;
        margin-bottom: 12px;
        scrollbar-width: none;

        &::-webkit-scrollbar {
            display: none;
        }
    }

    &__template-btn {
        flex: 0 0 64px;
        height: 64px;
        background: #161b22;
        border: 2px solid #30363d;
        border-radius: 6px;
        padding: 8px;
        cursor: pointer;
        transition: border-color 0.15s, background 0.15s;
        color: #c9d1d9;

        svg {
            width: 100%;
            height: 100%;
            fill: currentColor;
        }

        &:hover {
            border-color: #6FC3DF;
        }

        &.active {
            border-color: #6FC3DF;
            background: #1c2128;
            color: #6FC3DF;
        }
    }

    // ── Actions row ────────────────────────────────────────────
    &__actions {
        display: flex;
        gap: 10px;
        margin-bottom: 12px;
    }

    &__add-btn {
        flex: 1;
        padding: 10px;
        background: transparent;
        border: 1px solid #30363d;
        border-radius: 4px;
        color: #c9d1d9;
        cursor: pointer;
        font-family: inherit;
        font-size: 12px;
        transition: border-color 0.2s;

        &:hover {
            border-color: #6FC3DF;
        }
    }

    &__clear-btn {
        padding: 10px 14px;
        background: transparent;
        border: 1px solid #30363d;
        border-radius: 4px;
        color: #8b949e;
        cursor: pointer;
        font-family: inherit;
        font-size: 12px;
        transition: border-color 0.2s, color 0.2s;

        &:hover {
            border-color: #f85149;
            color: #f85149;
        }
    }

    // ── Advanced options ───────────────────────────────────────
    &__advanced-toggle {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        padding: 10px 12px;
        background: transparent;
        border: 1px solid #30363d;
        border-radius: 4px;
        color: #8b949e;
        cursor: pointer;
        font-family: inherit;
        font-size: 12px;
        text-align: left;
        margin-bottom: 8px;
        transition: border-color 0.2s, color 0.2s;

        &:hover {
            color: #c9d1d9;
            border-color: #6FC3DF;
        }

        &[aria-expanded="true"] {
            color: #c9d1d9;
            border-color: #6FC3DF;
        }
    }

    &__toggle-icon {
        display: inline-block;
        transition: transform 0.2s;
        font-size: 10px;

        &.open {
            transform: rotate(180deg);
        }
    }

    &__advanced {
        background: #161b22;
        border: 1px solid #30363d;
        border-radius: 4px;
        padding: 16px;
        margin-bottom: 12px;
    }

    // ── Shared control styles ──────────────────────────────────
    &__control {
        margin-bottom: 16px;

        &:last-child {
            margin-bottom: 0;
        }
    }

    &__label {
        display: block;
        color: #8b949e;
        font-size: 11px;
        margin-bottom: 8px;
    }

    &__pills {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
    }

    &__pill {
        flex: 1;
        min-width: 60px;
        padding: 7px 10px;
        background: transparent;
        border: 1px solid #30363d;
        border-radius: 4px;
        color: #8b949e;
        cursor: pointer;
        font-family: inherit;
        font-size: 11px;
        transition: border-color 0.15s, color 0.15s, background 0.15s;

        &:hover {
            border-color: #6FC3DF;
            color: #c9d1d9;
        }

        &.active {
            border-color: #6FC3DF;
            color: #6FC3DF;
            background: #0d1117;
        }
    }

    &__slider {
        width: 100%;
        appearance: none;
        height: 4px;
        background: #30363d;
        border-radius: 2px;
        outline: none;
        cursor: pointer;

        &::-webkit-slider-thumb {
            appearance: none;
            width: 16px;
            height: 16px;
            background: #6FC3DF;
            border-radius: 50%;
            cursor: pointer;
        }

        &::-moz-range-thumb {
            width: 16px;
            height: 16px;
            background: #6FC3DF;
            border-radius: 50%;
            border: none;
            cursor: pointer;
        }
    }

    &__color-row {
        display: flex;
        gap: 8px;
        align-items: center;

        input[type="color"] {
            width: 44px;
            height: 32px;
            border: 1px solid #30363d;
            border-radius: 4px;
            background: transparent;
            cursor: pointer;
            padding: 2px;
        }

        input[type="text"] {
            flex: 1;
            padding: 6px 8px;
            background: #0d1117;
            border: 1px solid #30363d;
            border-radius: 4px;
            color: #c9d1d9;
            font-family: 'Courier New', monospace;
            font-size: 11px;
        }
    }

    // ── Download button ────────────────────────────────────────
    &__download {
        display: block;
        width: 100%;
        padding: 14px;
        margin-top: 4px;
        background: #238636;
        border: 1px solid #2ea043;
        border-radius: 6px;
        color: #fff;
        font-family: inherit;
        font-size: 14px;
        font-weight: bold;
        cursor: pointer;
        text-align: center;
        transition: background 0.2s;
        touch-action: manipulation;

        &:hover {
            background: #2ea043;
        }

        &:active {
            transform: scale(0.99);
        }
    }

    // ── Download modal ─────────────────────────────────────────
    &__modal {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.7);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;

        &[hidden] {
            display: none;
        }
    }

    &__modal-inner {
        background: #161b22;
        border: 2px solid #6FC3DF;
        border-radius: 8px;
        padding: 24px;
        width: 380px;
        max-width: 90vw;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
    }

    &__modal-title {
        color: #6FC3DF;
        font-size: 15px;
        margin: 0 0 16px;
    }

    &__modal-info {
        background: #0d1117;
        border: 1px solid #30363d;
        border-radius: 4px;
        padding: 12px;
        margin-bottom: 16px;
    }

    &__modal-dims {
        color: #c9d1d9;
        font-size: 18px;
        font-weight: bold;
        font-family: 'Courier New', monospace;
    }

    &__modal-size {
        color: #6FC3DF;
        font-size: 11px;
        margin-top: 4px;
    }

    &__modal-scales {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 8px;
        margin-bottom: 16px;
    }

    &__modal-footer {
        display: flex;
        gap: 10px;
        justify-content: flex-end;
        margin-top: 16px;
    }

    &__cancel-btn {
        padding: 8px 16px;
        background: #21262d;
        border: 1px solid #30363d;
        border-radius: 4px;
        color: #8b949e;
        cursor: pointer;
        font-family: inherit;
        font-size: 12px;
    }

    &__confirm-btn {
        padding: 8px 16px;
        background: #238636;
        border: 1px solid #2ea043;
        border-radius: 4px;
        color: #fff;
        cursor: pointer;
        font-family: inherit;
        font-size: 12px;
        font-weight: bold;
    }

    // ── Image drag cursor (cover mode) ─────────────────────────
    .merger-image-cover {
        cursor: grab;

        &:active {
            cursor: grabbing;
        }
    }

    // ── Tablet+ ────────────────────────────────────────────────
    @media (min-width: 600px) {
        &__template-btn {
            flex: 0 0 80px;
            height: 80px;
        }
    }

    @media (min-width: 768px) {
        &__preview {
            min-height: 300px;
        }

        &__template-btn {
            flex: 0 0 90px;
            height: 90px;
        }

        &__download {
            font-size: 16px;
            padding: 16px;
        }
    }
}
```

**Step: Verify Sass compiles**
Watch the terminal running `npm run dev`. After saving the SCSS file, the Sass watcher should output:
```
Compiled src/_includes/sass/style.scss
```
No errors. If there's an error, fix the SCSS syntax before proceeding.

**Step: Verify in browser**
Open `http://localhost:8080/tools/` → Image Tools tab.
Expected: Drop zone is styled with dashed border, `[   ]` monospace icon, correct dark background. No layout shift.

**Step: Commit**
```bash
git add src/_includes/sass/partials/_bareblocks.scss
git commit -m "feat(merger): mobile-first SCSS for .bb-merger"
```

---

## Task 4: Rewrite `bareblocks-merger.js` — Part 1: State machine + file loading

**Files:**
- Rewrite: `src/js/bareblocks-merger.js`

This task creates the new file from scratch. Start with this foundation (Tasks 5–10 add more functions):

```js
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

initMerger();
```

**Step: Verify in browser**
Open Image Tools tab. Drop an image.
Expected: Drop zone disappears, `merger-loaded` section becomes visible (even if preview is empty for now — next task adds the preview render). No console errors.

**Step: Commit**
```bash
git add src/js/bareblocks-merger.js
git commit -m "feat(merger): state machine + file loading"
```

---

## Task 5: Template system — layout builders + strip renderer

**Files:**
- Modify: `src/js/bareblocks-merger.js` — add after `initMerger()`

**Step 1: Copy layout builder functions from the old file**

Add these functions (copy from existing `bareblocks-merger.js` in git history, they are correct):

```js
// ── Layout builders (keep as-is from original) ──────────────
function buildGridLayout(count, columns) { /* ... copy from original line 787 */ }
function buildHeroLeftLayout(count)      { /* ... copy from original line 798 */ }
function buildHeroRightLayout(count)     { /* ... copy from original line 824 */ }
function buildHeroTopLayout(count)       { /* ... copy from original line 850 */ }
function buildHeroBottomLayout(count)    { /* ... copy from original line 876 */ }
function buildSpotlightLayout(count)     { /* ... copy from original line 902 */ }
function buildSplitLayout(count)         { /* ... copy from original line 915 */ }
function getClipPolygonArray(type)       { /* ... copy from original line 929 */ }
function getClipPolygonPoints(type)      { /* ... copy from original line 945 */ }
function extendLayoutWithOverflow(layout, count) { /* ... copy from original line 951 */ }
```

**Important:** Copy the exact function bodies verbatim. Do not alter them.

**Step 2: Copy templateLibrary array**

```js
// Copy templateLibrary verbatim from original lines 971–1075
const templateLibrary = [ /* ... all 12 entries ... */ ];
```

**Step 3: Add template helpers**

```js
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
```

**Step 4: Add strip renderer**

```js
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
```

**Step: Verify in browser**
Drop 2 images. Expected: a row of template SVG buttons appears below the (still empty) preview area. Clicking different buttons updates the active highlight. Check count:
- 2 images → should show `split-vertical`, `split-horizontal`, `diagonal-split`
- Drop a 3rd image → strip updates to show 3-image templates

**Step: Commit**
```bash
git add src/js/bareblocks-merger.js
git commit -m "feat(merger): template library + strip renderer"
```

---

## Task 6: Preview renderer (`updatePreview`)

**Files:**
- Modify: `src/js/bareblocks-merger.js` — add `updatePreview`, `calculateMergeDimensions`

```js
// ── Dimensions ──────────────────────────────────────────────
function calculateMergeDimensions() {
    // Copy verbatim from original lines 1142–1163, then update:
    // Replace references to `frameSize` with `spacing`
    // (the variable rename is the only change needed)
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
```

**Note on `calculateMergeDimensions`:** Copy the original function body from lines 1142–1163 but:
1. Replace `frameSize` with `spacing` (variable rename)
2. Keep everything else identical

**Step: Verify in browser**
Drop 2 images. Expected:
- Preview canvas shows the two images side-by-side in the default template
- Swapping templates updates the preview layout immediately
- Drop a 3rd image — preview updates to show 3 cells
- On a narrow browser window (< 400px), the preview still fills the width correctly

**Step: Commit**
```bash
git add src/js/bareblocks-merger.js
git commit -m "feat(merger): preview renderer with responsive sizing"
```

---

## Task 7: Wire advanced options controls

**Files:**
- Modify: `src/js/bareblocks-merger.js` — implement `wireAdvancedControls()`

```js
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
```

**Step: Verify in browser**
Open Advanced options. Expected:
- Cover: preview images fill cells (may crop), contain: letterboxed, fill: stretched
- Spacing slider 0 → images touch edge-to-edge; 20 → visible gap with frame color
- Corner radius 10 → rounded corners visible on each cell
- Color picker: change to white (#ffffff) → frame color updates live in preview

**Step: Commit**
```bash
git add src/js/bareblocks-merger.js
git commit -m "feat(merger): wire advanced options — fit, spacing, radius, color"
```

---

## Task 8: Download button estimate + modal

**Files:**
- Modify: `src/js/bareblocks-merger.js` — implement `updateDownloadButton`, `openDownloadModal`, `wireModal`

```js
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
```

**Step: Verify in browser**
Drop 2 images. Expected:
- Download button shows `⬇ Download  ·  ~X.X MB`
- Tap Download → modal opens with pixel dims and size estimate
- Switch to 50% → dims update to half, size shrinks
- Custom slider at 150% → dims grow, estimate increases
- Cancel → modal closes, no download
- Confirm → modal closes (download happens in next task)

**Step: Commit**
```bash
git add src/js/bareblocks-merger.js
git commit -m "feat(merger): download modal with live size estimate"
```

---

## Task 9: Canvas download engine

**Files:**
- Modify: `src/js/bareblocks-merger.js` — add `downloadMergedImage`

Copy the body of `downloadMergedImage` from the original (lines 1472–1657) and make these changes:

1. Replace `frameSize` with `spacing` everywhere
2. Remove the text overlay rendering block (lines 1561–1645 in original — the `if (item.text && item.text.content)` block)
3. Remove the empty cell branch (`else { ctx.fillStyle = item.color; ... }`) — mergeItems no longer has empty items
4. Add corner radius clipping for each cell using `ctx.roundRect()`:

```js
// After computing innerX, innerY, innerWidth, innerHeight
// and BEFORE drawing the image, add clipping:
if (cornerRadius > 0) {
    const r = Math.round(cornerRadius * outputScale);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(innerX, innerY, innerWidth, innerHeight, r);
    ctx.clip();
}

// ...draw image...

if (cornerRadius > 0) {
    ctx.restore();
}
```

5. Update the download filename:
```js
a.download = `merged_${Date.now()}.png`;
```

The full function skeleton (fill in the body from original, with changes above):

```js
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
```

**Step: Verify in browser**
Load 3 images. Set a template, change spacing to 10, set frame color to white, set corner radius to 8. Click Download → confirm. Expected:
- PNG downloads to your computer
- Open it: frame gaps are white, corners are rounded, images are correctly positioned and fitted
- Confirm the aspect ratio matches what the preview showed

**Step: Commit**
```bash
git add src/js/bareblocks-merger.js
git commit -m "feat(merger): canvas download engine with spacing + corner radius"
```

---

## Task 10: Image pan in Cover mode

**Files:**
- Modify: `src/js/bareblocks-merger.js` — implement `wirePan()`

```js
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
```

**Step: Verify in browser**
- Set Image Fit to Cover
- Drag an image in the preview → it pans within its cell
- Download → the download reflects the pan offset

**Step: Commit**
```bash
git add src/js/bareblocks-merger.js
git commit -m "feat(merger): image pan in cover mode — mouse + touch"
```

---

## Task 11: Final integration, mobile test, cleanup

**Step 1: Test mobile layout**

In Chrome DevTools, set device to iPhone SE (375px wide). Open `/tools/` → Image Tools tab.
Check:
- [ ] Drop zone fills the screen, readable
- [ ] After dropping images: preview is at top, fills width
- [ ] Template strip scrolls horizontally without cutting off
- [ ] "+ Add images" and "× Clear all" buttons are full-width-ish and tap-friendly
- [ ] "Advanced options" collapses/expands smoothly
- [ ] "Download" button is at the bottom, large, easy to tap
- [ ] Download modal is centered, doesn't overflow screen

**Step 2: Test desktop layout**

At full browser width (1200px+).
Check:
- [ ] Preview has reasonable max size (doesn't stretch to 1200px)
- [ ] Template strip shows nicely, no horizontal scroll needed for 3-4 templates
- [ ] Everything still vertically stacked (not reverting to old side-panel layout)

**Step 3: Test Metadata tab**

Click the "Metadata" tab. Confirm it works exactly as before — file drop, EXIF output, all sections. The Metadata tab must be completely unaffected.

**Step 4: Remove any leftover inline styles from old modals**

Confirm that `tools.njk` no longer has the old `text-edit-modal` or `output-size-modal` divs. Do a search:
```bash
grep -n "text-edit-modal\|output-size-modal" src/tools.njk
```
Expected: no output (those divs are gone).

**Step 5: Commit any final cleanup**
```bash
git add -p  # review changes
git commit -m "fix(merger): integration cleanup — verified on mobile + desktop"
```

**Step 6: Push branch**
```bash
git push -u origin feature/image-merger-overhaul
```

---

## Task 12: Save memory and open PR

**Step 1: Update memory file**

Add to `~/.claude/projects/.../memory/MEMORY.md`:
```
## Image Tools (BareBlocks)
- JS: `src/js/bareblocks-merger.js` (~600 lines post-overhaul)
- SCSS: `.bb-merger` block at end of `_bareblocks.scss`
- HTML: `imagetools-tab` div in `src/tools.njk`
- Layout builders and templateLibrary are stable — do not modify without re-testing canvas download
- No automated tests — verify in browser at localhost:8080/tools/
```

**Step 2: Create PR**
```bash
gh pr create \
  --title "Overhaul Image Merger: mobile-first progressive reveal UI" \
  --body "$(cat <<'EOF'
## Summary
- Rewrites the Image Tools tab with a mobile-first progressive reveal layout
- Preview is always the first thing visible after dropping images
- Template strip scrolls horizontally below the preview
- Advanced options (fit, spacing, radius, color) collapse behind a toggle
- Download button shows live file size estimate
- Drops text overlay and empty cells features (YAGNI)
- All styles moved from inline to `.bb-merger` SCSS block

## Test plan
- [ ] Drop 2, 3, 4 images — template strip updates to show relevant layouts
- [ ] Each template updates the preview correctly
- [ ] Cover mode + pan works on desktop (mouse) and mobile (touch)
- [ ] Spacing/radius/color update live in preview and in downloaded PNG
- [ ] Download modal shows correct dimensions and size estimate
- [ ] Downloaded PNG matches the preview
- [ ] Metadata tab completely unaffected
- [ ] Tested at 375px (iPhone SE), 768px (tablet), 1200px (desktop)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Notes for the implementer

- **No test framework exists.** All verification is in-browser. Be thorough.
- **`npm run dev` must be running** throughout — it compiles Sass on save and hot-reloads.
- **SCSS compiles automatically** — save the `.scss` file and check the terminal for compile errors before checking the browser.
- **The Metadata tab must stay working** — never modify `bareblocks-metadata.js`.
- **`ctx.roundRect()`** is used for canvas corner radius — supported in Chrome 99+, Firefox 112+, Safari 15.4+. No polyfill needed for this tool's audience.
- **Template SVG thumbnails** use `fill: currentColor` — they inherit the button's text color, which toggles between `#c9d1d9` (inactive) and `#6FC3DF` (active) via CSS.
