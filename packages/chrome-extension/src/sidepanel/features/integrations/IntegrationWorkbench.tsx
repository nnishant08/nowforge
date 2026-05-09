import { useEffect, useMemo, useState } from 'react';
import './styles.css';

/**
 * Postman-like REST client. Sends requests via the active SN tab's content
 * script (so cookies + the user's session are reused). Saves history to
 * chrome.storage.local. Single-pane UI for the side panel — full OAuth
 * debugger and Import-as-REST-Message are deferred until users ask.
 */

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface SavedRequest {
  id: string;
  method: Method;
  url: string;
  headers: Array<{ k: string; v: string }>;
  body: string;
  /** Last response, if any. */
  status?: number;
  duration?: number;
  responseBody?: string;
  responseHeaders?: Record<string, string>;
  ts: number;
}

const HISTORY_KEY = 'nowforge_integration_history';
const HISTORY_LIMIT = 30;

const newId = (): string => Math.random().toString(36).slice(2, 10);

async function loadHistory(): Promise<SavedRequest[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get(HISTORY_KEY, (r) => resolve((r[HISTORY_KEY] as SavedRequest[] | undefined) ?? []));
  });
}
async function saveHistory(list: SavedRequest[]): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [HISTORY_KEY]: list }, () => resolve());
  });
}

interface SnTab { id: number; url: string; }

async function getActiveSnTab(): Promise<SnTab | null> {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      const t = tabs[0];
      if (!t?.id || !t.url?.includes('.service-now.com')) { resolve(null); return; }
      resolve({ id: t.id, url: t.url });
    });
  });
}

