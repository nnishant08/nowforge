import { useEffect, useMemo, useState } from 'react';
import { scan, type Finding, type ScanResult } from '@nowforge/core';

const DEBOUNCE_MS = 500;

export interface QualityPanelProps {
  source: string;
}

const GRADE_CLASS: Record<string, string> = {
  A: 'q-grade--a',
  B: 'q-grade--b',
  C: 'q-grade--c',
  D: 'q-grade--d',
  F: 'q-grade--f',
};

export function QualityPanel({ source }: QualityPanelProps) {
  const [result, setResult] = useState<ScanResult | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setResult(scan(source));
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [source]);

  const groupedFindings = useMemo(() => {
    if (!result) return new Map<string, Finding[]>();
    const map = new Map<string, Finding[]>();
    for (const f of result.findings) {
      const arr = map.get(f.severity) ?? [];
      arr.push(f);
      map.set(f.severity, arr);
    }
    return map;
  }, [result]);

  if (!result) return null;

  return (
    <div className="quality-panel">
      <button
        type="button"
        className="quality-panel__head"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className={`q-grade ${GRADE_CLASS[result.grade] ?? ''}`}>{result.grade}</span>
        <span className="quality-panel__score">Quality: {result.score}/100</span>
        <span className="quality-panel__counts">
          {result.findings.length === 0 ? 'No issues' : `${result.findings.length} issue(s)`}
        </span>
        <span className="quality-panel__chev">{open ? '▾' : '▸'}</span>
      </button>

      {open && result.findings.length > 0 && (
        <ul className="quality-panel__list">
          {(['error', 'warning', 'info'] as const).map((sev) => {
            const items = groupedFindings.get(sev) ?? [];
            if (items.length === 0) return null;
            return (
              <li key={sev} className={`quality-panel__group quality-panel__group--${sev}`}>
                <div className="quality-panel__group-title">{sev.toUpperCase()}</div>
                <ul>
                  {items.map((f, i) => (
                    <li key={i} className="quality-finding">
                      <span className="quality-finding__loc">L{f.line}:{f.column}</span>
                      <span className="quality-finding__msg">{f.message}</span>
                      <span className="quality-finding__rule">{f.ruleId}</span>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
