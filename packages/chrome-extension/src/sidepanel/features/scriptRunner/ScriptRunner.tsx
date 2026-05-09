import { useCallback, useEffect, useRef, useState } from 'react';
import { Editor } from './Editor.js';
import { OutputPanel } from './OutputPanel.js';
import { Toolbar } from './Toolbar.js';
import { History } from './History.js';
import { Snippets } from './Snippets.js';
import { AIAssistant } from './AIAssistant.js';
import { QualityPanel } from './QualityPanel.js';
import { runScript, fetchCurrentScope, getActivePageContext } from './executor.js';
import type { HistoryEntry } from './types.js';
import './styles.css';

const HISTORY_KEY = 'nowforge_script_history';
const HISTORY_LIMIT = 100;
const SCRIPT_DRAFT_KEY = 'nowforge_script_draft';
const PENDING_SCRIPT_KEY = 'nowforge_pending_script';
/** A pending script older than this is ignored (stale). */
const PENDING_SCRIPT_MAX_AGE_MS = 30_000;

interface PendingScript { script: string; ts: number; }

function loadAndConsumePending(): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get(PENDING_SCRIPT_KEY, (r) => {
      const raw = r[PENDING_SCRIPT_KEY] as PendingScript | undefined;
      if (!raw || typeof raw.script !== 'string') { resolve(null); return; }
      if (Date.now() - raw.ts > PENDING_SCRIPT_MAX_AGE_MS) { resolve(null); return; }
      // Clear it so next mount doesn't replay
      chrome.storage.local.remove(PENDING_SCRIPT_KEY, () => resolve(raw.script));
    });
  });
}

const DEFAULT_SCRIPT = `// NowForge — Background Script Runner
// Press ⌘↵ (or click Run) to execute on the active ServiceNow tab.

var gr = new GlideRecord('incident');
gr.addActiveQuery();
gr.setLimit(5);
gr.query();
while (gr.next()) {
  gs.print(gr.number + ' — ' + gr.short_description);
}
`;

const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

function loadHistory(): Promise<HistoryEntry[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get(HISTORY_KEY, (r) => {
      resolve((r[HISTORY_KEY] as HistoryEntry[] | undefined) ?? []);
    });
  });
}
function saveHistory(entries: HistoryEntry[]): void {
  void chrome.storage.local.set({ [HISTORY_KEY]: entries });
}
function loadDraft(): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get(SCRIPT_DRAFT_KEY, (r) => resolve((r[SCRIPT_DRAFT_KEY] as string | null) ?? null));
  });
}
function saveDraft(s: string): void {
  void chrome.storage.local.set({ [SCRIPT_DRAFT_KEY]: s });
}

