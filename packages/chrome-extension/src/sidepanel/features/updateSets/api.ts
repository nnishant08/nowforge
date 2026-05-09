import type {
  UpdateSetGetCurrentResponse,
  UpdateSetGetRecentResponse,
  UpdateSetGetContentsResponse,
  UpdateSetSwitchResponse,
  UpdateSetCreateResponse,
} from '../../../shared/messaging.js';

/**
 * Tiny wrapper over chrome.tabs.sendMessage for talking to the active SN
 * tab's content-script bridge. All Update-Set REST work lives over there
 * because the content script inherits SN session cookies.
 */

async function getActiveSnTabId(): Promise<number | null> {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      const tab = tabs[0];
      const url = tab?.url ?? '';
      if (!tab?.id || !url.includes('.service-now.com')) {
        resolve(null);
      } else {
        resolve(tab.id);
      }
    });
  });
}

async function send<TResp>(
  message: Record<string, unknown>,
  fallback: TResp
): Promise<TResp> {
  const tabId = await getActiveSnTabId();
  if (!tabId) return fallback;
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response: TResp | undefined) => {
      if (chrome.runtime.lastError) {
        resolve(fallback);
        return;
      }
      resolve(response ?? fallback);
    });
  });
}

export function getCurrent(): Promise<UpdateSetGetCurrentResponse> {
  return send<UpdateSetGetCurrentResponse>(
    { type: 'UPDATE_SET_GET_CURRENT' },
    { ok: false, current: null, error: 'No active ServiceNow tab.' }
  );
}

export function getRecent(): Promise<UpdateSetGetRecentResponse> {
  return send<UpdateSetGetRecentResponse>(
    { type: 'UPDATE_SET_GET_RECENT' },
    { ok: false, recent: [], error: 'No active ServiceNow tab.' }
  );
}

export function getContents(sysId: string): Promise<UpdateSetGetContentsResponse> {
  return send<UpdateSetGetContentsResponse>(
    { type: 'UPDATE_SET_GET_CONTENTS', sysId },
    { ok: false, entries: [], error: 'No active ServiceNow tab.' }
  );
}

export function switchTo(sysId: string): Promise<UpdateSetSwitchResponse> {
  return send<UpdateSetSwitchResponse>(
    { type: 'UPDATE_SET_SWITCH', sysId },
    { ok: false, error: 'No active ServiceNow tab.' }
  );
}

export function createSet(name: string, appSysId: string): Promise<UpdateSetCreateResponse> {
  return send<UpdateSetCreateResponse>(
    { type: 'UPDATE_SET_CREATE', name, appSysId },
    { ok: false, error: 'No active ServiceNow tab.' }
  );
}

/**
 * Find the URL base of the current SN tab so we can build deep links
 * (e.g. open the sys_update_xml record in a new tab).
 */
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
