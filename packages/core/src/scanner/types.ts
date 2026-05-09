export type Severity = 'error' | 'warning' | 'info';

export interface Finding {
  ruleId: string;
  severity: Severity;
  message: string;
  /** 1-based line number. */
  line: number;
  /** 1-based column. */
  column: number;
  /** Optional suggested replacement text for the affected snippet. */
  fix?: string;
}

export interface ScanResult {
  findings: Finding[];
  score: number;
  /** A | B | C | D | F. */
  grade: string;
}
