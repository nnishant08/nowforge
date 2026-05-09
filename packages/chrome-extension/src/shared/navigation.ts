/**
 * Shared types and helpers for the Smart Navigation feature.
 * Used by content tracker, background store, side panel UI, and the
 * command bar's nav-records integration.
 */

export interface NavVisit {
  table: string;
  sysId: string;
  displayValue: string;
  url: string;
  instanceName: string;
  /** Time of this single visit in ms-epoch. */
  timestamp: number;
}

export interface NavRecord {
  table: string;
  sysId: string;
  displayValue: string;
  url: string;
  instanceName: string;
  visitCount: number;
  /** Most-recent visit, ms-epoch. */
  lastVisited: number;
  /** First-ever visit, ms-epoch. */
  firstVisited: number;
}

export interface NavFavorite {
  table: string;
  sysId: string;
  displayValue: string;
  url: string;
  instanceName: string;
  pinnedAt: number;
}

// ── Storage keys ────────────────────────────────────────────────────────────

export const HISTORY_KEY = (instance: string): string =>
  `nowforge_nav_history_${instance}`;

export const FAVORITES_KEY = (instance: string): string =>
  `nowforge_nav_favorites_${instance}`;

export const MAX_HISTORY_PER_INSTANCE = 200;

// ── Frecency ────────────────────────────────────────────────────────────────

const HOUR = 60 * 60 * 1000;

/**
 * recencyBonus(t) — see spec.
 *   <1h: +100   <4h: +70   <24h: +50   <48h: +30   <168h: +15   else 0
 */
export function recencyBonus(lastVisited: number, now: number = Date.now()): number {
  const age = now - lastVisited;
  if (age < HOUR) return 100;
  if (age < 4 * HOUR) return 70;
  if (age < 24 * HOUR) return 50;
  if (age < 48 * HOUR) return 30;
  if (age < 168 * HOUR) return 15;
  return 0;
}

export function frecencyScore(record: NavRecord, now: number = Date.now()): number {
  return record.visitCount * 10 + recencyBonus(record.lastVisited, now);
}

export function sortByFrecency(records: NavRecord[]): NavRecord[] {
  const now = Date.now();
  return [...records].sort((a, b) => frecencyScore(b, now) - frecencyScore(a, now));
}

// ── Display helpers ─────────────────────────────────────────────────────────

const TABLE_ICONS: Record<string, string> = {
  incident: '🐛',
  change_request: '🔄',
  change_task: '🔄',
  problem: '⚠️',
  task: '✅',
  sc_request: '🛒',
  sc_req_item: '📦',
  sc_task: '📋',
  sc_cat_item: '🛍️',
  kb_knowledge: '📚',
  sys_user: '👤',
  sys_user_group: '👥',
  sys_user_role: '🔑',
  cmdb_ci: '🖥️',
  cmdb_ci_server: '🖥️',
  sys_script: '📜',          // Business Rule
  sys_script_include: '🧩',
  sys_script_client: '🖱️',
  sys_script_fix: '🔧',
  sys_ui_action: '🔘',
  sys_ui_policy: '🎨',
  sys_ui_script: '📄',
  sys_update_set: '📦',
  sys_update_xml: '📝',
  sys_properties: '⚙️',
  sys_dictionary: '📖',
  sys_db_object: '🗄️',
  sys_app: '📱',
  sp_widget: '🧱',
  sp_page: '🌐',
  sn_hr_core_case: '👤',
  sn_customerservice_case: '🤝',
};

export function tableIcon(table: string): string {
  return TABLE_ICONS[table] ?? '📋';
}

/**
 * Extract a clean display value from a SN page's document.title.
 * SN pages typically look like:
 *   "Incident - INC0010001 - System Administrator | ServiceNow"
 *   "INC0010001 — Email server is down | ServiceNow"
 *   "Studio | ServiceNow"
 */
export function cleanDisplayTitle(rawTitle: string, fallback: string): string {
  let t = rawTitle.replace(/\s*\|\s*ServiceNow.*$/i, '');
  t = t.replace(/^ServiceNow\s*[-–|]\s*/i, '');
  t = t.trim();
  return t || fallback;
}

