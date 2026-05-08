import type { FieldMetadata, FieldRef } from './types.js';

/**
 * Field-metadata cache.
 *
 * Strategy:
 *   • In-memory map for instant hits within a tab session
 *   • Persisted to chrome.storage.local with 1-hour TTL so navigations
 *     within the same instance reuse cached entries
 *   • REST-only for now (Approach B in the spec). g_form access from a
 *     content script's isolated world would require script-tag injection
 *     into page context + a postMessage bridge, which is a fragile and
 *     bigger surface than the cached REST call (~80 ms cold, instant warm).
 */

const CACHE_KEY = 'nowforge_dictionary_cache';
const TTL_MS = 60 * 60 * 1000; // 1 hour

interface CacheEntry {
  data: FieldMetadata;
  expires: number;
}

const memCache = new Map<string, CacheEntry>();
let storageLoaded = false;
let storageLoadPromise: Promise<void> | null = null;

async function loadFromStorage(): Promise<void> {
  if (storageLoaded) return;
  if (storageLoadPromise) return storageLoadPromise;
  storageLoadPromise = new Promise<void>((resolve) => {
    chrome.storage.local.get(CACHE_KEY, (result) => {
      const stored = result[CACHE_KEY] as Record<string, CacheEntry> | undefined;
      if (stored) {
        const now = Date.now();
        for (const [key, entry] of Object.entries(stored)) {
          if (entry.expires > now) memCache.set(key, entry);
        }
      }
      storageLoaded = true;
      resolve();
    });
  });
  return storageLoadPromise;
}

let writeTimer: number | null = null;

function scheduleStorageWrite(): void {
  if (writeTimer !== null) return;
  // Coalesce frequent writes — debounce 1s
  writeTimer = window.setTimeout(() => {
    writeTimer = null;
    const obj: Record<string, CacheEntry> = {};
    const now = Date.now();
    for (const [k, v] of memCache.entries()) {
      if (v.expires > now) obj[k] = v;
    }
    try { void chrome.storage.local.set({ [CACHE_KEY]: obj }); } catch { /* ignore */ }
  }, 1000);
}

// ── Type prettifier ─────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  string: 'String',
  integer: 'Integer',
  long: 'Long',
  decimal: 'Decimal',
  float: 'Float',
  boolean: 'Boolean',
  reference: 'Reference',
  glide_date: 'Date',
  glide_date_time: 'Date/Time',
  due_date: 'Due Date',
  duration: 'Duration',
  glide_duration: 'Duration',
  journal: 'Journal',
  journal_input: 'Journal Input',
  journal_list: 'Journal List',
  html: 'HTML',
  url: 'URL',
  email: 'Email',
  ip_addr: 'IP Address',
  password: 'Password',
  password2: 'Password (encrypted)',
  choice: 'Choice',
  glide_list: 'List',
  domain_id: 'Domain ID',
  sys_class_name: 'Class Name',
  user_image: 'User Image',
  conditions: 'Conditions',
  script: 'Script',
  script_plain: 'Script (Plain)',
  xml: 'XML',
  json: 'JSON',
  table_name: 'Table Name',
  field_name: 'Field Name',
  currency: 'Currency',
  price: 'Price',
};

function prettifyType(internalType: string, referenceTable: string | null): string {
  const base = TYPE_LABELS[internalType] ?? internalType;
  if (internalType === 'reference' && referenceTable) {
    return `Reference → ${referenceTable}`;
  }
  return base;
}

// ── Public API ──────────────────────────────────────────────────────────────

interface DictRowResponse {
  result?: Array<Record<string, string>>;
}

/** Cache key for a (table, field) pair. */
const cacheKeyFor = (ref: FieldRef): string => `${ref.table}.${ref.field}`;

/** Synchronous cache check — returns null if not cached or expired. */
export function getCachedMetadata(ref: FieldRef): FieldMetadata | null {
  const hit = memCache.get(cacheKeyFor(ref));
  if (!hit) return null;
  if (hit.expires <= Date.now()) {
    memCache.delete(cacheKeyFor(ref));
    return null;
  }
  return hit.data;
}

