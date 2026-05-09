import { useMemo, useRef, useState } from 'react';
import {
  isSysId,
  tableFromRecordNumber,
  COMMON_TABLES,
} from '../../../shared/navigation.js';
import { openByNumber, openRecord, openTableList } from './api.js';

export interface QuickJumpProps {
  onError: (message: string) => void;
}

/**
 * Single input that handles three jump styles:
 *   • Record number (INC0010001) → look up sys_id via /api/now/table → navigate
 *   • Table + sys_id ("incident abc12...32 chars") → direct navigate
 *   • Bare table name ("incident") → open the list
 */
export function QuickJump({ onError }: QuickJumpProps) {
  const [value, setValue] = useState('');
  const [showSuggest, setShowSuggest] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmed = value.trim();
  const suggestions = useMemo(() => {
    if (!trimmed) return [];
    const q = trimmed.toLowerCase();
    if (q.includes(' ')) return [];               // "table sys_id" form, no suggestions
    if (tableFromRecordNumber(trimmed)) return []; // record-number form
    return COMMON_TABLES.filter((t) => t.startsWith(q)).slice(0, 6);
  }, [trimmed]);

  const dispatch = async (input: string, newTab: boolean): Promise<void> => {
    if (!input) return;
    setBusy(true);
    try {
      // 1) "table sys_id" — direct
      const parts = input.split(/\s+/);
      if (parts.length === 2 && isSysId(parts[1])) {
        await openRecord(parts[0], parts[1], newTab);
        setValue('');
        return;
      }
      // 2) Record number (INC0010001 etc.)
      const numTable = tableFromRecordNumber(input);
      if (numTable) {
        const res = await openByNumber(numTable, input, newTab);
        if (!res.ok) {
          onError(res.error ?? `Couldn't find ${input}`);
        } else {
          setValue('');
        }
        return;
      }
      // 3) Bare table → open list
      if (/^[a-z_][a-z0-9_]*$/.test(input)) {
        await openTableList(input, newTab);
        setValue('');
        return;
      }
      // 4) Bare 32-char sys_id with no table — ambiguous
      if (isSysId(input)) {
        onError('Specify a table: "incident <sys_id>"');
        return;
      }
      onError('Type a record number (INC0010001), table name (incident), or "table <sys_id>".');
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void dispatch(trimmed, e.metaKey || e.ctrlKey);
    }
    if (e.key === 'Escape') {
      setValue('');
      setShowSuggest(false);
    }
  };

  const pickSuggestion = (table: string) => {
    setValue(table + ' ');
    setShowSuggest(false);
    inputRef.current?.focus();
  };

  return (
    <div className="nv-quickjump">
      <div className="nv-quickjump__field">
        <span className="nv-quickjump__icon" aria-hidden>↳</span>
        <input
          ref={inputRef}
          type="text"
          className="nv-quickjump__input"
          placeholder="Jump to: INC0010001, incident, or incident <sys_id>"
          value={value}
          onChange={(e) => { setValue(e.target.value); setShowSuggest(true); }}
          onFocus={() => setShowSuggest(true)}
          onBlur={() => window.setTimeout(() => setShowSuggest(false), 120)}
          onKeyDown={onKeyDown}
          disabled={busy}
          spellCheck={false}
          autoComplete="off"
        />
        {busy && <span className="nv-quickjump__spinner" />}
      </div>
      {showSuggest && suggestions.length > 0 && (
        <ul className="nv-quickjump__suggest" role="listbox">
          {suggestions.map((t) => (
            <li key={t}>
              <button
                type="button"
                className="nv-quickjump__suggest-item"
                onMouseDown={(e) => { e.preventDefault(); pickSuggestion(t); }}
              >
                <span className="nv-quickjump__suggest-icon" aria-hidden>📋</span>
                {t}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
