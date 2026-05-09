import { useMemo, useState } from 'react';
import type { OutputTab } from './types.js';

export interface OutputPanelProps {
  output: string;
  error: string | null;
  executionTimeMs: number | null;
  height: number;
}

interface ParsedJson {
  ok: true;
  value: unknown;
}
interface ParseFail {
  ok: false;
}
type JsonParseResult = ParsedJson | ParseFail;

function tryParseJson(s: string): JsonParseResult {
  const trimmed = s.trim();
  if (!trimmed) return { ok: false };
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return { ok: false };
  try { return { ok: true, value: JSON.parse(trimmed) }; } catch { return { ok: false }; }
}

interface TableData {
  columns: string[];
  rows: string[][];
}

/**
 * Detect tabular output. We accept either:
 *   • Lines with consistent `|` separators (3+ columns, all rows match)
 *   • Lines with consistent tab separators (3+ columns)
 * First line is the header.
 */
function detectTable(s: string): TableData | null {
  const lines = s.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return null;

  for (const sep of ['\t', '|']) {
    const split = lines.map((l) => l.split(sep).map((c) => c.trim()));
    const cols = split[0].length;
    if (cols < 2) continue;
    if (split.every((row) => row.length === cols)) {
      return { columns: split[0], rows: split.slice(1) };
    }
  }
  return null;
}

export function OutputPanel({ output, error, executionTimeMs, height }: OutputPanelProps) {
  const [tab, setTab] = useState<OutputTab>('text');

  const json = useMemo(() => tryParseJson(output), [output]);
  const table = useMemo(() => detectTable(output), [output]);

  const charCount = output.length;
  const copyOutput = () => { void navigator.clipboard.writeText(output); };

  return (
    <div className="sr-output" style={{ height }}>
      <div className="sr-output__tabs">
        {(['text', 'json', 'table'] as OutputTab[]).map((t) => {
          const enabled =
            t === 'text' ||
            (t === 'json' && json.ok) ||
            (t === 'table' && table !== null);
          return (
            <button
              key={t}
              className={`sr-output__tab${tab === t ? ' sr-output__tab--active' : ''}${enabled ? '' : ' sr-output__tab--disabled'}`}
              onClick={() => enabled && setTab(t)}
              disabled={!enabled}
              type="button"
            >
              {t.toUpperCase()}
            </button>
          );
        })}
        <span className="sr-output__sep" />
        <span className="sr-output__status">
          {executionTimeMs !== null && <span title="Execution time">{executionTimeMs} ms</span>}
          {executionTimeMs !== null && charCount > 0 && <span> · </span>}
          {charCount > 0 && <span title="Output length">{charCount} chars</span>}
        </span>
        <button className="sr-output__copy" onClick={copyOutput} disabled={!output} type="button">
          Copy
        </button>
      </div>

      <div className="sr-output__body">
        {error ? (
          <pre className="sr-output__error">{error}</pre>
        ) : tab === 'text' ? (
          <pre className="sr-output__text">{output || '(no output)'}</pre>
        ) : tab === 'json' && json.ok ? (
          <pre className="sr-output__text sr-output__json">{JSON.stringify(json.value, null, 2)}</pre>
        ) : tab === 'table' && table ? (
          <table className="sr-output__table">
            <thead>
              <tr>{table.columns.map((c, i) => <th key={i}>{c}</th>)}</tr>
            </thead>
            <tbody>
              {table.rows.map((r, i) => (
                <tr key={i}>{r.map((v, j) => <td key={j}>{v}</td>)}</tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="sr-output__empty">Output not available in this format.</div>
        )}
      </div>
    </div>
  );
}