/** Fetch metadata, using cache when fresh. Returns null on failure. */
export async function getFieldMetadata(ref: FieldRef): Promise<FieldMetadata | null> {
  await loadFromStorage();

  const key = cacheKeyFor(ref);
  const cached = getCachedMetadata(ref);
  if (cached) return cached;

  // Build the REST query. `reference.name` dot-walks to the target table's
  // name field — the JSON response uses the literal "reference.name" key.
  const query = encodeURIComponent(`name=${ref.table}^element=${ref.field}`);
  const url =
    `/api/now/table/sys_dictionary?sysparm_query=${query}` +
    `&sysparm_fields=sys_id,element,column_label,internal_type,max_length,mandatory,read_only,reference,reference.name` +
    `&sysparm_limit=1`;

  let row: Record<string, string> | undefined;
  try {
    const res = await fetch(url, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as DictRowResponse;
    row = json.result?.[0];
  } catch {
    return null;
  }
  if (!row) return null;

  const referenceTable = row['reference.name'] || null;
  const internalType = row.internal_type || '';
  const entry: FieldMetadata = {
    sysId: row.sys_id || '',
    element: row.element || ref.field,
    columnLabel: row.column_label || ref.field,
    internalType,
    prettyType: prettifyType(internalType, referenceTable),
    maxLength: row.max_length || '',
    mandatory: row.mandatory === 'true',
    readOnly: row.read_only === 'true',
    referenceTable,
  };

  memCache.set(key, { data: entry, expires: Date.now() + TTL_MS });
  scheduleStorageWrite();
  return entry;
}

// ── Field-ref extraction (used by both context menu + tooltips) ─────────────

const FIELD_NAME_PATTERN = /^[a-z_][a-z0-9_]*$/;

/**
 * Try to determine which (table, field) the given input/select/textarea
 * represents. Looks at id, name, data-name in turn. Falls back to a bare
 * field name combined with the page's current table.
 */
export function extractFieldFromInput(
  input: HTMLElement,
  fallbackTable: string | null
): FieldRef | null {
  const candidates: string[] = [];
  if (input.id) candidates.push(input.id);
  const nameAttr = input.getAttribute('name');
  if (nameAttr) candidates.push(nameAttr);
  const dataName = input.getAttribute('data-name');
  if (dataName) candidates.push(dataName);

  // 1) Look for "<table>.<field>" patterns, possibly with prefixes
  for (const raw of candidates) {
    let cleaned = raw.replace(/^sys_(display|select|original)\./, '');
    cleaned = cleaned.replace(/^IO:/, '');
    cleaned = cleaned.replace(/_label$/, '');
    const dot = cleaned.indexOf('.');
    if (dot > 0) {
      const table = cleaned.slice(0, dot);
      const field = cleaned.slice(dot + 1);
      if (FIELD_NAME_PATTERN.test(table) && FIELD_NAME_PATTERN.test(field)) {
        return { table, field };
      }
    }
  }

  // 2) Bare field name + page table
  if (fallbackTable && FIELD_NAME_PATTERN.test(fallbackTable)) {
    for (const raw of candidates) {
      const cleaned = raw.replace(/^IO:/, '').replace(/_label$/, '');
      if (FIELD_NAME_PATTERN.test(cleaned)) {
        return { table: fallbackTable, field: cleaned };
      }
    }
  }

  return null;
}

/**
 * Find an input/select/textarea associated with this label element.
 * Walks: label[for] → row → ancestors. Returns null if nothing reasonable.
 */
export function findAssociatedInput(label: HTMLElement): HTMLElement | null {
  // 1. Direct for=id binding
  const forId =
    label.getAttribute('for') ||
    label.querySelector('label[for]')?.getAttribute('for');
  if (forId) {
    const el = document.getElementById(forId);
    if (el) return el;
  }
  // 2. Same row (for tables-of-fields layout)
  const row = label.closest('tr');
  if (row) {
    const input = row.querySelector('input, select, textarea');
    if (input) return input as HTMLElement;
  }
  // 3. Walk up ~6 levels
  let parent: HTMLElement | null = label.parentElement;
  let hops = 0;
  while (parent && hops < 6) {
    const input = parent.querySelector('input, select, textarea');
    if (input) return input as HTMLElement;
    parent = parent.parentElement;
    hops++;
  }
  return null;
}

const LABEL_SELECTOR = [
  'label[for]',
  '.label-text',
  '.label_text',
  'th label',
  'td.label label',
  'span.label-text',
].join(', ');

/** Walk up from a contextmenu/mouseover target looking for a field label. */
export function findFieldLabel(start: EventTarget | null): HTMLElement | null {
  let node = start as HTMLElement | null;
  for (let i = 0; node && i < 6; i++, node = node.parentElement) {
    if (node.matches?.(LABEL_SELECTOR)) return node;
  }
  return null;
}
