export interface ToolbarProps {
  isRunning: boolean;
  onRun: () => void;
  onClear: () => void;
  onShowHistory: () => void;
  onShowSnippets: () => void;
  onShowAi: () => void;
  scopeLabel: string | null;
}

export function Toolbar({
  isRunning, onRun, onClear, onShowHistory, onShowSnippets, onShowAi, scopeLabel,
}: ToolbarProps) {
  return (
    <div className="sr-toolbar">
      <button
        type="button"
        className="sr-toolbar__run"
        onClick={onRun}
        disabled={isRunning}
        title="Run script (⌘↵)"
      >
        {isRunning ? (
          <>
            <span className="sr-spinner" /> Running…
          </>
        ) : (
          <>
            <span className="sr-toolbar__play">▶</span> Run
          </>
        )}
      </button>

      <div className="sr-toolbar__scope" title={scopeLabel ? `Scope: ${scopeLabel}` : 'Scope unavailable'}>
        <span className="sr-toolbar__scope-label">Scope</span>
        <span className="sr-toolbar__scope-value">{scopeLabel ?? '—'}</span>
      </div>

      <div className="sr-toolbar__spacer" />

      <button type="button" className="sr-toolbar__btn" onClick={onShowAi} title="AI Assistant">
        🤖
      </button>
      <button type="button" className="sr-toolbar__btn" onClick={onShowHistory} title="History">
        ⏱
      </button>
      <button type="button" className="sr-toolbar__btn" onClick={onShowSnippets} title="Snippets">
        ✨
      </button>
      <button type="button" className="sr-toolbar__btn" onClick={onClear} title="Clear editor">
        ✕
      </button>
    </div>
  );
}
