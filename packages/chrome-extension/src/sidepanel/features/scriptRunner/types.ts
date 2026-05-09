export interface HistoryEntry {
  id: string;
  script: string;
  output: string;
  ok: boolean;
  error?: string;
  timestamp: number;
  /** Instance subdomain at execution time (e.g. "calibr8nowdemo1"). */
  instanceName: string | null;
  /** Scope at execution time, if known. */
  scope: string | null;
  executionTimeMs: number;
}

export interface BuiltInSnippet {
  name: string;
  description: string;
  script: string;
}

export type OutputTab = 'text' | 'json' | 'table';