export function ScriptRunner() {
  const [script, setScript] = useState(DEFAULT_SCRIPT);
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [executionTimeMs, setExecutionTimeMs] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showSnippets, setShowSnippets] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [scopeLabel, setScopeLabel] = useState<string | null>(null);
  const [isProd, setIsProd] = useState(false);
  const [instanceName, setInstanceName] = useState<string | null>(null);

  // Resizable split between editor and output
  const [editorHeight, setEditorHeight] = useState<number>(360);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Bootstrap ──────────────────────────────────────────────────────
  useEffect(() => {
    // Pending script (from "Open in Script Runner" menu) wins over the draft.
    void Promise.all([loadHistory(), loadDraft(), loadAndConsumePending()]).then(
      ([h, draft, pending]) => {
        setHistory(h);
        if (pending) setScript(pending);
        else if (draft && draft.trim().length > 0) setScript(draft);
      }
    );

    // Live updates: while the panel is open, watch for new pending scripts
    const onChanged = (
      changes: { [k: string]: chrome.storage.StorageChange },
      area: string
    ) => {
      if (area !== 'local' || !(PENDING_SCRIPT_KEY in changes)) return;
      const next = changes[PENDING_SCRIPT_KEY].newValue as PendingScript | undefined;
      if (!next?.script) return;
      if (Date.now() - next.ts > PENDING_SCRIPT_MAX_AGE_MS) return;
      setScript(next.script);
      // Clear so we don't re-apply on remount
      void chrome.storage.local.remove(PENDING_SCRIPT_KEY);
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => chrome.storage.onChanged.removeListener(onChanged);
  }, []);

  useEffect(() => {
    void getActivePageContext().then((ctx) => {
      setIsProd(ctx?.instanceInfo?.environmentType === 'prod');
      setInstanceName(ctx?.instanceInfo?.instanceName ?? null);
    });
    void fetchCurrentScope().then((s) => {
      if (!s) { setScopeLabel(null); return; }
      setScopeLabel(s.scope ?? s.appName ?? 'Global');
    });
  }, []);

  // Persist editor draft (debounced via timeout)
  useEffect(() => {
    const t = window.setTimeout(() => saveDraft(script), 400);
    return () => window.clearTimeout(t);
  }, [script]);

  // ── Execution ───────────────────────────────────────────────────────
  const run = useCallback(async () => {
    if (isRunning) return;
    setIsRunning(true);
    setError(null);
    setOutput('');
    setExecutionTimeMs(null);

    const result = await runScript(script);
    const entry: HistoryEntry = {
      id: newId(),
      script,
      output: result.output ?? '',
      ok: result.ok,
      error: result.error,
      timestamp: Date.now(),
      instanceName,
      scope: scopeLabel,
      executionTimeMs: result.executionTimeMs ?? 0,
    };
    const next = [entry, ...history].slice(0, HISTORY_LIMIT);
    setHistory(next);
    saveHistory(next);

    if (result.ok) {
      setOutput(result.output ?? '');
      setExecutionTimeMs(result.executionTimeMs ?? null);
    } else {
      setError(result.error ?? 'Unknown error');
      setExecutionTimeMs(result.executionTimeMs ?? null);
    }
    setIsRunning(false);
  }, [script, isRunning, history, instanceName, scopeLabel]);

  // ── Resize ──────────────────────────────────────────────────────────
  const onResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = editorHeight;
    const onMove = (ev: MouseEvent) => {
      const containerH = containerRef.current?.clientHeight ?? 600;
      const next = Math.max(120, Math.min(containerH - 140, startH + (ev.clientY - startY)));
      setEditorHeight(next);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // ── Handlers ────────────────────────────────────────────────────────
  const onClear = () => { setScript(''); setOutput(''); setError(null); setExecutionTimeMs(null); };
  const onLoad = (e: HistoryEntry) => { setScript(e.script); setShowHistory(false); };
  const onRerun = (e: HistoryEntry) => { setScript(e.script); setShowHistory(false); setTimeout(() => void run(), 0); };
  const onDelete = (id: string) => { const next = history.filter((h) => h.id !== id); setHistory(next); saveHistory(next); };
  const onInsertSnippet = (s: string) => { setScript(s); setShowSnippets(false); };

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div className="sr-root" ref={containerRef}>
      <Toolbar
        isRunning={isRunning}
        onRun={() => void run()}
        onClear={onClear}
        onShowHistory={() => setShowHistory(true)}
        onShowSnippets={() => setShowSnippets(true)}
        onShowAi={() => setShowAi(true)}
        scopeLabel={scopeLabel}
      />
      {isProd && (
        <div className="sr-prod-banner">
          ⚠ Connected to PRODUCTION{instanceName ? ` (${instanceName})` : ''} — scripts execute immediately
        </div>
      )}

      <div className="sr-editor-wrap" style={{ height: editorHeight }}>
        <Editor
          value={script}
          onChange={setScript}
          onCmdEnter={() => void run()}
          height={editorHeight}
        />
      </div>

      <QualityPanel source={script} />

      <div
        className="sr-resize-handle"
        onMouseDown={onResizeStart}
        title="Drag to resize"
        role="separator"
        aria-orientation="horizontal"
      />

      <OutputPanel
        output={output}
        error={error}
        executionTimeMs={executionTimeMs}
        height={Math.max(140, (containerRef.current?.clientHeight ?? 600) - editorHeight - 40 - (isProd ? 36 : 0) - 6)}
      />

      {showHistory && (
        <History
          entries={history}
          onClose={() => setShowHistory(false)}
          onLoad={onLoad}
          onRerun={onRerun}
          onDelete={onDelete}
        />
      )}
      {showSnippets && (
        <Snippets onClose={() => setShowSnippets(false)} onInsert={onInsertSnippet} />
      )}
      {showAi && (
        <AIAssistant
          getScript={() => script}
          onClose={() => setShowAi(false)}
        />
      )}
    </div>
  );
}
