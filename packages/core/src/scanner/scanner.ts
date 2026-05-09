import type { Finding, ScanResult } from './types.js';

/**
 * Lightweight regex-based ServiceNow code scanner. Designed to run on every
 * keystroke (debounced) without an AST parser. Each rule is a pure function
 * that takes the source string and returns Findings.
 *
 * For richer AST-based rules we have @nowforge/eslint-plugin-nowforge —
 * the VS Code extension uses that. This module exists for the browser-side
 * "as you type" feedback where a parse step would be too expensive.
 */

const SYS_ID_RE = /\b([a-f0-9]{32})\b/gi;
const NULL_COMPARE_RE = /\b(\w+)\s*(==|===|!=|!==)\s*(null|undefined|"")/g;

interface Rule {
  id: string;
  description: string;
  severity: Finding['severity'];
  scan: (source: string) => Array<Omit<Finding, 'ruleId' | 'severity'>>;
}

const RULES: Rule[] = [
  {
    id: 'no-eval',
    description: 'eval() and new Function() are blocked by SN code scanners.',
    severity: 'error',
    scan(src) {
      return findAll(src, /\b(eval\s*\(|new\s+Function\s*\()/g, () =>
        'Avoid eval() / new Function() — security risk and rejected by SN code review.'
      );
    },
  },
  {
    id: 'no-packages-usage',
    description: 'Packages.* is deprecated and unavailable in scoped apps.',
    severity: 'error',
    scan(src) {
      return findAll(src, /\bPackages\b/g, () =>
        'Packages.* is deprecated and breaks in scoped apps. Use a SN-blessed alternative.'
      );
    },
  },
  {
    id: 'no-synchronous-ajax',
    description: 'getXMLWait() blocks the UI thread.',
    severity: 'error',
    scan(src) {
      return findAll(src, /\.getXMLWait\s*\(/g, () =>
        'getXMLWait() is synchronous and blocks the UI. Use getXMLAnswer(callback) instead.'
      );
    },
  },
  {
    id: 'no-current-update-in-before',
    description: "current.update() in a before BR causes infinite loops.",
    severity: 'error',
    scan(src) {
      return findAll(src, /\bcurrent\s*\.\s*update\s*\(/g, () =>
        'current.update() in a Before business rule causes infinite recursion. Just modify field values; the BR commits them automatically.'
      );
    },
  },
  {
    id: 'use-gs-nil',
    description: 'Prefer gs.nil() over equality with null/undefined/empty.',
    severity: 'warning',
    scan(src) {
      const out: Array<Omit<Finding, 'ruleId' | 'severity'>> = [];
      let m: RegExpExecArray | null;
      const re = new RegExp(NULL_COMPARE_RE.source, 'g');
      while ((m = re.exec(src)) !== null) {
        const { line, column } = posOf(src, m.index);
        out.push({
          line, column,
          message: `Use gs.nil(${m[1]}) instead of comparing to ${m[3]}.`,
        });
      }
      return out;
    },
  },
  {
    id: 'no-hardcoded-sysid',
    description: 'Hardcoded sys_ids break across instances.',
    severity: 'warning',
    scan(src) {
      const out: Array<Omit<Finding, 'ruleId' | 'severity'>> = [];
      let m: RegExpExecArray | null;
      const re = new RegExp(SYS_ID_RE.source, 'gi');
      while ((m = re.exec(src)) !== null) {
        const { line, column } = posOf(src, m.index);
        out.push({
          line, column,
          message: `Hardcoded sys_id '${m[1].slice(0, 8)}…' will break across instances. Use a system property.`,
        });
      }
      return out;
    },
  },
  {
    id: 'no-gs-print-in-prod',
    description: 'gs.print is for background scripts; use gs.info/debug/warn/error for production.',
    severity: 'info',
    scan(src) {
      return findAll(src, /\bgs\s*\.\s*print\s*\(/g, () =>
        'gs.print is for background scripts. Use gs.info/debug/warn/error for production logs.'
      );
    },
  },
  {
    id: 'try-catch-rest-calls',
    description: 'Wrap REST calls in try/catch.',
    severity: 'warning',
    scan(src) {
      const out: Array<Omit<Finding, 'ruleId' | 'severity'>> = [];
      const re = /\b(?:RESTMessageV2|SOAPMessageV2)\s*\([^)]*\)\s*\.\s*execute\s*\(/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src)) !== null) {
        const { line, column } = posOf(src, m.index);
        // Heuristic: is there a "try" within the previous 200 chars?
        const window = src.slice(Math.max(0, m.index - 200), m.index);
        if (!/\btry\s*\{/.test(window)) {
          out.push({
            line, column,
            message: 'REST execute() should be wrapped in try/catch.',
          });
        }
      }
      return out;
    },
  },
  {
    id: 'require-query-condition',
    description: 'GlideRecord.query() without addQuery/addEncodedQuery is a full table scan.',
    severity: 'warning',
    scan(src) {
      const out: Array<Omit<Finding, 'ruleId' | 'severity'>> = [];
      // Look for "var x = new GlideRecord(...)" then "x.query()" with no addQuery/addEncodedQuery between them.
      const declRe = /\b(\w+)\s*=\s*new\s+GlideRecord\s*\(([^)]+)\)/g;
      let dm: RegExpExecArray | null;
      while ((dm = declRe.exec(src)) !== null) {
        const varName = dm[1];
        const after = src.slice(dm.index);
        const queryIdx = after.search(new RegExp(`\\b${varName}\\s*\\.\\s*query\\s*\\(`));
        if (queryIdx === -1) continue;
        const between = after.slice(0, queryIdx);
        if (
          !new RegExp(`\\b${varName}\\s*\\.\\s*addQuery\\s*\\(`).test(between) &&
          !new RegExp(`\\b${varName}\\s*\\.\\s*addEncodedQuery\\s*\\(`).test(between) &&
          !new RegExp(`\\b${varName}\\s*\\.\\s*get\\s*\\(`).test(between) &&
          !new RegExp(`\\b${varName}\\s*\\.\\s*addActiveQuery\\s*\\(`).test(between)
        ) {
          const absolute = dm.index + queryIdx;
          const { line, column } = posOf(src, absolute);
          out.push({
            line, column,
            message: `${varName}.query() has no preceding addQuery/addEncodedQuery — this is a full table scan.`,
          });
        }
      }
      return out;
    },
  },
];

function findAll(
  source: string,
  re: RegExp,
  message: (match: RegExpExecArray) => string
): Array<Omit<Finding, 'ruleId' | 'severity'>> {
  const out: Array<Omit<Finding, 'ruleId' | 'severity'>> = [];
  let m: RegExpExecArray | null;
  const cloned = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  while ((m = cloned.exec(source)) !== null) {
    const { line, column } = posOf(source, m.index);
    out.push({ line, column, message: message(m) });
  }
  return out;
}

/** Convert a 0-based string index to (line, column), both 1-based. */
function posOf(source: string, idx: number): { line: number; column: number } {
  let line = 1;
  let lastNewline = -1;
  for (let i = 0; i < idx; i++) {
    if (source.charCodeAt(i) === 10) {
      line++;
      lastNewline = i;
    }
  }
  return { line, column: idx - lastNewline };
}

/** Run all rules against `source` and compute a quality score. */
export function scan(source: string): ScanResult {
  const findings: Finding[] = [];
  for (const rule of RULES) {
    const partials = rule.scan(source);
    for (const p of partials) {
      findings.push({ ...p, ruleId: rule.id, severity: rule.severity });
    }
  }
  const score = scoreFindings(findings);
  return { findings, score, grade: gradeFor(score) };
}

function scoreFindings(findings: Finding[]): number {
  let score = 100;
  for (const f of findings) {
    if (f.severity === 'error') score -= 15;
    else if (f.severity === 'warning') score -= 5;
    else score -= 2;
  }
  return Math.max(0, score);
}

function gradeFor(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

export const SCANNER_RULES = RULES.map((r) => ({
  id: r.id,
  description: r.description,
  severity: r.severity,
}));
