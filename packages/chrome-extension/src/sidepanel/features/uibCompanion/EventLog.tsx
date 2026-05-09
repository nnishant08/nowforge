import { useEffect, useMemo, useRef, useState } from 'react';
import type { UibEvent } from '../../../shared/messaging.js';
import { startEventCapture, stopEventCapture } from './api.js';

const MAX_EVENTS = 500;

export function EventLog() {
  const [events, setEvents] = useState<UibEvent[]>([]);
  const [filter, setFilter] = useState('');
  const [paused, setPaused] = useState(false);
  const [expandedTs, setExpandedTs] = useState<number | null>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  // Start/stop capture in lifecycle
  useEffect(() => {
    void startEventCapture();
    const handler = (message: { type?: string; events?: UibEvent[] }) => {
      if (message?.type !== 'UIB_EVENT_BATCH' || !message.events) return false;
      if (pausedRef.current) return false;
      setEvents((prev) => {
        const next = [...prev, ...message.events!];
        return next.length > MAX_EVENTS ? next.slice(-MAX_EVENTS) : next;
      });
      return false;
    };
    chrome.runtime.onMessage.addListener(handler);
    return () => {
      chrome.runtime.onMessage.removeListener(handler);
      void stopEventCapture();
    };
  }, []);

  const filtered = useMemo(() => {
    if (!filter) return events;
    const q = filter.toLowerCase();
    return events.filter((e) =>
      e.type.toLowerCase().includes(q) ||
      e.source.toLowerCase().includes(q) ||
      e.detail.toLowerCase().includes(q)
    );
  }, [events, filter]);

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString(undefined, { hour12: false });

  return (
    <div className="uib-events">
      <div className="uib-events__toolbar">
        <input
          type="search"
          className="uib-events__filter"
          placeholder="🔍 Filter events…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <button
          type="button"
          className="uib-events__btn"
          onClick={() => setPaused((v) => !v)}
        >
          {paused ? '▶ Resume' : '⏸ Pause'}
        </button>
        <button
          type="button"
          className="uib-events__btn"
          onClick={() => setEvents([])}
        >
          Clear
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="uib-events__empty">
          {events.length === 0
            ? 'No events captured yet. Interact with the UIB page.'
            : 'No events match this filter.'}
        </div>
      ) : (
        <ul className="uib-events__list">
          {filtered.slice(-200).map((e) => (
            <li key={e.timestamp + e.type + e.source} className={`uib-events__row uib-events__row--${e.tone}`}>
              <button
                type="button"
                className="uib-events__main"
                onClick={() => setExpandedTs((t) => (t === e.timestamp ? null : e.timestamp))}
              >
                <span className="uib-events__time">{formatTime(e.timestamp)}</span>
                <span className="uib-events__type">{e.type}</span>
                <span className="uib-events__source">{e.source}</span>
                {e.detail && <span className="uib-events__detail">{e.detail}</span>}
              </button>
              {expandedTs === e.timestamp && (
                <pre className="uib-events__expand">{JSON.stringify(e, null, 2)}</pre>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
