import type { UibComponentNode } from '../../../shared/messaging.js';
import {
  COMPONENT_TAG_PREFIXES,
  DISPLAY_NAME_ATTRS,
  PAGE_ROOT_SELECTORS,
  PREVIEW_FIELDS,
  PREVIEW_TEXT_TAGS,
} from './selectors.js';

/**
 * Walks the UIB preview DOM and builds a tree of NowForge custom-element
 * descriptors. Tracks each element by a stable id stored on a WeakMap so
 * the side panel can ask for details by id.
 */

let nextId = 1;
const idToElement = new WeakMap<Element, string>();
const elementById = new Map<string, WeakRef<Element>>();

function assignId(el: Element): string {
  const existing = idToElement.get(el);
  if (existing) return existing;
  const id = `nf-uib-${nextId++}`;
  idToElement.set(el, id);
  elementById.set(id, new WeakRef(el));
  return id;
}

/** Look up an element previously assigned an id via the scanner. */
export function elementForId(id: string): Element | null {
  const ref = elementById.get(id);
  if (!ref) return null;
  const el = ref.deref();
  if (!el || !el.isConnected) {
    elementById.delete(id);
    return null;
  }
  return el;
}

function isComponent(tag: string): boolean {
  if (!tag.includes('-')) return false;
  return COMPONENT_TAG_PREFIXES.some((p) => tag.startsWith(p));
}

function getDisplayName(el: Element): string {
  for (const attr of DISPLAY_NAME_ATTRS) {
    const v = el.getAttribute(attr);
    if (v && v.trim()) return v.trim();
  }
  return el.tagName.toLowerCase();
}

function previewFor(el: Element): string | undefined {
  const tag = el.tagName.toLowerCase();
  const fields = PREVIEW_FIELDS[tag];

  if (fields) {
    for (const field of fields) {
      const v = el.getAttribute(field);
      if (v) return truncate(v, 60);
    }
  }
  if (PREVIEW_TEXT_TAGS.has(tag)) {
    const text = (el.textContent ?? '').trim();
    if (text) return truncate(text, 60);
  }
  return undefined;
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}

interface WalkOptions {
  /** Stop walking inside elements we've already counted as a component. */
  stopAtComponents: boolean;
}

/**
 * Walk both light DOM children and an open shadow root. Closed shadow roots
 * are unreachable; we mark the parent node so the UI can communicate this.
 */
function walk(el: Element, parentNode: UibComponentNode, opts: WalkOptions): void {
  const tag = el.tagName.toLowerCase();
  const isCmp = isComponent(tag);

  if (isCmp) {
    const node: UibComponentNode = {
      id: assignId(el),
      tag,
      displayName: getDisplayName(el),
      preview: previewFor(el),
      isClosedShadowHost: false,
      children: [],
    };
    parentNode.children.push(node);

    // Walk shadow root if accessible (open mode)
    const shadow = el.shadowRoot;
    if (shadow) {
      for (const child of Array.from(shadow.children)) walk(child, node, opts);
    } else if (likelyHasClosedShadow(el)) {
      node.isClosedShadowHost = true;
    }

    // Walk light-DOM children (slot content)
    for (const child of Array.from(el.children)) walk(child, node, opts);
    return;
  }

  // Not a component — keep going down through its children to find the next
  // layer of components.
  for (const child of Array.from(el.children)) walk(child, parentNode, opts);
}

/**
 * Heuristic: "likely has a closed shadow root". We can't actually tell, so
 * we say yes if the element is a custom element with no light-DOM children
 * AND no `shadowRoot`. False positives are fine — the badge just informs.
 */
function likelyHasClosedShadow(el: Element): boolean {
  if (el.shadowRoot) return false;
  if (el.children.length > 0) return false;
  return el.tagName.includes('-');
}

/** Scan the given document and return the full component tree. */
export function buildComponentTree(doc: Document): UibComponentNode {
  const root: UibComponentNode = {
    id: 'nf-uib-root',
    tag: 'page',
    displayName: doc.title.replace(/\s*\|\s*ServiceNow.*$/i, '').trim() || 'Page',
    children: [],
  };

  // Find the page root (or fall back to body)
  let scanFrom: Element = doc.body;
  for (const sel of PAGE_ROOT_SELECTORS) {
    const found = doc.querySelector(sel);
    if (found) { scanFrom = found; break; }
  }

  for (const child of Array.from(scanFrom.children)) {
    walk(child, root, { stopAtComponents: false });
  }

  // If we found nothing, retry from <body> in case the page root selector
  // pointed somewhere too narrow.
  if (root.children.length === 0 && scanFrom !== doc.body) {
    for (const child of Array.from(doc.body.children)) {
      walk(child, root, { stopAtComponents: false });
    }
  }

  return root;
}
