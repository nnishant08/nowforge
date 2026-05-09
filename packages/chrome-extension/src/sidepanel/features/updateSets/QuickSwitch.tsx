import { useEffect, useRef, useState } from 'react';
import type { UpdateSetRecent } from '../../../shared/messaging.js';

export interface QuickSwitchProps {
  recent: UpdateSetRecent[];
  currentSysId: string | null;
  loading: boolean;
  switching: boolean;
  onSwitch: (sysId: string) => void;
  onCreate: () => void;
}

export function QuickSwitch({
  recent, currentSysId, loading, switching, onSwitch, onCreate,
}: QuickSwitchProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="us-quickswitch" ref={wrapperRef}>
      <button
        type="button"
        className="us-quickswitch__trigger"
        onClick={() => setOpen((o) => !o)}
        disabled={switching}
      >
        <span>{switching ? 'Switching…' : 'Switch update set'}</span>
        <span className="us-chev" aria-hidden>▾</span>
      </button>

      {open && (
        <div className="us-quickswitch__dropdown" role="listbox">
          {loading ? (
            <div className="us-quickswitch__empty">Loading…</div>
          ) : recent.length === 0 ? (
            <div className="us-quickswitch__empty">No in-progress update sets found.</div>
          ) : (
            <ul className="us-quickswitch__list">
              {recent.map((r) => {
                const isCurrent = r.sysId === currentSysId;
                return (
                  <li key={r.sysId}>
                    <button
                      type="button"
                      className={`us-quickswitch__item${isCurrent ? ' us-quickswitch__item--current' : ''}`}
                      onClick={() => {
                        if (isCurrent) { setOpen(false); return; }
                        onSwitch(r.sysId);
                        setOpen(false);
                      }}
                      disabled={isCurrent}
                    >
                      <div className="us-quickswitch__main">
                        <span className="us-quickswitch__name" title={r.name}>{r.name}</span>
                        <span className="us-quickswitch__app">{r.appName}</span>
                      </div>
                      <span className="us-quickswitch__count" title={`${r.changeCount} changes`}>
                        {r.changeCount}
                      </span>
                      {isCurrent && <span className="us-quickswitch__here">current</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <button
            type="button"
            className="us-quickswitch__create"
            onClick={() => { setOpen(false); onCreate(); }}
          >
            <span>+</span> Create new update set
          </button>
        </div>
      )}
    </div>
  );
}
