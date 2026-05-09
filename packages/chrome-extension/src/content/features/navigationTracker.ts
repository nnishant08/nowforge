import type { PageContext } from '../../shared/messaging.js';
import { sendToBackground } from '../../shared/messaging.js';
import { cleanDisplayTitle } from '../../shared/navigation.js';

/**
 * Detect record-form visits and emit NAV_RECORD_VISITED to the background SW
 * (which serialises writes per instance and persists them).
 *
 * Tracks only `pageType === 'form'` with a real (table, sysId). List views,
 * dashboards, Studio, UIB etc. are intentionally skipped — they're not
 * "records" the user might want to navigate back to.
 *
 * Some SN platform tables produce a lot of noise (ACL editor, dictionary
 * editor, etc.) — skip them too.
 */

const NOISE_TABLES = new Set([
  'sys_dictionary',
  'sys_db_object',
  'sys_metadata',
  'sys_security_acl',
  'sys_audit',
  'sys_log',
  'syslog',
  'sys_history_set',
  'sys_history_line',
  'sys_email',
]);

// Dedupe rapid duplicate visits (within ~2s of each other on the same record).
// SN's SPA sometimes fires multiple title changes on a single navigation.
let lastEmittedKey: string | null = null;
let lastEmittedAt = 0;
const DEDUPE_WINDOW_MS = 2000;

function emit(ctx: PageContext): void {
  if (ctx.pageType !== 'form') return;
  if (!ctx.tableName || !ctx.sysId || !ctx.instanceInfo) return;
  if (NOISE_TABLES.has(ctx.tableName)) return;

  const key = `${ctx.tableName}:${ctx.sysId}`;
  const now = Date.now();
  if (key === lastEmittedKey && now - lastEmittedAt < DEDUPE_WINDOW_MS) return;
  lastEmittedKey = key;
  lastEmittedAt = now;

  sendToBackground({
    type: 'NAV_RECORD_VISITED',
    visit: {
      table: ctx.tableName,
      sysId: ctx.sysId,
      displayValue: cleanDisplayTitle(ctx.title || document.title, ctx.sysId),
      url: ctx.url,
      instanceName: ctx.instanceInfo.instanceName,
      timestamp: now,
    },
  });
}

/**
 * Initialise tracking. Returns a refresh fn the orchestrator calls on
 * SPA URL change so we can emit the new visit.
 */
export function initNavigationTracker(initialContext: PageContext): (ctx: PageContext) => void {
  emit(initialContext);

  // The page title is often empty at document_idle and arrives later. If we
  // saw a form but had no display title, re-emit once after 800ms with the
  // updated title so the history gets a useful label.
  if (
    initialContext.pageType === 'form' &&
    initialContext.tableName &&
    initialContext.sysId &&
    !initialContext.title
  ) {
    window.setTimeout(() => {
      emit({ ...initialContext, title: document.title });
    }, 800);
  }

  return (updated: PageContext) => emit(updated);
}
