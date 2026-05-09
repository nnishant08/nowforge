import { useEffect, useMemo, useState } from 'react';
import type { UibClientState } from '../../../shared/messaging.js';
import { getClientState } from './api.js';

const REFRESH_INTERVAL_MS = 2000;

export function ClientStateViewer() {
  const [state, setState] = useState<UibClientState>({ json: null, source: 'unavailable' });
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [previousJson, setPreviousJson] = useState<string | null>(null);
  const [flashing, setFlashing] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const res = await getClientState();
    setLoading(false);
    setState((prev) => {
      if (prev.json && res.state.json && prev.json !== res.state.json) {
        setPreviousJson(prev.json);
        setFlashing(true);
        window.setTimeout(() => setFlashing(false), 700);
      }
      return res.state;
    });
  };

  useEffect(() => {
    void refresh();
    if (!autoRefresh) return;
    const t = window.setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
    return () => window.clearInterval(t);
  }, [autoRefresh]);

  const display = useMemo(() => {
    if (!state.json) return null;
    try { return JSON.parse(state.json) as unknown; } catch { return state.json; }
  }, [state.json]);

  const filtered = useMemo(() => {
    if (!filter) return display;
    if (typeof display !== 'object' || display === null) return display;
    const q = filter.toLowerCase();
    const obj = display as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k.toLowerCase().includes(q) || JSON.stringify(v).toLowerCase().includes(q)) {
        out[k] = v;
      }
    }
    return out;
  }, [display, filter]);

  return (
    <div className={`uib-state${flashing ? ' uib-state--flash' : ''}`}>
      <div className="uib-state__toolbar">
        <input
          type="search"
          className="uib-state__filter"
          placeholder="🔍 Filter state…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <label className="uib-state__auto">
          <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
          Auto
        </label>
        <button type="button" className="uib-state__btn" onClick={() => void refresh()} disabled={loading}>
          {loading ? '…' : 'Refresh'}
        </button>
      </div>

      {state.source === 'unavailable' ? (
        <div className="uib-state__empty">
          Couldn't reach the UIB state store.{state.error && ` (${state.error})`}
          <br /><span className="uib-state__hint">After loading the page, try the Refresh button.</span>
        </div>
      ) : !display ? (
        <div className="uib-state__empty">No client state values yet.</div>
      ) : (
        <pre className="uib-state__body">{JSON.stringify(filtered, null, 2)}</pre>
      )}

      {previousJson && (
        <details className="uib-state__diff">
          <summary>Previous snapshot</summary>
          <pre>{previousJson}</pre>
        </details>
      )}
    </div>
  );
}
