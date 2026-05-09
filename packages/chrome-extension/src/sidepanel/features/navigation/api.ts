import type { GetPageContextResponse, PageContext } from '../../../shared/messaging.js';
import {
  loadHistory as loadHistoryShared,
  loadFavorites as loadFavoritesShared,
  saveFavorites as saveFavoritesShared,
  type NavRecord,
  type NavFavorite,
} from '../../../shared/navigation.js';

export type { NavRecord, NavFavorite };

/** Get the active SN tab's context (instance, etc.) via the background SW. */
export async function getActivePageContext(): Promise<PageContext | null> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'GET_PAGE_CONTEXT' }, (res: GetPageContextResponse) => {
      if (chrome.runtime.lastError) { resolve(null); return; }
      resolve(res?.context ?? null);
    });
  });
}

/** Active tab's base URL for building deep-links. */
export async function getActiveTabBaseUrl(): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      const url = tabs[0]?.url;
      if (!url) { resolve(null); return; }
      try {
        const u = new URL(url);
        resolve(`${u.protocol}//${u.host}`);
      } catch { resolve(null); }
    });
  });
}

export const loadHistory = loadHistoryShared;
export const loadFavorites = loadFavoritesShared;
export const saveFavorites = saveFavoritesShared;

/**
 * Pin a record. Adds to favorites at the top, deduping by (table, sys_id).
 */
export async function pinFavorite(
  instanceName: string,
  fav: Omit<NavFavorite, 'pinnedAt' | 'instanceName'>
): Promise<void> {
  const existing = await loadFavorites(instanceName);
  const filtered = existing.filter((e) => !(e.table === fav.table && e.sysId === fav.sysId));
  filtered.unshift({ ...fav, instanceName, pinnedAt: Date.now() });
  await saveFavorites(instanceName, filtered);
}

export async function unpinFavorite(
  instanceName: string,
  table: string,
  sysId: string
): Promise<void> {
  const existing = await loadFavorites(instanceName);
  const filtered = existing.filter((e) => !(e.table === table && e.sysId === sysId));
  await saveFavorites(instanceName, filtered);
}

export async function isFavorited(
  instanceName: string,
  table: string,
  sysId: string
): Promise<boolean> {
  const existing = await loadFavorites(instanceName);
  return existing.some((e) => e.table === table && e.sysId === sysId);
}

/**
 * Open a record on the active SN tab — same window navigation by default,
 * or new tab when newTab=true.
 */
export async function openRecord(table: string, sysId: string, newTab: boolean): Promise<void> {
  const base = await getActiveTabBaseUrl();
  if (!base) return;
  const url = `${base}/${table}.do?sys_id=${sysId}`;
  if (newTab) {
    await chrome.tabs.create({ url });
  } else {
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    const id = tabs[0]?.id;
    if (id) await chrome.tabs.update(id, { url });
    else await chrome.tabs.create({ url });
  }
}

export async function openTableList(table: string, newTab: boolean): Promise<void> {
  const base = await getActiveTabBaseUrl();
  if (!base) return;
  const url = `${base}/${table}_list.do`;
  if (newTab) {
    await chrome.tabs.create({ url });
  } else {
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    const id = tabs[0]?.id;
    if (id) await chrome.tabs.update(id, { url });
    else await chrome.tabs.create({ url });
  }
}

/**
 * Look up a record by its number column (e.g. "INC0010001") and navigate.
 * Returns true if a record was found and navigation started.
 */
export async function openByNumber(
  table: string,
  number: string,
  newTab: boolean
): Promise<{ ok: boolean; error?: string }> {
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const tabId = tabs[0]?.id;
  const tabUrl = tabs[0]?.url;
  if (!tabId || !tabUrl?.includes('.service-now.com')) {
    return { ok: false, error: 'No active ServiceNow tab.' };
  }
  // Use a simple fetch from the side panel — extension has host_permissions
  // for *.service-now.com so cookies are sent automatically.
  let base: string;
  try {
    const u = new URL(tabUrl);
    base = `${u.protocol}//${u.host}`;
  } catch {
    return { ok: false, error: 'Could not derive instance URL.' };
  }
  const url =
    `${base}/api/now/table/${encodeURIComponent(table)}` +
    `?sysparm_query=number=${encodeURIComponent(number)}` +
    `&sysparm_fields=sys_id&sysparm_limit=1`;
  let res: Response;
  try {
    res = await fetch(url, { credentials: 'include', headers: { Accept: 'application/json' } });
  } catch (e) {
    return { ok: false, error: `Network error: ${(e as Error).message}` };
  }
  if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
  const json = (await res.json()) as { result?: Array<{ sys_id?: string }> };
  const sysId = json.result?.[0]?.sys_id;
  if (!sysId) return { ok: false, error: `No ${table} record found with number "${number}".` };
  await openRecord(table, sysId, newTab);
  return { ok: true };
}
