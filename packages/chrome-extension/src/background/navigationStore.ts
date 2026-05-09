import type { NavRecord, NavVisit } from '../shared/navigation.js';
import {
  HISTORY_KEY,
  MAX_HISTORY_PER_INSTANCE,
  frecencyScore,
} from '../shared/navigation.js';

/**
 * Owns the per-instance navigation history. Read-modify-write is serialised
 * by an in-flight Promise per instance key — multiple SN tabs writing visits
 * concurrently won't lose data as long as the SW stays awake (and even when
 * it sleeps between bursts, the worst case is one dropped visit).
 */

const inflight = new Map<string, Promise<void>>();

async function readHistory(instanceName: string): Promise<NavRecord[]> {
  const key = HISTORY_KEY(instanceName);
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (r) => {
      resolve((r[key] as NavRecord[] | undefined) ?? []);
    });
  });
}

async function writeHistory(instanceName: string, list: NavRecord[]): Promise<void> {
  const key = HISTORY_KEY(instanceName);
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [key]: list }, () => {
      const err = chrome.runtime.lastError;
      if (err) reject(new Error(err.message));
      else resolve();
    });
  });
}

function broadcastChange(instanceName: string): void {
  // Best-effort fan-out to extension pages (popup, side panel). Tabs are
  // not listening — they don't need this message.
  chrome.runtime
    .sendMessage({ type: 'NAV_HISTORY_CHANGED', instanceName })
    .catch(() => { /* nobody home */ });
}

async function recordVisitInner(visit: NavVisit): Promise<void> {
  if (!visit.instanceName || !visit.table || !visit.sysId) return;

  const list = await readHistory(visit.instanceName);
  const idx = list.findIndex(
    (r) => r.table === visit.table && r.sysId === visit.sysId
  );

  if (idx >= 0) {
    const existing = list[idx];
    list[idx] = {
      ...existing,
      visitCount: existing.visitCount + 1,
      lastVisited: visit.timestamp,
      // Refresh display value if the new one is non-empty (titles can lag
      // on SPA nav and arrive empty for the first few ms).
      displayValue: visit.displayValue || existing.displayValue,
      url: visit.url || existing.url,
    };
  } else {
    list.unshift({
      table: visit.table,
      sysId: visit.sysId,
      displayValue: visit.displayValue,
      url: visit.url,
      instanceName: visit.instanceName,
      visitCount: 1,
      firstVisited: visit.timestamp,
      lastVisited: visit.timestamp,
    });
  }

  // Prune by frecency when over the cap
  let pruned = list;
  if (list.length > MAX_HISTORY_PER_INSTANCE) {
    pruned = [...list]
      .sort((a, b) => frecencyScore(b) - frecencyScore(a))
      .slice(0, MAX_HISTORY_PER_INSTANCE);
  }

  await writeHistory(visit.instanceName, pruned);
  broadcastChange(visit.instanceName);
}

/** Public: record a visit. Serialises with any pending write for the same instance. */
export function recordVisit(visit: NavVisit): Promise<void> {
  const key = visit.instanceName;
  const prev = inflight.get(key) ?? Promise.resolve();
  const next = prev.then(() => recordVisitInner(visit)).catch((e) => {
    console.warn('[NowForge BG] nav write failed', e);
  });
  inflight.set(key, next.finally(() => {
    if (inflight.get(key) === next) inflight.delete(key);
  }));
  return next;
}

// ── Wire-up ────────────────────────────────────────────────────────────────

interface IncomingMessage {
  type?: string;
  visit?: NavVisit;
}

export function initNavigationStore(): void {
  chrome.runtime.onMessage.addListener((message: IncomingMessage) => {
    if (message?.type === 'NAV_RECORD_VISITED' && message.visit) {
      void recordVisit(message.visit);
    }
    return false;
  });
}
