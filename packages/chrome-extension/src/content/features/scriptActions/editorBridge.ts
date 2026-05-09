/**
 * Reads script content out of Monaco / CodeMirror editor instances that
 * live in the page world. Content scripts can't reach those globals
 * directly, so we inject a tiny page-world script and talk via postMessage.
 *
 * Identification model: each editor host element gets a temporary
 * `data-nowforge-editor-id` attribute so the page-world script can match it.
 */

const REQ = '__nowforge_se_request__';
const RES = '__nowforge_se_response__';
const TAG_ATTR = 'data-nowforge-editor-id';

interface BridgeResp {
  __nowforge_se: typeof RES;
  id: number;
  payload: { value?: string; error?: string };
}

let nextId = 1;
let installed = false;
const pending = new Map<number, (payload: BridgeResp['payload']) => void>();

const PAGE_SCRIPT = `
(function () {
  if (window.__nowforge_se_bridge_installed__) return;
  window.__nowforge_se_bridge_installed__ = true;
  var REQ = ${JSON.stringify(REQ)};
  var RES = ${JSON.stringify(RES)};
  var TAG = ${JSON.stringify(TAG_ATTR)};

  function readEditorValue(host) {
    if (!host) return { error: 'host not found' };
    // Monaco
    try {
      if (window.monaco && window.monaco.editor) {
        var editors = window.monaco.editor.getEditors();
        for (var i = 0; i < editors.length; i++) {
          var node = editors[i].getDomNode && editors[i].getDomNode();
          if (node && (node === host || host.contains(node) || node.contains(host))) {
            return { value: editors[i].getValue() };
          }
        }
      }
    } catch (e) { /* fall through to CodeMirror */ }

    // CodeMirror 5 (the version SN ships when not Monaco)
    try {
      var cmRoot = host.classList && host.classList.contains('CodeMirror')
        ? host
        : (host.querySelector ? host.querySelector('.CodeMirror') : null);
      if (cmRoot && cmRoot.CodeMirror) return { value: cmRoot.CodeMirror.getValue() };
    } catch (e) { /* fall through */ }

    return { error: 'no editor instance found on host' };
  }

  window.addEventListener('message', function (event) {
    if (event.source !== window) return;
    var d = event.data;
    if (!d || d.__nowforge_se !== REQ) return;
    var host = document.querySelector('[' + TAG + '="' + d.tagId + '"]');
    var payload = readEditorValue(host);
    window.postMessage({ __nowforge_se: RES, id: d.id, payload: payload }, '*');
  });
})();
`;

function ensureInstalled(): void {
  if (installed) return;
  installed = true;
  const script = document.createElement('script');
  script.textContent = PAGE_SCRIPT;
  document.documentElement.appendChild(script);
  script.remove();
  window.addEventListener('message', (event: MessageEvent) => {
    const d = event.data as Partial<BridgeResp> | undefined;
    if (!d || d.__nowforge_se !== RES) return;
    if (typeof d.id !== 'number') return;
    const resolver = pending.get(d.id);
    if (resolver && d.payload) {
      resolver(d.payload);
      pending.delete(d.id);
    }
  });
}

/**
 * Attempt to read the value from the given editor host element.
 * Returns the value, or null if the editor's API wasn't reachable.
 */
export function readEditorValue(host: Element): Promise<string | null> {
  ensureInstalled();
  // Tag the element so the page-world script can find it
  const tagId = `nf-se-${nextId++}`;
  host.setAttribute(TAG_ATTR, tagId);

  const id = nextId++;
  return new Promise<string | null>((resolve) => {
    const timer = window.setTimeout(() => {
      pending.delete(id);
      host.removeAttribute(TAG_ATTR);
      resolve(null);
    }, 800);
    pending.set(id, (payload) => {
      window.clearTimeout(timer);
      host.removeAttribute(TAG_ATTR);
      if (payload.value !== undefined) resolve(payload.value);
      else resolve(null);
    });
    window.postMessage({ __nowforge_se: REQ, id, tagId }, '*');
  });
}
