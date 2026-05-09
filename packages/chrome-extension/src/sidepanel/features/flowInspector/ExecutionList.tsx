import type { FlowExecution } from '../../../shared/messaging.js';
import { formatRelativeTime } from '../../../shared/navigation.js';

export interface ExecutionListProps {
  executions: FlowExecution[];
  totalAvailable: number;
  loading: boolean;
  error: string | null;
  selectedSysId: string | null;
  onSelect: (e: FlowExecution) => void;
  onRefresh: () => void;
  onLoadMore: () => void;
  loadingMore: boolean;
}

interface StateMeta { icon: string; tone: 'green' | 'red' | 'yellow' | 'gray' | 'blue'; }

function stateMeta(state: string): StateMeta {
  const s = state.toUpperCase();
  if (s === 'FINISHED' || s === 'COMPLETE' || s === 'COMPLETED') return { icon: '✓', tone: 'green' };
  if (s === 'ERROR' || s === 'FAILED') return { icon: '✕', tone: 'red' };
  if (s === 'CANCELLED' || s === 'CANCELED') return { icon: '⊗', tone: 'gray' };
  if (s === 'RUNNING' || s === 'IN_PROGRESS') return { icon: '⏵', tone: 'blue' };
  if (s === 'WAITING' || s === 'PAUSED') return { icon: '⏸', tone: 'yellow' };
  return { icon: '·', tone: 'gray' };
}

function formatDuration(ms: number): string {
  if (!ms || ms < 0) return '—';
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const min = Math.floor(ms / 60_000);
  const sec = Math.floor((ms % 60_000) / 1000);
  return `${min}m ${sec}s`;
}

export function ExecutionList({
  executions, totalAvailable, loading, error, selectedSysId,
  onSelect, onRefresh, onLoadMore, loadingMore,
}: ExecutionListProps) {
  return (
    <section className="fl-execs">
      <header className="fl-execs__head">
        <h3 className="fl-execs__title">Recent Executions</h3>
        <button
          type="button"
          className="fl-btn fl-btn--ghost"
          onClick={onRefresh}
          disabled={loading}
          title="Refresh"
        >
          ↻
        </button>
      </header>

      {loading && executions.length === 0 ? (
        <div className="fl-empty">Loading executions…</div>
      ) : error && executions.length === 0 ? (
        <div className="fl-empty fl-empty--err">{error}</div>
      ) : executions.length === 0 ? (
        <div className="fl-empty">
          No executions found.
          <br /><span className="fl-empty__hint">Run a test from the panel below to see execution data.</span>
        </div>
      ) : (
        <ul className="fl-execs__list">
          {executions.map((e) => {
            const m = stateMeta(e.state);
            const isSelected = selectedSysId === e.sysId;
            return (
              <li key={e.sysId}>
                <button
                  type="button"
                  className={`fl-exec${isSelected ? ' fl-exec--selected' : ''}`}
                  onClick={() => onSelect(e)}
                  title={e.errorMessage || ''}
                >
                  <span className={`fl-exec__icon fl-exec__icon--${m.tone}`}>{m.icon}</span>
                  <span className="fl-exec__main">
                    <span className="fl-exec__time">
                      {e.startedAt ? formatRelativeTime(e.startedAt) : '—'}
                    </span>
                    <span className="fl-exec__sub">
                      <span className={`fl-exec__state fl-exec__state--${m.tone}`}>
                        {e.stateLabel || e.state}
                      </span>
                      {e.durationMs > 0 && (
                        <span className="fl-exec__dur">{formatDuration(e.durationMs)}</span>
                      )}
                    </span>
                    {e.triggerDisplay && (
                      <span className="fl-exec__trigger" title={e.triggerDisplay}>
                        {e.triggerDisplay}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {executions.length > 0 && executions.length < totalAvailable && (
        <div className="fl-execs__more">
          <span className="fl-execs__count">
            Showing {executions.length} of {totalAvailable}
          </span>
          <button
            type="button"
            className="fl-btn fl-btn--secondary fl-btn--sm"
            onClick={onLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </section>
  );
}
