import type {
  FlowGetInfoResponse,
  FlowGetExecutionsResponse,
  FlowGetStepsResponse,
  FlowRunTestResponse,
} from '../../../shared/messaging.js';

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

export async function getActiveTabUrl(): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      resolve(tabs[0]?.url ?? null);
    });
  });
}

export async function getActiveTabBaseUrl(): Promise<string | null> {
  const url = await getActiveTabUrl();
  if (!url) return null;
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch { return null; }
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

export const getFlowInfo = (flowSysId: string): Promise<FlowGetInfoResponse> =>
  send<FlowGetInfoResponse>(
    { type: 'FLOW_GET_INFO', flowSysId },
    { ok: false, info: null, error: 'No active ServiceNow tab.' }
  );

export const getExecutions = (
  flowSysId: string,
  limit = 10,
  offset = 0
): Promise<FlowGetExecutionsResponse> =>
  send<FlowGetExecutionsResponse>(
    { type: 'FLOW_GET_EXECUTIONS', flowSysId, limit, offset },
    { ok: false, executions: [], totalAvailable: 0, error: 'No active ServiceNow tab.' }
  );

export const getSteps = (contextSysId: string): Promise<FlowGetStepsResponse> =>
  send<FlowGetStepsResponse>(
    { type: 'FLOW_GET_STEPS', contextSysId },
    { ok: false, steps: [], error: 'No active ServiceNow tab.' }
  );

export const runTest = (
  flowSysId: string,
  triggerRecordSysId: string,
  triggerTable: string,
  inputs: Array<{ key: string; value: string }>
): Promise<FlowRunTestResponse> =>
  send<FlowRunTestResponse>(
    { type: 'FLOW_RUN_TEST', flowSysId, triggerRecordSysId, triggerTable, inputs },
    { ok: false, error: 'No active ServiceNow tab.' }
  );
