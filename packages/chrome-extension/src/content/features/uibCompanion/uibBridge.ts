import type {
  UibGetTreeResponse,
  UibGetComponentResponse,
  UibGetStateResponse,
  UibHighlightResponse,
  UibComponentDetail,
  UibProperty,
  UibEvent,
} from '../../../shared/messaging.js';
import {
  isUibPage,
  getUibScanDocument,
  getUibPageWindow,
  getUibPageName,
} from './uibDetector.js';
import { buildComponentTree, elementForId } from './domScanner.js';
import { highlightElement, clearAllHighlights } from './highlighter.js';
import { readUibClientState } from './stateReader.js';
import { readComponentDetail } from './pageContextBridge.js';
import { startCapture, stopCapture } from './eventInterceptor.js';

/**
 * Top-level message handler for UIB_* requests from the side panel.
 * Buffers DOM-event captures and flushes them in batches every 250 ms so
 * we don't spam runtime messages.
 */

// ── Event batching ──────────────────────────────────────────────────────────

const eventBuffer: UibEvent[] = [];
let flushTimer: number | null = null;
const FLUSH_INTERVAL_MS = 250;

function emitEvent(event: UibEvent): void {
  eventBuffer.push(event);
  if (eventBuffer.length > 500) eventBuffer.splice(0, eventBuffer.length - 500);
  if (flushTimer === null) {
    flushTimer = window.setTimeout(flushEvents, FLUSH_INTERVAL_MS);
  }
}

function flushEvents(): void {
  flushTimer = null;
  if (eventBuffer.length === 0) return;
  const batch = eventBuffer.splice(0, eventBuffer.length);
  chrome.runtime
    .sendMessage({ type: 'UIB_EVENT_BATCH', events: batch })
    .catch(() => { /* nobody listening */ });
}

// ── Selector helpers ────────────────────────────────────────────────────────

/**
 * Build a selector unique enough for the page-context bridge to find an
 * element when given an id we assigned. We can't pass the WeakMap across
 * worlds, so we encode "find me the element with this NowForge data attr".
 */
const NF_DATA_ATTR = 'data-nowforge-uib-id';

function tagElement(el: Element, id: string): string {
  el.setAttribute(NF_DATA_ATTR, id);
  return `[${NF_DATA_ATTR}="${CSS.escape(id)}"]`;
}

// ── Tree → property mapping ────────────────────────────────────────────────

function attributesToProperties(attrs: Record<string, string>): UibProperty[] {
  return Object.entries(attrs)
    .filter(([k]) => k !== NF_DATA_ATTR)
    .map(([k, v]) => ({
      name: k,
      source: 'attribute',
      value: v,
      isBinding: v.startsWith('@') || v.startsWith('{{'),
    }));
}

function jsonStringPropsToList(jsonString: string | null | undefined): UibProperty[] {
  if (!jsonString) return [];
  try {
    const parsed = JSON.parse(jsonString) as unknown;
    if (parsed === null || typeof parsed !== 'object') return [];
    return Object.entries(parsed as Record<string, unknown>).map(([k, v]) => ({
      name: k,
      source: 'property',
      value: typeof v === 'string' ? v : JSON.stringify(v),
      isBinding: typeof v === 'string' && (v.startsWith('@') || v.startsWith('{{')),
    }));
  } catch {
    return [];
  }
}

// ── Handlers ────────────────────────────────────────────────────────────────

function handleGetTree(): UibGetTreeResponse {
  if (!isUibPage()) {
    return { ok: true, inUib: false, pageTitle: null, tree: null };
  }
  try {
    const doc = getUibScanDocument();
    const tree = buildComponentTree(doc);
    return {
      ok: true,
      inUib: true,
      pageTitle: getUibPageName(),
      tree,
    };
  } catch (e) {
    return {
      ok: false, inUib: true, pageTitle: null, tree: null,
      reason: `Tree build failed: ${(e as Error).message}`,
    };
  }
}

