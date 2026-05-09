import {
  CLIENT_STATE_PATHS,
  COMPONENT_STATE_PROPS,
  COMPONENT_PROPS_PROPS,
  COMPONENT_BINDINGS_PROPS,
  COMPONENT_HANDLERS_PROPS,
  COMPONENT_DESCRIPTION_PROPS,
} from './selectors.js';

/**
 * Lets the content script (isolated world) ask the page world for things
 * the isolated world can't reach: arbitrary JS expressions, internal-prop
 * reads on custom elements, and the client-state store.
 *
 * Mechanism: inject a small <script> into the page document; communicate
 * via window.postMessage with a per-request id. A 1-second timeout returns
 * `{ __error: 'timeout' }` if nothing comes back.
 */

const REQUEST_TAG = '__nowforge_uib_request__';
const RESPONSE_TAG = '__nowforge_uib_response__';

interface BridgeRequest {
  __nowforge_uib: typeof REQUEST_TAG;
  id: number;
  kind: 'state' | 'componentDetail' | 'eval';
  selector?: string;
  expr?: string;
}

interface BridgeResponse {
  __nowforge_uib: typeof RESPONSE_TAG;
  id: number;
  payload: unknown;
}

let nextId = 1;
const pending = new Map<number, (payload: unknown) => void>();
const installed = new WeakSet<Window>();

// The page-side script — careful: this runs in the page world, so no
// imports, no shared closure. Selectors are inlined as string constants
// the content script bakes in below.
function buildPageScript(
  statePaths: string[],
  stateProps: string[],
  propsProps: string[],
  bindingsProps: string[],
  handlersProps: string[],
  descProps: string[]
): string {
  // Heredoc-style; everything inside is page-world JS.
  return `
(function () {
  var REQ = '${REQUEST_TAG}';
  var RES = '${RESPONSE_TAG}';
  if (window.__nowforge_uib_bridge_installed__) return;
  window.__nowforge_uib_bridge_installed__ = true;

  var STATE_PATHS = ${JSON.stringify(statePaths)};
  var STATE_PROPS = ${JSON.stringify(stateProps)};
  var PROPS_PROPS = ${JSON.stringify(propsProps)};
  var BIND_PROPS = ${JSON.stringify(bindingsProps)};
  var HANDLER_PROPS = ${JSON.stringify(handlersProps)};
  var DESC_PROPS = ${JSON.stringify(descProps)};

  function safeStringify(value) {
    var seen = new WeakSet();
    try {
      return JSON.stringify(value, function (k, v) {
        if (typeof v === 'function') return '[Function]';
        if (v instanceof Element) return '[' + v.tagName.toLowerCase() + ']';
        if (typeof v === 'object' && v !== null) {
          if (seen.has(v)) return '[Circular]';
          seen.add(v);
        }
        return v;
      }, 2);
    } catch (e) { return null; }
  }

  function readFirst(obj, names) {
    for (var i = 0; i < names.length; i++) {
      if (obj && obj[names[i]] !== undefined) return obj[names[i]];
    }
    return null;
  }

  function readState() {
    for (var i = 0; i < STATE_PATHS.length; i++) {
      try {
        var v = (0, eval)(STATE_PATHS[i]);
        if (v != null) return { source: STATE_PATHS[i], value: safeStringify(v) };
      } catch (_) {}
    }
    return { source: 'unavailable', value: null };
  }

  function readComponentDetail(selector) {
    try {
      var doc = document;
      // Selector might point inside an iframe — check both top doc & frames
      var el = doc.querySelector(selector);
      if (!el) {
        var frames = document.querySelectorAll('iframe');
        for (var j = 0; j < frames.length; j++) {
          try {
            var fd = frames[j].contentDocument;
            if (fd) {
              el = fd.querySelector(selector);
              if (el) break;
            }
          } catch (_) {}
        }
      }
      if (!el) return { error: 'element not found' };

      var attrs = {};
      for (var k = 0; k < el.attributes.length; k++) {
        var a = el.attributes[k];
        attrs[a.name] = a.value;
      }

      return {
        tag: el.tagName.toLowerCase(),
        attributes: attrs,
        state: safeStringify(readFirst(el, STATE_PROPS)),
        props: safeStringify(readFirst(el, PROPS_PROPS)),
        bindings: safeStringify(readFirst(el, BIND_PROPS)),
        handlers: safeStringify(readFirst(el, HANDLER_PROPS)),
        metadata: safeStringify(readFirst(el, DESC_PROPS)),
      };
    } catch (e) {
      return { error: String(e) };
    }
  }

  window.addEventListener('message', function (event) {
    if (event.source !== window) return;
    var d = event.data;
    if (!d || d.__nowforge_uib !== REQ) return;
    var payload;
    try {
      if (d.kind === 'state') payload = readState();
      else if (d.kind === 'componentDetail') payload = readComponentDetail(d.selector);
      else if (d.kind === 'eval') {
        try { payload = { value: safeStringify((0, eval)(d.expr)) }; }
        catch (e) { payload = { error: String(e) }; }
      }
      else payload = { error: 'unknown kind' };
    } catch (e) { payload = { error: String(e) }; }
    window.postMessage({ __nowforge_uib: RES, id: d.id, payload: payload }, '*');
  });
})();
`;
}

