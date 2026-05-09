import { useMemo, useState } from 'react';
import type { HistoryEntry } from './types.js';

export interface HistoryProps {
  entries: HistoryEntry[];
  onClose: () => void;
  onLoad: (entry: HistoryEntry) => void;
  onRerun: (entry: HistoryEntry) => void;
  onDelete: (id: string) => void;
}

function snippet(s: string): string {
  return s.replace(/\s+/g, ' ').slice(0, 80) + (s.length > 80 ? '…' : '');
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString();
}

export function History({ entries, onClose, onLoad, onRerun, onDelete }: HistoryProps) {
  const [filter, setFilter] = useState('');

  const filtered = useMemo(() => {
    const q = filter.toLowerCase().trim();
    if (!q) return entries;
    return entries.filter((e) =>
      e.script.toLowerCase().includes(q) ||
      (e.output ?? '').toLowerCase().includes(q) ||
      (e.instanceName ?? '').toLowerCase().includes(q)
    );
  }, [entries, filter]);

  return (
    <div className="sr-overlay">
      <div className="sr-overlay__head">
        <h2 className="sr-overlay__title">History</h2>
        <button type="button" className="sr-overlay__close" onClick={onClose}>×</button>
      </div>
      <div className="sr-overlay__search">
        <input
          type="text"
          placeholder="Search scripts and output…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      <div className="sr-overlay__body">
        {filtered.length === 0 ? (
          <div className="sr-overlay__empty">
            {entries.length === 0 ? 'No scripts run yet.' : 'No history matches your search.'}
          </div>
        ) : (
          <ul className="sr-history-list">
            {filtered.map((e) => (
              <li key={e.id} className="sr-history-item">
                <div className="sr-history-meta">
                  <span className="sr-history-time">{formatTime(e.timestamp)}</span>
                  {e.instanceName && <span className="sr-history-pill">{e.instanceName}</span>}
                  {!e.ok && <span className="sr-history-pill sr-history-pill--err">error</span>}
                  <span className="sr-history-time">{e.executionTimeMs} ms</span>
                </div>
                <div className="sr-history-script">{snippet(e.script)}</div>
                <div className="sr-history-actions">
                  <button type="button" onClick={() => onLoad(e)}>Load</button>
                  <button type="button" onClick={() => onRerun(e)}>Re-run</button>
                  <button type="button" className="sr-danger" onClick={() => onDelete(e.id)}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