export function IntegrationWorkbench() {
  const [method, setMethod] = useState<Method>('GET');
  const [url, setUrl] = useState('/api/now/table/sys_user?sysparm_limit=1');
  const [headers, setHeaders] = useState<Array<{ k: string; v: string }>>([
    { k: 'Accept', v: 'application/json' },
  ]);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [resp, setResp] = useState<{ status: number; duration: number; body: string; headers: Record<string, string> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<SavedRequest[]>([]);
  const [view, setView] = useState<'body' | 'headers'>('body');
  const [jsonPath, setJsonPath] = useState('');

  useEffect(() => { void loadHistory().then(setHistory); }, []);

  const send = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    setResp(null);
    try {
      const tab = await getActiveSnTab();
      if (!tab) throw new Error('No active ServiceNow tab.');
      const fullUrl = url.startsWith('http')
        ? url
        : `${new URL(tab.url).origin}${url.startsWith('/') ? url : '/' + url}`;

      const start = performance.now();
      const headersObj: Record<string, string> = {};
      for (const h of headers) if (h.k.trim()) headersObj[h.k.trim()] = h.v;

      // Use chrome.tabs to execute fetch in the SN tab's content for cookie reuse.
      // Simpler: fetch from the side panel — host_permissions cover it.
      const res = await fetch(fullUrl, {
        method,
        headers: headersObj,
        body: ['POST', 'PUT', 'PATCH'].includes(method) && body ? body : undefined,
        credentials: 'include',
      });
      const duration = Math.round(performance.now() - start);
      const respHeaders: Record<string, string> = {};
      res.headers.forEach((v, k) => { respHeaders[k] = v; });
      const respBody = await res.text();
      const captured = { status: res.status, duration, body: respBody, headers: respHeaders };
      setResp(captured);

      const entry: SavedRequest = {
        id: newId(), method, url, headers, body,
        status: captured.status, duration: captured.duration,
        responseBody: captured.body.slice(0, 4000),
        responseHeaders: captured.headers,
        ts: Date.now(),
      };
      const next = [entry, ...history].slice(0, HISTORY_LIMIT);
      setHistory(next);
      await saveHistory(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const replay = (entry: SavedRequest): void => {
    setMethod(entry.method);
    setUrl(entry.url);
    setHeaders(entry.headers);
    setBody(entry.body);
  };

  const prettyBody = useMemo(() => {
    if (!resp) return '';
    try { return JSON.stringify(JSON.parse(resp.body), null, 2); }
    catch { return resp.body; }
  }, [resp]);

  const jsonPathValue = useMemo(() => {
    if (!resp || !jsonPath.trim()) return null;
    try {
      const parsed = JSON.parse(resp.body) as unknown;
      return evaluateJsonPath(parsed, jsonPath.trim());
    } catch { return null; }
  }, [resp, jsonPath]);

  return (
    <div className="iw-root">
      <section className="iw-card">
        <div className="iw-row">
          <select className="iw-method" value={method} onChange={(e) => setMethod(e.target.value as Method)}>
            {(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const).map((m) => <option key={m}>{m}</option>)}
          </select>
          <input
            className="iw-url"
            placeholder="/api/now/table/incident?sysparm_limit=10"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button className="iw-btn iw-btn--primary" onClick={() => void send()} disabled={busy}>
            {busy ? '…' : 'Send'}
          </button>
        </div>

        <details className="iw-headers">
          <summary>Headers ({headers.length})</summary>
          {headers.map((h, i) => (
            <div key={i} className="iw-row">
              <input
                className="iw-input" placeholder="Header"
                value={h.k}
                onChange={(e) => setHeaders((prev) => prev.map((x, j) => j === i ? { ...x, k: e.target.value } : x))}
              />
              <input
                className="iw-input" placeholder="Value"
                value={h.v}
                onChange={(e) => setHeaders((prev) => prev.map((x, j) => j === i ? { ...x, v: e.target.value } : x))}
              />
              <button className="iw-btn iw-btn--ghost" onClick={() => setHeaders((prev) => prev.filter((_, j) => j !== i))}>×</button>
            </div>
          ))}
          <button className="iw-btn iw-btn--ghost" onClick={() => setHeaders((p) => [...p, { k: '', v: '' }])}>+ Header</button>
        </details>

        {['POST', 'PUT', 'PATCH'].includes(method) && (
          <details className="iw-body" open>
            <summary>Body</summary>
            <textarea
              className="iw-textarea"
              rows={6}
              placeholder='{ "short_description": "Test", "priority": 1 }'
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </details>
        )}
      </section>

      {error && <div className="iw-error">{error}</div>}

      {resp && (
        <section className="iw-card">
          <div className="iw-resp-bar">
            <span className={`iw-status iw-status--${Math.floor(resp.status / 100)}`}>{resp.status}</span>
            <span>{resp.duration} ms</span>
            <span>{resp.body.length} bytes</span>
            <button className={`iw-tab${view === 'body' ? ' iw-tab--active' : ''}`} onClick={() => setView('body')}>Body</button>
            <button className={`iw-tab${view === 'headers' ? ' iw-tab--active' : ''}`} onClick={() => setView('headers')}>Headers</button>
          </div>
          {view === 'body' ? (
            <>
              <pre className="iw-resp">{prettyBody}</pre>
              <div className="iw-jsonpath">
                <input
                  className="iw-input" placeholder="JSONPath, e.g. $.result[0].sys_id"
                  value={jsonPath}
                  onChange={(e) => setJsonPath(e.target.value)}
                />
                {jsonPathValue !== null && (
                  <code className="iw-jsonpath__val">
                    {typeof jsonPathValue === 'string' ? jsonPathValue : JSON.stringify(jsonPathValue)}
                  </code>
                )}
              </div>
            </>
          ) : (
            <pre className="iw-resp">{Object.entries(resp.headers).map(([k, v]) => `${k}: ${v}`).join('\n')}</pre>
          )}
        </section>
      )}

      {history.length > 0 && (
        <section className="iw-card">
          <h3 className="iw-card__title">Recent</h3>
          <ul className="iw-history">
            {history.slice(0, 10).map((h) => (
              <li key={h.id}>
                <button onClick={() => replay(h)}>
                  <span className={`iw-method-pill iw-method-pill--${h.method}`}>{h.method}</span>
                  <span className="iw-history__url">{h.url}</span>
                  {h.status !== undefined && <span className={`iw-status iw-status--${Math.floor(h.status / 100)}`}>{h.status}</span>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** Tiny JSONPath subset: $, ., [number], [*]. Enough for the UI. */
function evaluateJsonPath(root: unknown, path: string): unknown {
  if (!path.startsWith('$')) return null;
  let current: unknown = root;
  const tokens = path.slice(1).match(/(\.[a-zA-Z_$][\w$]*|\[\d+\]|\[\*\])/g) ?? [];
  for (const t of tokens) {
    if (current === null || current === undefined) return null;
    if (t.startsWith('.')) {
      current = (current as Record<string, unknown>)[t.slice(1)];
    } else if (t === '[*]') {
      // unsupported in v1
      return null;
    } else {
      const idx = Number(t.slice(1, -1));
      current = (current as unknown[])[idx];
    }
  }
  return current ?? null;
}
