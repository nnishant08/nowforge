/**
 * Lightweight REST helpers used by the instance tag's expanded panel.
 * The content script runs on the SN domain so the user's session cookie
 * is sent automatically — no auth flow needed.
 *
 * Each result is cached for 5 minutes per page load.
 */

interface CacheEntry<T> {
  value: T;
  expires: number;
}

const TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, CacheEntry<unknown>>();

async function cached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = cache.get(key) as CacheEntry<T> | undefined;
  if (hit && hit.expires > now) return hit.value;
  const value = await fetcher();
  cache.set(key, { value, expires: now + TTL_MS });
  return value;
}

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(path, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ── User ─────────────────────────────────────────────────────────────────────

export interface SnowUser {
  /** Display name (full_name or user_name). */
  name: string;
  /** sys_id of sys_user record, if known. */
  userId: string;
}

interface UiUserResponse {
  result?: {
    user?: {
      user_name?: string;
      sys_id?: string;
      full_name?: string;
      first_name?: string;
      last_name?: string;
    };
  };
}

export async function getCurrentUser(): Promise<SnowUser | null> {
  return cached('user', async () => {
    const data = await fetchJson<UiUserResponse>('/api/now/ui/user');
    if (data?.result?.user) {
      const u = data.result.user;
      const composed = [u.first_name, u.last_name].filter(Boolean).join(' ');
      const name = u.full_name || composed || u.user_name || 'unknown';
      return { name, userId: u.sys_id ?? '' };
    }
    // DOM fallback for classic UI
    const dropdown = document.getElementById('user_info_dropdown');
    if (dropdown) return { name: dropdown.textContent?.trim() ?? 'unknown', userId: '' };
    return null;
  });
}

// ── Update Set ───────────────────────────────────────────────────────────────

interface UpdateSetResponse {
  result?: Array<{ name?: string; sys_id?: string }>;
}

export async function getCurrentUpdateSet(): Promise<string | null> {
  return cached('updateSet', async () => {
    // The "current" update set is the in-progress, default one for this user.
    // The exact query depends on the instance, but this is a reasonable default.
    const url =
      '/api/now/table/sys_update_set' +
      '?sysparm_query=is_default%3Dtrue%5Estate%3Din%20progress' +
      '&sysparm_fields=name' +
      '&sysparm_limit=1';
    const data = await fetchJson<UpdateSetResponse>(url);
    if (data?.result?.[0]?.name) return data.result[0].name;
    return null;
  });
}

// ── Scope ────────────────────────────────────────────────────────────────────

export async function getCurrentScope(): Promise<string | null> {
  return cached('scope', async () => {
    // Best effort — scope is usually tracked in the user's session.
    // The /api/now/ui/concoursepicker/application endpoint returns the current app.
    const data = await fetchJson<{
      result?: { current?: { name?: string; scope?: string } };
    }>('/api/now/ui/concoursepicker/application');
    const current = data?.result?.current;
    if (current?.name) return current.name;
    if (current?.scope) return current.scope;

    // Fallback: look for a concourse picker DOM hint
    const el = document.querySelector('[data-application-name]');
    if (el?.getAttribute('data-application-name')) {
      return el.getAttribute('data-application-name');
    }
    return 'Global';
  });
}

/** Clear the snowApi cache — call when the user clicks "refresh" on the tag. */
export function clearSnowApiCache(): void {
  cache.clear();
}
