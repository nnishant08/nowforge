import type { InstanceInfo } from '@nowforge/core';
import type { NavVisit } from './navigation.js';

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

export interface RunScriptMessage {
  type: 'SCRIPT_RUNNER_EXECUTE';
  script: string;
}

export interface RunScriptResponse {
  ok: boolean;
  output?: string;
  executionTimeMs?: number;
  error?: string;
}

export interface GetCurrentScopeMessage {
  type: 'SCRIPT_RUNNER_GET_SCOPE';
}

export interface GetCurrentScopeResponse {
  scope: string | null;
  appName: string | null;
  appSysId: string | null;
}

// ── Update Set Dashboard messages ───────────────────────────────────────────

export interface UpdateSetSummary {
  sysId: string;
  name: string;
  /** Raw state value (e.g. "in progress", "complete"). */
  state: string;
  /** Display label of the state. */
  stateLabel: string;
  /** Display name of the application (e.g. "Global", "My App"). */
  appName: string;
  /** sys_id of the linked sys_scope. */
  appSysId: string;
  isDefault: boolean;
  changeCount: number;
}

export interface UpdateSetRecent {
  sysId: string;
  name: string;
  appName: string;
  changeCount: number;
}

export interface UpdateXmlEntry {
  sysId: string;
  name: string;
  type: string;
  targetName: string;
  action: string;
}

export interface UpdateSetGetCurrentMessage { type: 'UPDATE_SET_GET_CURRENT'; }
export interface UpdateSetGetCurrentResponse {
  ok: boolean;
  current: UpdateSetSummary | null;
  error?: string;
}

export interface UpdateSetGetRecentMessage { type: 'UPDATE_SET_GET_RECENT'; }
export interface UpdateSetGetRecentResponse {
  ok: boolean;
  recent: UpdateSetRecent[];
  error?: string;
}

export interface UpdateSetGetContentsMessage { type: 'UPDATE_SET_GET_CONTENTS'; sysId: string; }
export interface UpdateSetGetContentsResponse {
  ok: boolean;
  entries: UpdateXmlEntry[];
  error?: string;
}

export interface UpdateSetSwitchMessage { type: 'UPDATE_SET_SWITCH'; sysId: string; }
export interface UpdateSetSwitchResponse { ok: boolean; error?: string; }

export interface UpdateSetCreateMessage {
  type: 'UPDATE_SET_CREATE';
  name: string;
  appSysId: string;
}
export interface UpdateSetCreateResponse {
  ok: boolean;
  sysId?: string;
  error?: string;
}

// ── Smart Navigation messages ───────────────────────────────────────────────

export interface NavRecordVisitedMessage {
  type: 'NAV_RECORD_VISITED';
  visit: NavVisit;
}

/**
 * Broadcast by the background after every history mutation, so extension
 * pages (side panel, popup) can refresh their views without polling.
 */
export interface NavHistoryChangedMessage {
  type: 'NAV_HISTORY_CHANGED';
  instanceName: string;
}

// ── UI Builder Companion messages ───────────────────────────────────────────

export interface UibComponentNode {
  /** Stable id we generate; used for click→tree selection. */
  id: string;
  /** Tag name, lowercased. */
  tag: string;
  /** Friendly display name (UIB config name if available, otherwise tag). */
  displayName: string;
  /** Brief preview of content/binding (e.g. heading text, list table name). */
  preview?: string;
  /** True if children may exist but are inside a closed shadow root we can't read. */
  isClosedShadowHost?: boolean;
  children: UibComponentNode[];
}

export interface UibProperty {
  name: string;
  /** "attribute" | "property" — DOM attribute vs JS property. */
  source: 'attribute' | 'property';
  /** JSON-stringified value (truncated for huge values). */
  value: string;
  /** True when this property is a data binding (e.g. starts with @). */
  isBinding?: boolean;
}

export interface UibEventHandler {
  event: string;
  /** "(none)" if no handler, otherwise a brief description. */
  detail: string;
}

export interface UibComponentDetail {
  id: string;
  tag: string;
  displayName: string;
  description?: string;
  version?: string;
  properties: UibProperty[];
  bindings: UibProperty[];
  eventHandlers: UibEventHandler[];
}

export interface UibClientState {
  /** Whatever the bridge could read from window.__STORE__ etc. JSON-stringified. */
  json: string | null;
  /** Where this came from: "store", "uib", "fallback", "unavailable". */
  source: 'store' | 'uib' | 'fallback' | 'unavailable';
  /** Best-effort error message when source is "unavailable". */
  error?: string;
}

export interface UibEvent {
  /** Local time ms. */
  timestamp: number;
  type: string;
  /** Color tone: data | render | state | user | error. */
  tone: 'data' | 'render' | 'state' | 'user' | 'error';
  /** Source component tag/id if known. */
  source: string;
  detail: string;
}

// Side panel → content
export interface UibGetTreeMessage { type: 'UIB_GET_TREE'; }
export interface UibGetTreeResponse {
  ok: boolean;
  inUib: boolean;
  pageTitle: string | null;
  tree: UibComponentNode | null;
  /** Diagnostic shown when ok=false or inUib=false. */
  reason?: string;
}

