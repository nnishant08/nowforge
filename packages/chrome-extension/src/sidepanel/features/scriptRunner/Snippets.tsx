import type { BuiltInSnippet } from './types.js';
import { BUILT_IN_SNIPPETS } from './snippetsData.js';

export interface SnippetsProps {
  onClose: () => void;
  onInsert: (script: string) => void;
}

export function Snippets({ onClose, onInsert }: SnippetsProps) {
  return (
    <div className="sr-overlay">
      <div className="sr-overlay__head">
        <h2 className="sr-overlay__title">Snippets</h2>
        <button type="button" className="sr-overlay__close" onClick={onClose}>×</button>
      </div>
      <div className="sr-overlay__body">
        <ul className="sr-snippets-list">
          {BUILT_IN_SNIPPETS.map((s: BuiltInSnippet) => (
            <li key={s.name} className="sr-snippet-item">
              <div className="sr-snippet-meta">
                <span className="sr-snippet-name">{s.name}</span>
                <span className="sr-snippet-desc">{s.description}</span>
              </div>
              <pre className="sr-snippet-code">{s.script}</pre>
              <div className="sr-snippet-actions">
                <button type="button" onClick={() => onInsert(s.script)}>Insert</button>
                <button
                  type="button"
                  onClick={() => void navigator.clipboard.writeText(s.script)}
                  title="Copy to clipboard"
                >
                  Copy
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