/**
 * Install the bridge into the given window's document. Idempotent — checks
 * a flag on the target window so re-injecting is a no-op.
 */
export function ensureBridgeInstalled(targetWin: Window): void {
  if (installed.has(targetWin)) return;
  const doc = targetWin.document;
  if (!doc) return;

  const script = doc.createElement('script');
  script.textContent = buildPageScript(
    CLIENT_STATE_PATHS,
    COMPONENT_STATE_PROPS,
    COMPONENT_PROPS_PROPS,
    COMPONENT_BINDINGS_PROPS,
    COMPONENT_HANDLERS_PROPS,
    COMPONENT_DESCRIPTION_PROPS
  );
  doc.documentElement.appendChild(script);
  script.remove();
  installed.add(targetWin);

  // Listen for responses on the same window where the script ran. We attach
  // the listener once per target; subsequent installs reuse it.
  targetWin.addEventListener('message', (event: MessageEvent) => {
    const d = event.data as Partial<BridgeResponse> | undefined;
    if (!d || d.__nowforge_uib !== RESPONSE_TAG) return;
    if (typeof d.id !== 'number') return;
    const resolver = pending.get(d.id);
    if (resolver) {
      resolver(d.payload);
      pending.delete(d.id);
    }
  });
}

function call<T>(targetWin: Window, request: Omit<BridgeRequest, '__nowforge_uib' | 'id'>, timeoutMs = 1000): Promise<T> {
  ensureBridgeInstalled(targetWin);
  const id = nextId++;
  return new Promise<T>((resolve) => {
    const t = window.setTimeout(() => {
      pending.delete(id);
      resolve({ __error: 'timeout' } as unknown as T);
    }, timeoutMs);
    pending.set(id, (payload) => {
      window.clearTimeout(t);
      resolve(payload as T);
    });
    targetWin.postMessage(
      { __nowforge_uib: REQUEST_TAG, id, ...request },
      '*'
    );
  });
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface ReadStateResult {
  source: string;
  value: string | null;
  __error?: string;
}

export function readClientState(targetWin: Window): Promise<ReadStateResult> {
  return call<ReadStateResult>(targetWin, { kind: 'state' });
}

export interface ReadComponentDetailResult {
  tag?: string;
  attributes?: Record<string, string>;
  state?: string | null;
  props?: string | null;
  bindings?: string | null;
  handlers?: string | null;
  metadata?: string | null;
  error?: string;
  __error?: string;
}

export function readComponentDetail(
  targetWin: Window,
  selector: string
): Promise<ReadComponentDetailResult> {
  return call<ReadComponentDetailResult>(targetWin, { kind: 'componentDetail', selector });
}
