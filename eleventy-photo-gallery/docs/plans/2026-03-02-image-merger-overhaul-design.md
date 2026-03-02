# Image Merger Overhaul — Design Document
**Date:** 2026-03-02
**Status:** Approved

---

## Problem

The current Image Tools tab uses a side-by-side layout (settings panel left, preview right).
On mobile, `flex-wrap` kicks in and the settings panel renders first, pushing the live
preview and Download button to the very bottom of the page. This is the opposite of what
the user needs on mobile. Additionally, ~10 controls are exposed at once even before any
images are loaded, creating cognitive overload.

---

## Goals

- Mobile-first: preview is always the primary element, visible without scrolling
- Progressive disclosure: nothing is shown until the user needs it
- Simplicity: layout choice driven by smart templates, not manual grid controls
- Clean: remove text overlay, empty cells, manual mode buttons — keep only what matters

---

## Approach: Progressive Reveal (Option A)

Pure vertical single-column layout. No side panels. Three UI states managed in JS.

### State Machine

```
EMPTY  →  (drop images)  →  LOADED
                              ↕ (tap "Advanced options")
                           ADVANCED
LOADED  →  (tap Download)  →  DOWNLOAD MODAL
```

---

## UI Structure

### Empty State
Full-width drop zone. Nothing else.

```
┌─────────────────────────────────────┐
│                                     │
│   [  drop images · tap to browse  ] │
│                                     │
└─────────────────────────────────────┘
```

### Loaded State (after images dropped)

```
┌─────────────────────────────────────┐
│                                     │
│          [ LIVE PREVIEW ]           │  canvas, aspect-ratio aware
│                                     │
├─────────────────────────────────────┤
│  ← [ T1 ][ T2 ][ T3 ][ T4 ] →    │  template strip (horizontal scroll)
├─────────────────────────────────────┤
│  [ + Add images ]  [ × Clear all ] │
├─────────────────────────────────────┤
│  ▾  Advanced options                │  collapsed by default
├─────────────────────────────────────┤
│   [  ⬇ Download · ~4.2 MB  ]       │  live size estimate
└─────────────────────────────────────┘
```

### Advanced Options (expanded inline)

```
│  ▴  Advanced options                │
├─────────────────────────────────────┤
│  Image Fit: [Cover] [Contain] [Fill]│
│  Spacing:   ━━━━●━━━━   12px       │
│  Radius:    ━━●━━━━━━   4px        │
│  Color:     [■] #0d1117            │
```

---

## Template Strip

Templates are SVG thumbnails. Only templates matching the current image count are shown.

### Templates by count

| Count | Templates |
|-------|-----------|
| 2 | Side by Side `[│]`, Stack `[─]`, Featured `[██│]` |
| 3 | Equal Row `[│·│]`, Stack 3, Featured+2 `[██│⊤⊥]`, Panorama |
| 4 | 2×2 Grid, Row of 4, Featured+3, L-shape |
| 5 | 2+3 rows, 3+2 rows, Featured+4 |

Default template is always the first in the list for the current image count.
Tapping a template applies it instantly to the preview canvas.

---

## Advanced Options Panel

Single accordion, collapsed by default. Controls:

1. **Image Fit** — 3 pill buttons: `Cover` · `Contain` · `Fill`
2. **Spacing** — slider 0–40px (gap between cells + outer frame)
3. **Corner Radius** — slider 0–20px (per-cell rounding)
4. **Frame Color** — color swatch + hex input

Removed from current tool:
- Layout Mode buttons (Auto Grid / Manual Grid / Horizontal / Vertical) — replaced by templates
- Grid Columns slider — replaced by templates
- Scale Down fit option — rarely used
- Empty Cells system
- Text overlay system

---

## Download Modal

Triggered by the Download button. Shows:
- Output pixel dimensions (live, updates with scale)
- Estimated file size (live)
- Scale: `100%` / `75%` / `50%` / custom slider
- `Cancel` + `Download` buttons

---

## Technical Architecture

### HTML (`tools.njk` — imagetools-tab section)
- Remove all inline styles from the Image Tools section
- New structure: `.bb-merger` wrapper > `.bb-merger__dropzone`, `.bb-merger__preview`, `.bb-merger__strip`, `.bb-merger__actions`, `.bb-merger__advanced`, `.bb-merger__download`
- BEM naming convention scoped under `.bb-app`

### JS (`bareblocks-merger.js`)
- Full rewrite, target ~600 lines (from 1657)
- Remove: text overlay system, empty cells, manual layout modes
- Add: `setState(state)` function controlling visibility of sections
- Template thumbnails: inline SVG strings (no canvas for picker)
- Keep: canvas rendering engine, image drag-to-reorder, download/scale logic
- State variables simplified to: `mergeItems`, `selectedTemplate`, `imageFit`, `spacing`, `cornerRadius`, `frameColor`, `outputScale`

### CSS (`_bareblocks.scss`)
- New `.bb-merger` block at end of file
- Mobile-first: base = narrow screens
- `@media (min-width: 768px)`: preview gets `max-height: 65vh`, larger template thumbnails
- No inline styles in HTML

---

## What is Preserved

- BareBlocks terminal aesthetic (colors, fonts, borders)
- Tab system (Metadata | Image Tools)
- Canvas-based rendering and PNG download
- Drag-to-reorder images
- All existing Metadata tab functionality untouched

---

## Branch

`feature/image-merger-overhaul`
