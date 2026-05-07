/**
 * Prepends `[ENV] ` to document.title and re-applies whenever ServiceNow
 * rewrites the title (which happens on every SPA navigation).
 *
 * Three guards prevent double-prepending and infinite loops:
 *   1. The strip regex only matches prefixes WE applied (known env labels).
 *   2. Early-return when the title is already correct.
 *   3. `applyingTitle` flag suppresses our own observer feedback.
 */

const NF_PREFIX_RE = /^\[(DEV|TEST|UAT|STAGING|PROD|UNKNOWN|[A-Z][A-Z0-9_-]{0,15})\]\s+/;

let titleObserver: MutationObserver | null = null;
let headObserver: MutationObserver | null = null;
let applyingTitle = false;
let currentLabel: string | null = null;

function applyOnce(label: string): void {
  const prefix = `[${label.toUpperCase()}] `;
  const current = document.title;
  const stripped = current.replace(NF_PREFIX_RE, '');
  const next = prefix + stripped;
  if (current === next) return;
  applyingTitle = true;
  document.title = next;
  queueMicrotask(() => { applyingTitle = false; });
}

/** Stop watching and clear any prefix we previously applied. */
export function stopTabTitle(): void {
  titleObserver?.disconnect();
  headObserver?.disconnect();
  titleObserver = null;
  headObserver = null;
  if (currentLabel) {
    document.title = document.title.replace(NF_PREFIX_RE, '');
    currentLabel = null;
  }
}

/**
 * Apply the prefix and watch the <title> element so we re-apply whenever
 * SN's own code overwrites it. Call this on initial load and after SPA nav.
 */
export function startTabTitle(label: string): void {
  // Tear down anything previous so we don't stack observers
  titleObserver?.disconnect();
  headObserver?.disconnect();
  titleObserver = null;
  headObserver = null;

  currentLabel = label;
  applyOnce(label);

  const titleEl = document.querySelector('title');
  if (!titleEl) {
    // <title> doesn't exist yet — wait for it
    if (document.head) {
      headObserver = new MutationObserver(() => {
        if (document.querySelector('title')) {
          headObserver?.disconnect();
          headObserver = null;
          startTabTitle(label);
        }
      });
      headObserver.observe(document.head, { childList: true });
    }
    return;
  }

  titleObserver = new MutationObserver(() => {
    if (applyingTitle) return;
    if (currentLabel) applyOnce(currentLabel);
  });
  titleObserver.observe(titleEl, {
    childList: true,
    characterData: true,
    subtree: true,
  });
}
