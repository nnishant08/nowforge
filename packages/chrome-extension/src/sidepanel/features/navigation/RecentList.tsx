import type { NavRecord } from '../../../shared/navigation.js';
import { tableIcon, formatRelativeTime } from '../../../shared/navigation.js';

export interface RecentListProps {
  records: NavRecord[];
  favoriteKeys: Set<string>;
  loading: boolean;
  onOpen: (record: NavRecord, newTab: boolean) => void;
  onPin: (record: NavRecord) => void;
  onUnpin: (record: NavRecord) => void;
  onDelete: (record: NavRecord) => void;
}

const keyFor = (r: { table: string; sysId: string }) => `${r.table}:${r.sysId}`;

export function RecentList({
  records, favoriteKeys, loading, onOpen, onPin, onUnpin, onDelete,
}: RecentListProps) {
  if (loading && records.length === 0) {
    return <div className="nv-empty">Loading recent records…</div>;
  }
  if (records.length === 0) {
    return (
      <div className="nv-empty">
        Visit a record on this instance — it'll show up here.
      </div>
    );
  }

  return (
    <ul className="nv-list">
      {records.map((r) => {
        const isFav = favoriteKeys.has(keyFor(r));
        return (
          <li key={keyFor(r)} className="nv-row">
            <button
              type="button"
              className="nv-row__main"
              onClick={(e) => onOpen(r, e.metaKey || e.ctrlKey)}
              title={`${r.displayValue}\n${r.table} · ${r.visitCount} visit${r.visitCount === 1 ? '' : 's'}`}
            >
              <span className="nv-row__icon" aria-hidden>{tableIcon(r.table)}</span>
              <span className="nv-row__text">
                <span className="nv-row__label">{r.displayValue}</span>
                <span className="nv-row__meta">
                  <span className="nv-row__table">{r.table}</span>
                  <span className="nv-row__dot" aria-hidden>·</span>
                  <span className="nv-row__time">{formatRelativeTime(r.lastVisited)}</span>
                </span>
              </span>
            </button>
            <div className="nv-row__actions">
              <button
                type="button"
                className={`nv-iconbtn${isFav ? ' nv-iconbtn--active' : ''}`}
                title={isFav ? 'Unpin' : 'Pin to favorites'}
                onClick={() => isFav ? onUnpin(r) : onPin(r)}
              >
                {isFav ? '★' : '☆'}
              </button>
              <button
                type="button"
                className="nv-iconbtn nv-iconbtn--danger"
                title="Remove from history"
                onClick={() => onDelete(r)}
              >
                ✕
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
