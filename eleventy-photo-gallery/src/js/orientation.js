const WATCH_ATTR = "data-orientation-watch";
const PORTRAIT_CLASS = "is-portrait";
const LANDSCAPE_CLASS = "is-landscape";
const ATTACHED_ATTR = "data-orientation-listening";

function classifyImage(img) {
  if (!img || !img.naturalWidth || !img.naturalHeight) return;
  img.classList.remove(PORTRAIT_CLASS, LANDSCAPE_CLASS);
  if (img.naturalHeight > img.naturalWidth) {
    img.classList.add(PORTRAIT_CLASS);
  } else {
    img.classList.add(LANDSCAPE_CLASS);
  }
}

function attachWatcher(img) {
  if (!img || img.getAttribute(ATTACHED_ATTR)) return;
  img.setAttribute(ATTACHED_ATTR, "1");

  if (img.complete) {
    classifyImage(img);
  }

  img.addEventListener("load", () => classifyImage(img), { passive: true });
}

function scan(root = document) {
  const candidates = root.querySelectorAll(`img[${WATCH_ATTR}]`);
  candidates.forEach(attachWatcher);
}

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      if (node.matches && node.matches(`img[${WATCH_ATTR}]`)) {
        attachWatcher(node);
      }
      if (node.querySelectorAll) {
        scan(node);
      }
    }
  }
});

if (typeof document !== "undefined") {
  scan(document);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

export { classifyImage, scan as registerOrientationWatchers };

