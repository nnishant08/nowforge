import { HIGHLIGHT_OVERLAY_ID, HIGHLIGHT_OVERLAY_STYLE } from './selectors.js';

/**
 * Draws a non-interactive overlay over an element to indicate selection
 * from the side-panel tree. Lives inside the same document as the element
 * (so the overlay scrolls with it), uses pointer-events:none so it never
 * blocks clicks.
 */

function ensureOverlay(doc: Document): HTMLElement {
  let el = doc.getElementById(HIGHLIGHT_OVERLAY_ID);
  if (el) return el;
  el = doc.createElement('div');
  el.id = HIGHLIGHT_OVERLAY_ID;
  el.setAttribute('aria-hidden', 'true');
  el.style.cssText = HIGHLIGHT_OVERLAY_STYLE;
  el.style.display = 'none';
  doc.body.appendChild(el);
  return el;
}

export function highlightElement(target: Element): void {
  const doc = target.ownerDocument;
  if (!doc) return;
  const overlay = ensureOverlay(doc);
  const rect = target.getBoundingClientRect();
  overlay.style.display = 'block';
  overlay.style.top = `${rect.top}px`;
  overlay.style.left = `${rect.left}px`;
  overlay.style.width = `${rect.width}px`;
  overlay.style.height = `${rect.height}px`;
}

export function clearHighlight(doc: Document): void {
  const el = doc.getElementById(HIGHLIGHT_OVERLAY_ID);
  if (el) el.style.display = 'none';
}

export function clearAllHighlights(): void {
  // Clear in top doc + all accessible iframes
  clearHighlight(document);
  for (const frame of Array.from(document.querySelectorAll('iframe'))) {
    try {
      const fd = frame.contentDocument;
      if (fd) clearHighlight(fd);
    } catch { /* cross-origin */ }
  }
}