export interface UibGetComponentMessage { type: 'UIB_GET_COMPONENT'; id: string; }
export interface UibGetComponentResponse {
  ok: boolean;
  detail: UibComponentDetail | null;
  reason?: string;
}

export interface UibGetStateMessage { type: 'UIB_GET_STATE'; }
export interface UibGetStateResponse {
  ok: boolean;
  state: UibClientState;
}

export interface UibHighlightMessage {
  type: 'UIB_HIGHLIGHT';
  /** Pass null to clear. */
  id: string | null;
}
export interface UibHighlightResponse { ok: boolean; }

export interface UibStartEventCaptureMessage { type: 'UIB_START_EVENT_CAPTURE'; }
export interface UibStopEventCaptureMessage { type: 'UIB_STOP_EVENT_CAPTURE'; }

// Content → side panel (broadcast for live updates)
export interface UibEventBatchMessage {
  type: 'UIB_EVENT_BATCH';
  events: UibEvent[];
}

export interface UibComponentSelectedMessage {
  type: 'UIB_COMPONENT_SELECTED';
  id: string;
}

// ── Flow Designer Inspector ─────────────────────────────────────────────────

export interface FlowInfo {
  sysId: string;
  name: string;
  internalName: string;
  status: string;
  description: string;
  /** sys_class_name — distinguishes flow / subflow / action. */
  sysClassName: string;
  /** Display value of the trigger type, e.g. "Record Updated". */
  triggerType: string;
  /** Display value of the table the flow runs on, if known. */
  triggerTable: string;
  /** ms epoch */
  updatedOn: number;
}

export interface FlowExecution {
  sysId: string;
  /** Raw state value, e.g. "FINISHED", "ERROR", "WAITING". */
  state: string;
  /** Display label of the state. */
  stateLabel: string;
  /** ms epoch */
  startedAt: number;
  /** ms epoch, 0 if still running */
  endedAt: number;
  /** ms */
  durationMs: number;
  /** Human-readable trigger info (e.g. "INC0010001"). */
  triggerDisplay: string;
  errorMessage: string;
}

export interface FlowStep {
  sysId: string;
  /** order field if available (lexicographic-comparable). */
  order: string;
  name: string;
  /** flow_element_type: "trigger" | "if" | "action" | "subflow" | "end". */
  elementType: string;
  state: string;
  stateLabel: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  /** JSON-stringified inputs/outputs from the log row. */
  inputsJson: string;
  outputsJson: string;
  errorMessage: string;
}

// Side panel → content
export interface FlowGetInfoMessage { type: 'FLOW_GET_INFO'; flowSysId: string; }
export interface FlowGetInfoResponse {
  ok: boolean;
  info: FlowInfo | null;
  error?: string;
}

export interface FlowGetExecutionsMessage {
  type: 'FLOW_GET_EXECUTIONS';
  flowSysId: string;
  limit?: number;
  offset?: number;
}
export interface FlowGetExecutionsResponse {
  ok: boolean;
  executions: FlowExecution[];
  totalAvailable: number;
  error?: string;
}

export interface FlowGetStepsMessage { type: 'FLOW_GET_STEPS'; contextSysId: string; }
export interface FlowGetStepsResponse {
  ok: boolean;
  steps: FlowStep[];
  /** Surfaced when sys_flow_log isn't accessible — UI shows a guide message. */
  permissionsHint?: boolean;
  error?: string;
}

export interface FlowRunTestMessage {
  type: 'FLOW_RUN_TEST';
  flowSysId: string;
  triggerRecordSysId: string;
  triggerTable: string;
  inputs: Array<{ key: string; value: string }>;
}
export interface FlowRunTestResponse {
  ok: boolean;
  /** sys_id of the new sys_flow_context if the trigger took. */
  contextSysId?: string;
  /** Best-effort: if we couldn't actually run, send users to the SN test panel. */
  fallbackUrl?: string;
  error?: string;
}

// ── Script Actions / side-panel control ─────────────────────────────────────

export interface OpenSidePanelMessage { type: 'OPEN_SIDE_PANEL'; }
export interface OpenSidePanelResponse { ok: boolean; error?: string; }

export type ExtensionMessage =
  | ContentScriptReadyMessage
  | PageContextUpdatedMessage
  | GetPageContextMessage
  | RunScriptMessage
  | GetCurrentScopeMessage
  | UpdateSetGetCurrentMessage
  | UpdateSetGetRecentMessage
  | UpdateSetGetContentsMessage
  | UpdateSetSwitchMessage
  | UpdateSetCreateMessage
  | NavRecordVisitedMessage
  | NavHistoryChangedMessage
  | UibGetTreeMessage
  | UibGetComponentMessage
  | UibGetStateMessage
  | UibHighlightMessage
  | UibStartEventCaptureMessage
  | UibStopEventCaptureMessage
  | UibEventBatchMessage
  | UibComponentSelectedMessage
  | FlowGetInfoMessage
  | FlowGetExecutionsMessage
  | FlowGetStepsMessage
  | FlowRunTestMessage
  | OpenSidePanelMessage;

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
