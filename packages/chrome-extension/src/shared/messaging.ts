import type { InstanceInfo } from '@nowforge/core';

export type PageType =
  | 'form'
  | 'list'
  | 'ui-builder'
  | 'flow-designer'
  | 'service-portal'
  | 'workspace'
  | 'other';

export interface PageContext {
  instanceInfo: InstanceInfo | null;
  pageType: PageType;
  tableName: string | null;
  sysId: string | null;
  url: string;
  title: string;
}

// ── Message types ────────────────────────────────────────────────────────────

export interface ContentScriptReadyMessage {
  type: 'CONTENT_SCRIPT_READY';
  tabId?: number;
  context: PageContext;
}

export interface PageContextUpdatedMessage {
  type: 'PAGE_CONTEXT_UPDATED';
  tabId?: number;
  context: PageContext;
}

export interface GetPageContextMessage {
  type: 'GET_PAGE_CONTEXT';
}

export interface GetPageContextResponse {
  context: PageContext | null;
}

export type ExtensionMessage =
  | ContentScriptReadyMessage
  | PageContextUpdatedMessage
  | GetPageContextMessage;

/** Send a typed message to the background service worker. */
export function sendToBackground(message: ExtensionMessage): void {
  chrome.runtime.sendMessage(message).catch(() => {
    // Background may not be ready yet — ignore
  });
}

/** Send a typed message to a specific tab's content script. */
export function sendToTab(tabId: number, message: ExtensionMessage): void {
  chrome.tabs.sendMessage(tabId, message).catch(() => {
    // Tab may not have content script — ignore
  });
}
