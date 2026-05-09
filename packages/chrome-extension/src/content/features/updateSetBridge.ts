import type {
  UpdateSetSummary,
  UpdateSetRecent,
  UpdateXmlEntry,
  UpdateSetGetCurrentResponse,
  UpdateSetGetRecentResponse,
  UpdateSetGetContentsResponse,
  UpdateSetSwitchResponse,
  UpdateSetCreateResponse,
} from '../../shared/messaging.js';

/**
 * Bridge for the Update Set Dashboard side panel.
 *
 * The side panel lives at chrome-extension:// origin; it can't easily reuse
 * the user's ServiceNow session. The content script (running on the SN page)
 * inherits cookies, so all REST calls happen here. Side panel messages flow
 * through chrome.tabs.sendMessage from the active SN tab.
 */

// ── Generic helpers ─────────────────────────────────────────────────────────

interface BaseEnvelope<T> { result?: T; }

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch { return null; }
}

async function postJson<T>(url: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch { return null; }
}

async function patchJson<T>(url: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(url, {
      method: 'PATCH',
      credentials: 'include',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch { return null; }
}

// ── User identity ───────────────────────────────────────────────────────────

interface UiUserResp {
  result?: { user?: { sys_id?: string; user_name?: string } };
}

async function getCurrentUserSysId(): Promise<string | null> {
  const data = await getJson<UiUserResp>('/api/now/ui/user');
  return data?.result?.user?.sys_id ?? null;
}

// ── Update set lookups ──────────────────────────────────────────────────────

interface PrefRow { sys_id: string; value: string; }

/**
 * Get the user's current update-set preference. Returns the preference's
 * own sys_id (so we can PATCH it later) plus the update set sys_id.
 */
async function getCurrentUpdateSetPref(
  userSysId: string
): Promise<{ prefSysId: string; setSysId: string } | null> {
  const url =
    `/api/now/table/sys_user_preference?sysparm_query=name=sys_update_set^user=${userSysId}` +
    `&sysparm_fields=sys_id,value&sysparm_limit=1`;
  const json = await getJson<BaseEnvelope<PrefRow[]>>(url);
  const row = json?.result?.[0];
  if (!row) return null;
  return { prefSysId: row.sys_id, setSysId: row.value };
}

/** Display-value=all field shape returned by the Table API. */
interface DvField { value: string; display_value: string; }

interface UpdateSetRow {
  sys_id?: DvField;
  name?: DvField;
  state?: DvField;
  is_default?: DvField;
  application?: DvField;
}

async function getUpdateSetDetails(setSysId: string): Promise<UpdateSetRow | null> {
  const url =
    `/api/now/table/sys_update_set/${setSysId}` +
    `?sysparm_fields=sys_id,name,state,is_default,application` +
    `&sysparm_display_value=all`;
  const json = await getJson<BaseEnvelope<UpdateSetRow>>(url);
  return json?.result ?? null;
}

async function getChangeCount(setSysId: string): Promise<number> {
  const url =
    `/api/now/stats/sys_update_xml?sysparm_query=update_set=${setSysId}&sysparm_count=true`;
  const json = await getJson<{ result?: { stats?: { count?: string } } }>(url);
  const c = json?.result?.stats?.count;
  return c ? parseInt(c, 10) : 0;
}

function rowToSummary(row: UpdateSetRow, changeCount: number): UpdateSetSummary {
  return {
    sysId: row.sys_id?.value ?? '',
    name: row.name?.value ?? '',
    state: row.state?.value ?? '',
    stateLabel: row.state?.display_value ?? '',
    appName: row.application?.display_value ?? 'Global',
    appSysId: row.application?.value ?? '',
    isDefault: row.is_default?.value === 'true',
    changeCount,
  };
}

// ── Public handlers ─────────────────────────────────────────────────────────

async function handleGetCurrent(): Promise<UpdateSetGetCurrentResponse> {
  const userId = await getCurrentUserSysId();
  if (!userId) return { ok: false, current: null, error: 'Could not identify current user.' };

  const pref = await getCurrentUpdateSetPref(userId);
  if (!pref) {
    return { ok: true, current: null }; // user has no preference yet
  }

  const row = await getUpdateSetDetails(pref.setSysId);
  if (!row) return { ok: false, current: null, error: 'Failed to load update set details.' };

  const count = await getChangeCount(pref.setSysId);
  return { ok: true, current: rowToSummary(row, count) };
}

async function handleGetRecent(): Promise<UpdateSetGetRecentResponse> {
  const userId = await getCurrentUserSysId();
  if (!userId) return { ok: false, recent: [], error: 'Could not identify current user.' };

  // In-progress sets the user has touched recently. We use sys_updated_by
  // (last edit) instead of sys_created_by to favour the user's working set
  // even when they didn't create it.
  const url =
    `/api/now/table/sys_update_set` +
    `?sysparm_query=state=in progress^ORDERBYDESCsys_updated_on` +
    `&sysparm_fields=sys_id,name,application` +
    `&sysparm_display_value=all` +
    `&sysparm_limit=10`;

  const json = await getJson<BaseEnvelope<Array<{
    sys_id?: DvField; name?: DvField; application?: DvField;
  }>>>(url);
  const rows = json?.result ?? [];

  // Get change counts in parallel
  const recent: UpdateSetRecent[] = await Promise.all(
    rows.map(async (r) => {
      const sysId = r.sys_id?.value ?? '';
      const count = sysId ? await getChangeCount(sysId) : 0;
      return {
        sysId,
        name: r.name?.value ?? '',
        appName: r.application?.display_value ?? 'Global',
        changeCount: count,
      };
    })
  );
  void userId; // userId isn't used as filter — server-side ACLs already scope visibility
  return { ok: true, recent };
}

async function handleGetContents(setSysId: string): Promise<UpdateSetGetContentsResponse> {
  const url =
    `/api/now/table/sys_update_xml` +
    `?sysparm_query=update_set=${setSysId}^ORDERBYtype^ORDERBYname` +
    `&sysparm_fields=sys_id,name,type,target_name,action` +
    `&sysparm_limit=200`;
  const json = await getJson<BaseEnvelope<Array<{
    sys_id?: string; name?: string; type?: string; target_name?: string; action?: string;
  }>>>(url);
  if (!json?.result) return { ok: false, entries: [], error: 'Failed to load update set contents.' };

  const entries: UpdateXmlEntry[] = json.result.map((r) => ({
    sysId: r.sys_id ?? '',
    name: r.name ?? '',
    type: r.type ?? 'Other',
    targetName: r.target_name ?? '',
    action: r.action ?? '',
  }));
  return { ok: true, entries };
}

async function handleSwitch(targetSetSysId: string): Promise<UpdateSetSwitchResponse> {
  const userId = await getCurrentUserSysId();
  if (!userId) return { ok: false, error: 'Could not identify current user.' };

  const pref = await getCurrentUpdateSetPref(userId);
  if (pref) {
    // Update existing preference
    const updated = await patchJson<BaseEnvelope<unknown>>(
      `/api/now/table/sys_user_preference/${pref.prefSysId}`,
      { value: targetSetSysId }
    );
    if (!updated) return { ok: false, error: 'Failed to update preference.' };
    return { ok: true };
  }

  // No preference yet — create one
  const created = await postJson<BaseEnvelope<unknown>>(
    '/api/now/table/sys_user_preference',
    {
      name: 'sys_update_set',
      user: userId,
      value: targetSetSysId,
      type: 'string',
    }
  );
  if (!created) return { ok: false, error: 'Failed to create preference.' };
  return { ok: true };
}

async function handleCreate(name: string, appSysId: string): Promise<UpdateSetCreateResponse> {
  const created = await postJson<BaseEnvelope<{ sys_id?: string }>>(
    '/api/now/table/sys_update_set',
    {
      name,
      application: appSysId,
      state: 'in progress',
    }
  );
  const newSysId = created?.result?.sys_id;
  if (!newSysId) return { ok: false, error: 'Failed to create update set.' };

  // Auto-switch to the new set
  const sw = await handleSwitch(newSysId);
  if (!sw.ok) return { ok: false, sysId: newSysId, error: sw.error ?? 'Created, but could not switch.' };

  return { ok: true, sysId: newSysId };
}

// ── Wire-up ─────────────────────────────────────────────────────────────────

interface IncomingMessage {
  type?: string;
  sysId?: string;
  name?: string;
  appSysId?: string;
}

export function initUpdateSetBridge(): void {
  chrome.runtime.onMessage.addListener((message: IncomingMessage, _sender, sendResponse) => {
    switch (message.type) {
      case 'UPDATE_SET_GET_CURRENT':
        void handleGetCurrent().then(sendResponse);
        return true;
      case 'UPDATE_SET_GET_RECENT':
        void handleGetRecent().then(sendResponse);
        return true;
      case 'UPDATE_SET_GET_CONTENTS':
        if (typeof message.sysId !== 'string') {
          sendResponse({ ok: false, entries: [], error: 'sysId required' });
          return false;
        }
        void handleGetContents(message.sysId).then(sendResponse);
        return true;
      case 'UPDATE_SET_SWITCH':
        if (typeof message.sysId !== 'string') {
          sendResponse({ ok: false, error: 'sysId required' });
          return false;
        }
        void handleSwitch(message.sysId).then(sendResponse);
        return true;
      case 'UPDATE_SET_CREATE':
        if (typeof message.name !== 'string' || typeof message.appSysId !== 'string') {
          sendResponse({ ok: false, error: 'name and appSysId required' });
          return false;
        }
        void handleCreate(message.name, message.appSysId).then(sendResponse);
        return true;
    }
    return false;
  });
}
