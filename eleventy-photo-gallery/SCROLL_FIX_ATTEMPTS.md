# Scroll Fix Attempts - Home Page Mobile Issue

## Problem
On iPhone, scrolling the home page triggers image clicks, opening the lightbox unintentionally. This makes the app unusable.

## ✅ Final Solution (Attempt 6)
**CSS-based pointer blocking during scroll** - Physically disables pointer events on gallery buttons when scrolling is detected. Simple, reliable, works with browser behavior instead of fighting it.

See "Attempt 6" section below for full implementation details.

## Attempt History

### Attempt 1: Touch handlers with movement detection
**What was tried:**
- Added `touchstart`, `touchmove`, `touchend` handlers
- Tracked finger movement (deltaX, deltaY)
- Set threshold (15px) to detect scrolling vs tapping
- Only trigger lightbox if movement < threshold

**Why it failed:**
- Race condition: Click events fire before scroll detection completes
- Timing mismatch: `touchMoved` flag not set when click fires
- Global touch listeners interfere with natural browser behavior

**Status:** ❌ FAILED

---

### Attempt 2: Scroll event listener
**What was tried:**
- Added `scroll` event listener to detect actual page scrolling
- Set `isScrolling` flag when scroll detected
- Prevent click if `isScrolling` is true

**Why it failed:**
- Click fires BEFORE scroll event completes
- Sequence: touchstart → touchend → click → scroll
- By the time scroll sets flag, click already fired

**Status:** ❌ FAILED

---

### Attempt 3: Combined approach (flags + time checks)
**What was tried:**
- Combined touch movement detection + scroll events
- Added time-based checks (if >500ms since touch start, likely scroll)
- Multiple flags: `isScrolling`, `touchMoved`, `touchHandled`
- Used `requestAnimationFrame` to check scroll position

**Why it failed:**
- Still race conditions
- Too complex, multiple failure points
- Global document listeners interfere with browser's natural behavior

**Status:** ❌ FAILED

---

### Attempt 4: Simple click events only (revert)
**What was tried:**
- Removed ALL touch handlers
- Removed ALL scroll detection
- Simple click event handler only
- Relied on browser's natural scroll suppression

**Why it failed:**
- Still triggers clicks when scrolling starts
- Browser's natural suppression not working as expected
- Possible interference from `preventDefault()` or button element behavior

**Status:** ❌ FAILED

---

## Current State (Attempt 4)
- Using `<button>` elements
- Calling `event.preventDefault()` on every click
- CSS `touch-action: manipulation` applied
- Simple click handler only

## Root Cause Analysis

### Suspected Issues:
1. **Button element behavior**: iOS Safari handles buttons differently than links/divs
2. **preventDefault() interference**: May block browser's natural scroll detection
3. **touch-action: manipulation**: May prioritize clicks over scroll detection
4. **Full-width button**: Button covers entire slide, may capture all touches

### What Changed from Working State:
- Switched from `<a>` tags to `<button>` tags (when implementing lightbox)
- Added `touch-action: manipulation` CSS
- Added `preventDefault()` on clicks

---

---

## Attempt 5: Remove preventDefault + Change touch-action
**What was tried:**
- Remove `event.preventDefault()` from click handler
- Change CSS `touch-action` from `manipulation` to `pan-y`
- Keep `stopPropagation()` to prevent event bubbling
- Theory: `preventDefault()` blocks browser's natural scroll detection, `manipulation` prioritizes taps over scrolls

**Why it failed:**
- Still triggers clicks when scrolling starts
- Browser's natural suppression not working as expected
- iOS Safari fires synthetic click events after touchend even when scrolling occurred

**Status:** ❌ FAILED

---

## Attempt 6: CSS-based pointer blocking during scroll ✅ SUCCESS
**What was implemented:**
- JavaScript: Added scroll listener that applies `is-scrolling` class to `body` element
- Debounce: 150ms timeout after scroll ends before removing class
- CSS: Added `pointer-events: none` to `.gallery-slide__link` when `body.is-scrolling` is active

**Implementation details:**
1. **JavaScript (home-gallery-lightbox.js:140-149):**
   ```javascript
   let scrollTimeout;
   const handleScroll = () => {
       document.body.classList.add('is-scrolling');
       clearTimeout(scrollTimeout);
       scrollTimeout = setTimeout(() => {
           document.body.classList.remove('is-scrolling');
       }, 150);
   };
   window.addEventListener('scroll', handleScroll, { passive: true });
   ```

2. **CSS (_gallery.scss:58-60):**
   ```scss
   body.is-scrolling .gallery-slide__link {
       pointer-events: none;
   }
   ```

**Why it works:**
- **CSS-based approach**: Physically disables pointer events during scroll
- **Works with browser behavior**: Doesn't fight iOS Safari's synthetic click events
- **Simple and reliable**: No complex touch tracking or timing logic
- **Prevents clicks at the CSS level**: Clicks can't fire if pointer-events is disabled

**Result:** ✅ WORKING - Home page scrolling now works correctly on mobile without triggering unwanted lightbox opens

**Status:** ✅ SUCCESS