async function handleGetComponent(id: string): Promise<UibGetComponentResponse> {
  const el = elementForId(id);
  if (!el) {
    return { ok: false, detail: null, reason: 'Component no longer exists.' };
  }

  // Tag the element so the page-context bridge can find it
  const selector = tagElement(el, id);

  // Pull internals from page context (best-effort)
  const win = getUibPageWindow();
  const detailRaw = await readComponentDetail(win, selector);

  // Build base detail from light-DOM info we can read directly
  const baseAttrs: Record<string, string> = {};
  for (let i = 0; i < el.attributes.length; i++) {
    const a = el.attributes[i];
    if (a.name === NF_DATA_ATTR) continue;
    baseAttrs[a.name] = a.value;
  }

  const tag = el.tagName.toLowerCase();
  const displayName = el.getAttribute('data-uib-display-name') ?? el.getAttribute('aria-label') ?? tag;

  let properties = attributesToProperties(baseAttrs);
  let bindings: UibProperty[] = [];
  let eventHandlers: UibProperty['name'][] = [];

  if (!detailRaw.__error && !detailRaw.error) {
    // Merge in props from page world (override attribute-derived ones with
    // the same name when we have a richer value)
    const pageProps = jsonStringPropsToList(detailRaw.props ?? detailRaw.state ?? null);
    if (pageProps.length > 0) {
      const seen = new Set(pageProps.map((p) => p.name));
      properties = [...pageProps, ...properties.filter((p) => !seen.has(p.name))];
    }
    bindings = jsonStringPropsToList(detailRaw.bindings ?? null);
    if (detailRaw.handlers) {
      try {
        const parsed = JSON.parse(detailRaw.handlers) as unknown;
        if (parsed && typeof parsed === 'object') {
          eventHandlers = Object.keys(parsed as Record<string, unknown>);
        }
      } catch { /* ignore */ }
    }
  }

  let description: string | undefined;
  let version: string | undefined;
  if (detailRaw.metadata) {
    try {
      const meta = JSON.parse(detailRaw.metadata) as { description?: string; version?: string };
      description = meta.description;
      version = meta.version;
    } catch { /* ignore */ }
  }

  const detail: UibComponentDetail = {
    id, tag, displayName, description, version,
    properties, bindings,
    eventHandlers: eventHandlers.length > 0
      ? eventHandlers.map((e) => ({ event: e, detail: '(handler attached)' }))
      : [{ event: '(none)', detail: 'No handlers detected' }],
  };

  return { ok: true, detail };
}

async function handleGetState(): Promise<UibGetStateResponse> {
  const state = await readUibClientState();
  return { ok: true, state };
}

function handleHighlight(id: string | null): UibHighlightResponse {
  if (id === null) {
    clearAllHighlights();
    return { ok: true };
  }
  const el = elementForId(id);
  if (!el) return { ok: false };
  highlightElement(el);
  return { ok: true };
}

function handleStartCapture(): { ok: true } {
  startCapture(emitEvent);
  return { ok: true };
}

function handleStopCapture(): { ok: true } {
  stopCapture();
  flushEvents();
  return { ok: true };
}

// ── Wire-up ─────────────────────────────────────────────────────────────────

interface IncomingMessage {
  type?: string;
  id?: string | null;
}

export function initUibBridge(): void {
  chrome.runtime.onMessage.addListener((message: IncomingMessage, _sender, sendResponse) => {
    switch (message.type) {
      case 'UIB_GET_TREE':
        sendResponse(handleGetTree());
        return false;
      case 'UIB_GET_COMPONENT':
        if (typeof message.id !== 'string') {
          sendResponse({ ok: false, detail: null, reason: 'id required' });
          return false;
        }
        void handleGetComponent(message.id).then(sendResponse);
        return true;
      case 'UIB_GET_STATE':
        void handleGetState().then(sendResponse);
        return true;
      case 'UIB_HIGHLIGHT':
        sendResponse(handleHighlight(message.id ?? null));
        return false;
      case 'UIB_START_EVENT_CAPTURE':
        sendResponse(handleStartCapture());
        return false;
      case 'UIB_STOP_EVENT_CAPTURE':
        sendResponse(handleStopCapture());
        return false;
    }
    return false;
  });
}
