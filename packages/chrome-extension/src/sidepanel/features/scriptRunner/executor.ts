import type {
  RunScriptResponse,
  GetCurrentScopeResponse,
  PageContext,
  GetPageContextResponse,
} from '../../../shared/messaging.js';

/**
 * Send messages to the active SN tab's content script. Side panel is in
 * a different document/origin so we go through chrome.tabs.sendMessage.
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

export async function getActivePageContext(): Promise<PageContext | null> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'GET_PAGE_CONTEXT' }, (res: GetPageContextResponse) => {
      if (chrome.runtime.lastError) { resolve(null); return; }
      resolve(res?.context ?? null);
    });
  });
}

export async function fetchCurrentScope(): Promise<GetCurrentScopeResponse | null> {
  const tabId = await getActiveSnTabId();
  if (!tabId) return null;
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: 'SCRIPT_RUNNER_GET_SCOPE' }, (res: GetCurrentScopeResponse | undefined) => {
      if (chrome.runtime.lastError) { resolve(null); return; }
      resolve(res ?? null);
    });
  });
}

export async function runScript(script: string): Promise<RunScriptResponse> {
  const tabId = await getActiveSnTabId();
  if (!tabId) {
    return {
      ok: false,
      error: 'No active ServiceNow tab. Open a ServiceNow page in this window and try again.',
    };
  }
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(
      tabId,
      { type: 'SCRIPT_RUNNER_EXECUTE', script },
      (res: RunScriptResponse | undefined) => {
        if (chrome.runtime.lastError) {
          resolve({
            ok: false,
            error: `Could not reach the content script: ${chrome.runtime.lastError.message}`,
          });
          return;
        }
        resolve(res ?? { ok: false, error: 'No response from content script' });
      }
    );
  });
}
