/**
 * ALL DOM-specific selectors and best-guess property names live here.
 * After inspecting your actual UI Builder pages, adjust these and the rest
 * of the feature should pick up the new selectors automatically.
 *
 * Each constant is preceded by a `// VERIFY:` comment describing the assumption.
 */

// VERIFY (1): Preview iframe inside the UIB editor.
// In recent SN versions the editor wraps the rendered page in an iframe.
// Try multiple known classes/attributes; first match wins.
export const PREVIEW_IFRAME_SELECTORS: string[] = [
  'iframe.ui-builder-preview',
  'iframe[data-uib-preview]',
  'iframe[name*="preview" i]',
  'iframe[title*="preview" i]',
  'iframe[id*="preview" i]',
  // Workspace UIB sometimes embeds in a uib-renderer element
  'uib-renderer iframe',
];

// VERIFY (2): URL patterns that indicate a UI Builder page.
// We test against window.location.href.
export const UIB_URL_PATTERNS: RegExp[] = [
  /\/now\/builder\b/i,
  /\/\$uib\b/i,
  /\bui[-_]builder\b/i,
];

// VERIFY (3): The root component element inside the preview iframe.
// We look for an element wrapping the entire rendered page. If we can't
// find it, we fall back to walking from `document.body`.
export const PAGE_ROOT_SELECTORS: string[] = [
  'sn-canvas',
  'now-canvas',
  'uib-canvas',
  'uib-renderer',
  '[data-uib-page-root]',
];

// VERIFY (4): How to identify a "Now Experience" / Seismic component.
// Best-guess: any element whose tag contains a hyphen (custom-element
// naming convention) AND starts with one of these prefixes.
export const COMPONENT_TAG_PREFIXES: string[] = ['now-', 'sn-', 'uib-', 'sp-'];

// VERIFY (5): Attribute names on UIB components that tell us their friendly
// "display name" from the UIB config (e.g. "Welcome heading"). Tried in order.
export const DISPLAY_NAME_ATTRS: string[] = [
  'data-uib-display-name',
  'data-name',
  'aria-label',
  'name',
];

// VERIFY (6): JS-property names where Now Experience components stash their
// internal state, props, and bindings. Tried in order. The page-context
// bridge reads these via the actual element instance.
export const COMPONENT_STATE_PROPS: string[] = ['__state', '_state', 'state'];
export const COMPONENT_PROPS_PROPS: string[] = ['_props', '__props', 'props'];
export const COMPONENT_BINDINGS_PROPS: string[] = [
  '__bindings',
  '_bindings',
  'bindings',
  '__dataBindings',
];
export const COMPONENT_HANDLERS_PROPS: string[] = [
  '__handlers',
  '_handlers',
  'eventHandlers',
  '__events',
];
export const COMPONENT_DESCRIPTION_PROPS: string[] = [
  '__metadata',
  '_metadata',
  'componentMetadata',
];

// VERIFY (7): Where client state lives in the page world. The first one
// that returns a non-null value wins.
export const CLIENT_STATE_PATHS: string[] = [
  'window.__STORE__?.getState?.()',
  'window.NOW?.uib?.state',
  'window.NOW?.uib?.client?.state',
  'window.__STATE__',
  'window.uibState',
];

// VERIFY (8): Tag names of components whose `value` / `label` / first-text
// child gives a useful preview line in the tree.
export const PREVIEW_TEXT_TAGS: ReadonlySet<string> = new Set([
  'now-heading',
  'now-text',
  'now-label',
  'now-button',
  'now-link',
]);

// Tag → preview field. Where the useful "what does this show" lives.
export const PREVIEW_FIELDS: Record<string, string[]> = {
  'now-heading':       ['label', 'text'],
  'now-text':          ['text', 'value'],
  'now-button':        ['label'],
  'now-link':          ['label', 'text'],
  'now-record-list':   ['table', 'data-table'],
  'now-record-form':   ['table'],
  'now-input':         ['label', 'value'],
  'now-icon':          ['icon'],
};

// VERIFY (9): How to mark "highlight overlay" elements so we can find/remove
// them later. The overlay lives in the preview iframe's document.
export const HIGHLIGHT_OVERLAY_ID = '__nowforge_uib_highlight__';
export const HIGHLIGHT_OVERLAY_STYLE = `
  position: fixed;
  pointer-events: none;
  z-index: 2147483647;
  border: 2px solid #3b82f6;
  background: rgba(59, 130, 246, 0.18);
  border-radius: 3px;
  transition: top 0.08s ease, left 0.08s ease, width 0.08s ease, height 0.08s ease;
`;

// VERIFY (10): Native DOM events we capture for the Event Log. Custom
// component events would require an EventTarget.dispatchEvent monkey-patch
// at document_start, which is deferred to a future iteration.
export const CAPTURED_DOM_EVENTS: string[] = [
  'click',
  'input',
  'change',
  'submit',
  'focus',
  'blur',
];