/**
 * Match a record-number-style string (e.g. "INC0010001") to a table name.
 * Returns null if the prefix isn't recognised.
 */
const NUMBER_PREFIX_MAP: Array<{ re: RegExp; table: string }> = [
  { re: /^INC\d+$/i,    table: 'incident' },
  { re: /^CHG\d+$/i,    table: 'change_request' },
  { re: /^PRB\d+$/i,    table: 'problem' },
  { re: /^TASK\d+$/i,   table: 'task' },
  { re: /^KB\d+$/i,     table: 'kb_knowledge' },
  { re: /^RITM\d+$/i,   table: 'sc_req_item' },
  { re: /^REQ\d+$/i,    table: 'sc_request' },
  { re: /^SCTASK\d+$/i, table: 'sc_task' },
  { re: /^CTASK\d+$/i,  table: 'change_task' },
  { re: /^HRC\d+$/i,    table: 'sn_hr_core_case' },
  { re: /^CS\d+$/i,     table: 'sn_customerservice_case' },
];

export function tableFromRecordNumber(input: string): string | null {
  const trimmed = input.trim();
  for (const { re, table } of NUMBER_PREFIX_MAP) {
    if (re.test(trimmed)) return table;
  }
  return null;
}

/** A small list of common tables for QuickJump autocomplete. */
export const COMMON_TABLES: string[] = [
  'incident', 'change_request', 'change_task', 'problem', 'task',
  'sc_request', 'sc_req_item', 'sc_task', 'sc_cat_item',
  'kb_knowledge', 'sys_user', 'sys_user_group', 'sys_user_role',
  'cmdb_ci', 'sys_script', 'sys_script_include', 'sys_script_client',
  'sys_script_fix', 'sys_ui_action', 'sys_ui_policy', 'sys_ui_script',
  'sys_update_set', 'sys_update_xml', 'sys_properties', 'sys_dictionary',
  'sys_db_object', 'sys_app', 'sp_widget', 'sp_page',
];

const SYS_ID_RE = /^[a-f0-9]{32}$/i;
export const isSysId = (s: string): boolean => SYS_ID_RE.test(s.trim());

// ── Relative time ──────────────────────────────────────────────────────────

const MIN = 60 * 1000;

export function formatRelativeTime(ts: number, now: number = Date.now()): string {
  const diff = now - ts;
  if (diff < 0) return 'just now';
  if (diff < MIN) return 'just now';
  if (diff < 60 * MIN) return `${Math.floor(diff / MIN)} min ago`;
  if (diff < 24 * 60 * MIN) {
    const hrs = Math.floor(diff / (60 * MIN));
    return `${hrs} hr${hrs === 1 ? '' : 's'} ago`;
  }
  if (diff < 48 * 60 * MIN) return 'yesterday';
  if (diff < 7 * 24 * 60 * MIN) {
    const days = Math.floor(diff / (24 * 60 * MIN));
    return `${days} days ago`;
  }
  // Older than a week — show the date
  return new Date(ts).toLocaleDateString();
}

// ── Storage helpers (work from background SW or extension pages) ────────────

export async function loadHistory(instanceName: string): Promise<NavRecord[]> {
  const key = HISTORY_KEY(instanceName);
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (r) => {
      resolve((r[key] as NavRecord[] | undefined) ?? []);
    });
  });
}

export async function loadFavorites(instanceName: string): Promise<NavFavorite[]> {
  const key = FAVORITES_KEY(instanceName);
  return new Promise((resolve) => {
    chrome.storage.sync.get(key, (r) => {
      resolve((r[key] as NavFavorite[] | undefined) ?? []);
    });
  });
}

export async function saveFavorites(instanceName: string, favs: NavFavorite[]): Promise<void> {
  const key = FAVORITES_KEY(instanceName);
  return new Promise((resolve) => {
    chrome.storage.sync.set({ [key]: favs }, () => resolve());
  });
}
