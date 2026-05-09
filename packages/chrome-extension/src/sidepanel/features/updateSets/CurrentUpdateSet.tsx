import type { UpdateSetSummary } from '../../../shared/messaging.js';

export interface CurrentUpdateSetProps {
  current: UpdateSetSummary | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

const STATE_TONE: Record<string, 'green' | 'gray' | 'yellow' | 'orange'> = {
  'in progress': 'green',
  complete: 'gray',
  released: 'gray',
  ignore: 'orange',
};

function pickTone(state: string): 'green' | 'gray' | 'yellow' | 'orange' {
  return STATE_TONE[state.toLowerCase()] ?? 'gray';
}

export function CurrentUpdateSet({ current, loading, error, onRefresh }: CurrentUpdateSetProps) {
  if (loading && !current) {
    return (
      <div className="us-card us-card--skeleton">
        <div className="us-card__name">Loading update set…</div>
      </div>
    );
  }

  if (error && !current) {
    return (
      <div className="us-card us-card--error">
        <div className="us-card__name">Couldn't load update set</div>
        <div className="us-card__sub">{error}</div>
        <button type="button" className="us-btn us-btn--secondary us-btn--sm" onClick={onRefresh}>
          Retry
        </button>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="us-card us-card--empty">
        <div className="us-card__name">No active update set</div>
        <div className="us-card__sub">Create one or pick from the recent list below.</div>
      </div>
    );
  }

  const tone = pickTone(current.state);

  return (
    <div className="us-card">
      <div className="us-card__head">
        <div className="us-card__main">
          <div className="us-card__name" title={current.name}>{current.name}</div>
          <div className="us-card__sub">{current.appName}</div>
        </div>
        <span className={`us-badge us-badge--${tone}`}>
          {current.stateLabel || current.state || '—'}
        </span>
      </div>

      <div className="us-card__meta">
        <span className="us-card__changes">📦 {current.changeCount} change{current.changeCount === 1 ? '' : 's'}</span>
        <button
          type="button"
          className="us-iconbtn"
          title="Refresh"
          onClick={onRefresh}
          aria-label="Refresh"
        >
          ↻
        </button>
      </div>

      {current.isDefault && (
        <div className="us-warn us-warn--yellow">
          ⚠ You're in the <b>Default</b> update set. Changes here are hard to track.
        </div>
      )}
      {!current.isDefault && current.state.toLowerCase() === 'complete' && (
        <div className="us-warn us-warn--orange">
          This update set is <b>complete</b>. New changes will go to the Default set.
        </div>
      )}
    </div>
  );
}
