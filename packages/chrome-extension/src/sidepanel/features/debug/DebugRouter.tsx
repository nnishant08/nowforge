import { useEffect, useState } from 'react';
import { isFlowDesignerUrl } from '../../../shared/flowDetector.js';
import { UIBCompanion } from '../uibCompanion/UIBCompanion.js';
import { FlowInspector } from '../flowInspector/FlowInspector.js';

const POLL_MS = 4000;
const UIB_PATTERNS: RegExp[] = [
  /\/now\/builder\b/i,
  /\/\$uib\b/i,
  /\bui[-_]builder\b/i,
];

type View = 'unknown' | 'flow' | 'uib' | 'none';

function detectView(url: string | null): Exclude<View, 'unknown'> {
  if (!url) return 'none';
  if (isFlowDesignerUrl(url)) return 'flow';
  if (UIB_PATTERNS.some((re) => re.test(url))) return 'uib';
  return 'none';
}

/**
 * Router for the Debug tab. Polls the active tab URL every few seconds and
 * picks the right inspector. Both inspectors have their own internal empty
 * states as a backup, but mounting only the relevant one keeps things crisp.
 */
export function DebugRouter() {
  const [view, setView] = useState<View>('unknown');

  useEffect(() => {
    const check = () => {
      chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
        setView(detectView(tabs[0]?.url ?? null));
      });
    };
    check();
    const t = window.setInterval(check, POLL_MS);
    return () => window.clearInterval(t);
  }, []);

  if (view === 'unknown') {
    return <div className="debug-loading">Detecting page type…</div>;
  }
  if (view === 'flow') return <FlowInspector />;
  if (view === 'uib') return <UIBCompanion />;

  return (
    <div className="debug-empty">
      <div className="debug-empty__icon" aria-hidden>🛠</div>
      <p className="debug-empty__title">Open a Flow Designer or UI Builder page.</p>
      <p className="debug-empty__sub">
        The Debug tab activates automatically when you're on:<br />
        • <code>/$flow-designer.do#/flow/&lt;sys_id&gt;</code><br />
        • <code>/now/flow-designer/...</code><br />
        • <code>/now/builder/...</code>
      </p>
    </div>
  );
}
