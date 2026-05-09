import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

/**
 * Append-only audit log of every mutating MCP tool call. Stored at
 * ~/.nowforge/audit.log as newline-delimited JSON so the user can grep,
 * tail, or pipe to jq without parsing surprises.
 *
 * Every entry includes the previous state for create/update calls, so a
 * future `rollback_last` tool can reverse it.
 */

export interface AuditEntry {
  timestamp: string;
  tool: string;
  instance: string;
  user: string;
  arguments: unknown;
  result: 'success' | 'error' | 'dry-run' | 'pending-confirmation';
  resultDetail?: unknown;
  /** State of the affected record before the operation, for rollback. */
  previousState?: unknown;
}

const LOG_DIR = path.join(os.homedir(), '.nowforge');
const LOG_FILE = path.join(LOG_DIR, 'audit.log');

let lastEntry: AuditEntry | null = null;

export async function appendAudit(entry: Omit<AuditEntry, 'timestamp'>): Promise<void> {
  const full: AuditEntry = { timestamp: new Date().toISOString(), ...entry };
  lastEntry = full;
  await fs.mkdir(LOG_DIR, { recursive: true, mode: 0o700 });
  await fs.appendFile(LOG_FILE, JSON.stringify(full) + '\n', { mode: 0o600 });
}

export function getLastAudit(): AuditEntry | null {
  return lastEntry;
}

/** Read the last N entries (for diagnostics tools). */
export async function readRecentAudits(limit = 20): Promise<AuditEntry[]> {
  try {
    const raw = await fs.readFile(LOG_FILE, 'utf8');
    const lines = raw.trim().split('\n').slice(-limit);
    return lines.map((l) => JSON.parse(l) as AuditEntry);
  } catch {
    return [];
  }
}
