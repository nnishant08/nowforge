import type { PageContext } from '../../shared/messaging.js';
import {
  HISTORY_KEY,
  FAVORITES_KEY,
  loadHistory,
  loadFavorites,
  sortByFrecency,
  tableIcon,
  tableFromRecordNumber,
  type NavRecord,
  type NavFavorite,
} from '../../shared/navigation.js';
import type { Command } from './commandBar/types.js';
import { getCommandBarInstance } from './commandBar/index.js';

/**
 * Reads recent + favorite records for the current instance and injects them
 * into the command bar as ordinary `nav` commands. Updates whenever
 * chrome.storage.onChanged fires for our keys.
 *
 * Lives in the content script — same world as the command bar — so we don't
 * need to bounce through the background SW.
 */

const RECENT_LIMIT_FOR_CMDBAR = 30;

function buildCommands(
  history: NavRecord[],
  favorites: NavFavorite[],
  baseUrl: string
): Command[] {
  const ranked = sortByFrecency(history).slice(0, RECENT_LIMIT_FOR_CMDBAR);
  const favKeys = new Set(favorites.map((f) => `${f.table}:${f.sysId}`));

  const cmds: Command[] = [];

  // Favorites first
  for (const f of favorites) {
    cmds.push(buildOne(f, true, baseUrl));
  }
  // Then recents (skip ones already shown as favorites)
  for (const r of ranked) {
    if (favKeys.has(`${r.table}:${r.sysId}`)) continue;
    cmds.push(buildOne(r, false, baseUrl));
  }
  return cmds;
}

function buildOne(
  record: { table: string; sysId: string; displayValue: string; url: string },
  isFavorite: boolean,
  baseUrl: string
): Command {
  // Try to extract a record number (e.g. INC0010001) for keyword matching
  const numMatch = record.displayValue.match(/\b([A-Z]+\d{4,})\b/);
  const number = numMatch ? numMatch[1] : null;
  const keywords = [record.table, record.displayValue];
  if (number) keywords.push(number);
  const numTable = number ? tableFromRecordNumber(number) : null;
  if (numTable) keywords.push(numTable);

  return {
    id: `nav:${record.table}:${record.sysId}`,
    label: record.displayValue,
    description: `${isFavorite ? '★ ' : ''}${record.table}`,
    category: 'navigation',
    icon: isFavorite ? '★' : tableIcon(record.table),
    keywords,
    shortcut: '↵',
    execute(_ctx, opts) {
      const url = `${baseUrl}/${record.table}.do?sys_id=${record.sysId}`;
      if (opts.newTab) window.open(url, '_blank');
      else window.location.href = url;
    },
  };
}

let currentInstance: string | null = null;
let currentBaseUrl: string | null = null;
let storageListener: ((c: { [k: string]: chrome.storage.StorageChange }, area: string) => void) | null = null;

async function refreshBar(): Promise<void> {
  if (!currentInstance || !currentBaseUrl) return;
  const bar = getCommandBarInstance();
  if (!bar) return;
  const [history, favorites] = await Promise.all([
    loadHistory(currentInstance),
    loadFavorites(currentInstance),
  ]);
  bar.setExtraCommands(buildCommands(history, favorites, currentBaseUrl));
}

/**
 * Initialise. The orchestrator passes in the initial PageContext (so we know
 * the instance + base URL) and calls the returned function on SPA nav.
 */
export function initNavCommandBarLink(initialContext: PageContext): (ctx: PageContext) => void {
  const update = (ctx: PageContext): void => {
    const inst = ctx.instanceInfo?.instanceName ?? null;
    const base = ctx.instanceInfo?.baseUrl ?? null;
    if (!inst || !base) return;

    const instanceChanged = inst !== currentInstance;
    currentInstance = inst;
    currentBaseUrl = base;

    if (instanceChanged) {
      // (Re-)attach the storage listener for this instance's keys
      if (storageListener) chrome.storage.onChanged.removeListener(storageListener);
      const histKey = HISTORY_KEY(inst);
      const favKey = FAVORITES_KEY(inst);
      storageListener = (changes, _area) => {
        if (histKey in changes || favKey in changes) {
          void refreshBar();
        }
      };
      chrome.storage.onChanged.addListener(storageListener);
    }

    void refreshBar();
  };

  update(initialContext);
  return update;
}
