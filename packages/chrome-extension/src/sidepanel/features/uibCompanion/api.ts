import type {
  UibGetTreeResponse,
  UibGetComponentResponse,
  UibGetStateResponse,
} from '../../../shared/messaging.js';

/**
 * Side-panel-side wrappers for sending UIB_* messages to the active SN tab's
 * content script. The side panel runs at chrome-extension:// — we use
 * chrome.tabs.sendMessage directly.
 */

async function getActiveSnTabId(): Promise<number | null> {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab?.id || !tab.url?.includes('.service-now.com')) {
        resolve(null);
      } else {
        resolve(tab.id);
      }
    });
  });
}

async function send<T>(message: Record<string, unknown>, fallback: T): Promise<T> {
  const tabId = await getActiveSnTabId();
  if (!tabId) return fallback;
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response: T | undefined) => {
      if (chrome.runtime.lastError) { resolve(fallback); return; }
      resolve(response ?? fallback);
    });
  });
}

export const getTree = (): Promise<UibGetTreeResponse> =>
  send<UibGetTreeResponse>(
    { type: 'UIB_GET_TREE' },
    { ok: false, inUib: false, pageTitle: null, tree: null, reason: 'No active ServiceNow tab.' }
  );

export const getComponent = (id: string): Promise<UibGetComponentResponse> =>
  send<UibGetComponentResponse>(
    { type: 'UIB_GET_COMPONENT', id },
    { ok: false, detail: null, reason: 'No active ServiceNow tab.' }
  );

export const getClientState = (): Promise<UibGetStateResponse> =>
  send<UibGetStateResponse>(
    { type: 'UIB_GET_STATE' },
    { ok: false, state: { json: null, source: 'unavailable', error: 'No active ServiceNow tab.' } }
  );

export const setHighlight = (id: string | null): Promise<void> =>
  send<void>({ type: 'UIB_HIGHLIGHT', id }, undefined as void);

export const startEventCapture = (): Promise<void> =>
  send<void>({ type: 'UIB_START_EVENT_CAPTURE' }, undefined as void);

export const stopEventCapture = (): Promise<void> =>
  send<void>({ type: 'UIB_STOP_EVENT_CAPTURE' }, undefined as void);
