import { UIB_URL_PATTERNS, PREVIEW_IFRAME_SELECTORS } from './selectors.js';

/** Returns true if the current page URL matches a UI Builder pattern. */
export function isUibPage(url: string = window.location.href): boolean {
  return UIB_URL_PATTERNS.some((re) => re.test(url));
}

/**
 * Find the UIB preview iframe. Tries each selector; falls back to scanning
 * every iframe and picking the first same-origin one that contains likely
 * UIB content (a custom element with a `now-` prefix).
 *
 * Returns null if nothing looks like a preview frame — caller should fall
 * back to scanning the top document.
 */
export function findPreviewIframe(): HTMLIFrameElement | null {
  // Selector-based attempts first
  for (const sel of PREVIEW_IFRAME_SELECTORS) {
    const frame = document.querySelector<HTMLIFrameElement>(sel);
    if (frame && isAccessibleIframe(frame)) return frame;
  }

  // Heuristic fallback: scan every iframe, return one whose document body
  // contains a `now-`/`sn-`/`uib-`/`sp-` custom element.
  for (const frame of Array.from(document.querySelectorAll('iframe'))) {
    if (!isAccessibleIframe(frame)) continue;
    const doc = frame.contentDocument;
    if (!doc) continue;
    if (doc.querySelector('[class*="uib-"], now-canvas, sn-canvas, uib-canvas, uib-renderer')) {
      return frame;
    }
  }
  return null;
}

/** Same-origin iframe check; cross-origin frames throw on contentDocument access. */
function isAccessibleIframe(frame: HTMLIFrameElement): boolean {
  try {
    return Boolean(frame.contentDocument && frame.contentWindow);
  } catch {
    return false;
  }
}

/**
 * Best-effort: get the document we should scan for components.
 * Order: preview iframe → top-level document.
 */
export function getUibScanDocument(): Document {
  const frame = findPreviewIframe();
  if (frame?.contentDocument) return frame.contentDocument;
  return document;
}

/** Best-effort: get the window where page-context bridges should run. */
export function getUibPageWindow(): Window {
  const frame = findPreviewIframe();
  if (frame?.contentWindow) return frame.contentWindow;
  return window;
}

/**
 * Read the UIB page name. UIB sets the document title to the page label,
 * but this varies across versions. Falls back to "(unknown)".
 */
export function getUibPageName(): string {
  const doc = getUibScanDocument();
  const title = doc.title || document.title;
  // Strip "ServiceNow" suffix
  return title.replace(/\s*\|\s*ServiceNow.*$/i, '').trim() || '(unknown)';
}
