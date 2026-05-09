import { ServiceNowApiClient } from '@nowforge/core';
import { getActiveInstance, loadConfig, type InstanceCreds } from '../config.js';
import { isProdInstance, prodWarningPrefix } from '../utils/prodGuard.js';
import { appendAudit } from '../utils/auditLog.js';

/**
 * Shared infrastructure for all tools:
 *   - getClient()           — build the SN REST client for the active instance
 *   - confirmMutation()     — produce a "I'm about to do X, confirm?" reply
 *   - logAndRun()           — wraps a mutation: pre-fetch state → audit → run
 *   - dryRunResult()        — short-circuits when config.dryRun is true
 */

export interface ToolError {
  isError: true;
  content: Array<{ type: 'text'; text: string }>;
}

export interface ToolText {
  content: Array<{ type: 'text'; text: string }>;
}

export type ToolResult = ToolText | ToolError;

export function textResult(text: string): ToolText {
  return { content: [{ type: 'text', text }] };
}

export function errorResult(text: string): ToolError {
  return { isError: true, content: [{ type: 'text', text }] };
}

// ── Connection ────────────────────────────────────────────────────────────

let cachedClient: { instance: string; client: ServiceNowApiClient } | null = null;

export async function getClient(): Promise<{ creds: InstanceCreds; client: ServiceNowApiClient }> {
  const config = await loadConfig();
  const creds = getActiveInstance(config);
  if (!creds) {
    throw new Error('No active instance configured. Set NOWFORGE_INSTANCE/USER/PASSWORD env vars or create ~/.nowforge/config.json.');
  }

  if (cachedClient?.instance === config.activeInstance) return { creds, client: cachedClient.client };

  const client = new ServiceNowApiClient({
    instanceUrl: creds.url,
    auth: { type: 'basic', username: creds.username, password: creds.password },
  });
  cachedClient = { instance: config.activeInstance, client };
  return { creds, client };
}

export async function isDryRun(): Promise<boolean> {
  const config = await loadConfig();
  return config.dryRun === true;
}

// ── Confirmation prompts ──────────────────────────────────────────────────

/**
 * The `confirm` argument convention: every mutating tool accepts `confirm: boolean`.
 * If false (or missing) we return a confirmation prompt instead of executing.
 * This pushes the explicit "yes" to the AI client's user — Claude Desktop /
 * Cursor will surface it and ask the human.
 */
export interface ConfirmableArgs { confirm?: boolean; }

export function confirmMutation(
  creds: InstanceCreds,
  description: string
): ToolText {
  const prefix = prodWarningPrefix(creds);
  const text =
    `${prefix}About to ${description} on instance "${creds.url}".\n\n` +
    `If you want to proceed, call this tool again with \`confirm: true\`.`;
  return textResult(text);
}

// ── Audit + run ───────────────────────────────────────────────────────────

interface RunOpts<TArgs> {
  toolName: string;
  args: TArgs;
  description: string;
  /** Optional: snapshot the existing record so a future rollback can use it. */
  capturePrevious?: () => Promise<unknown>;
  run: () => Promise<unknown>;
}

/**
 * Standard mutation pathway:
 *   1. Confirm gate (unless `confirm: true`)
 *   2. Dry-run gate (returns the description without executing)
 *   3. Capture previous state
 *   4. Run the operation
 *   5. Audit-log the result
 */
export async function logAndRun<TArgs extends ConfirmableArgs>(opts: RunOpts<TArgs>): Promise<ToolResult> {
  const { creds } = await getClient();

  if (!opts.args.confirm) {
    await appendAudit({
      tool: opts.toolName,
      instance: creds.url,
      user: creds.username,
      arguments: opts.args,
      result: 'pending-confirmation',
    });
    return confirmMutation(creds, opts.description);
  }

  if (await isDryRun()) {
    await appendAudit({
      tool: opts.toolName,
      instance: creds.url,
      user: creds.username,
      arguments: opts.args,
      result: 'dry-run',
    });
    const prefix = isProdInstance(creds) ? '⚠️  ' : '';
    return textResult(`${prefix}[DRY RUN] Would ${opts.description} on ${creds.url}.`);
  }

  let previous: unknown;
  if (opts.capturePrevious) {
    try { previous = await opts.capturePrevious(); } catch { /* best-effort */ }
  }

  try {
    const result = await opts.run();
    await appendAudit({
      tool: opts.toolName,
      instance: creds.url,
      user: creds.username,
      arguments: opts.args,
      result: 'success',
      resultDetail: result,
      previousState: previous,
    });
    return textResult(formatSuccess(opts.description, result));
  } catch (err) {
    const message = (err as Error).message;
    await appendAudit({
      tool: opts.toolName,
      instance: creds.url,
      user: creds.username,
      arguments: opts.args,
      result: 'error',
      resultDetail: message,
    });
    return errorResult(`Failed: ${message}`);
  }
}

function formatSuccess(description: string, result: unknown): string {
  const head = `✓ ${description.charAt(0).toUpperCase() + description.slice(1)}.`;
  if (result == null) return head;
  return `${head}\n\n${JSON.stringify(result, null, 2).slice(0, 4000)}`;
}
