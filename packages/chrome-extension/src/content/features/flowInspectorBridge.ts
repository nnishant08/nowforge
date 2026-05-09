import type {
  FlowInfo,
  FlowExecution,
  FlowStep,
  FlowGetInfoResponse,
  FlowGetExecutionsResponse,
  FlowGetStepsResponse,
  FlowRunTestResponse,
} from '../../shared/messaging.js';

/**
 * Bridge that proxies Flow Designer REST calls from the side panel
 * (which runs at chrome-extension://) so cookies are inherited automatically
 * via the SN page's session.
 *
 * REST endpoints used:
 *   - sys_hub_flow                ← flow metadata
 *   - sys_flow_context            ← execution contexts
 *   - sys_flow_log                ← per-step records (may be ACL-restricted)
 *   - sys_flow_context_log        ← fallback if sys_flow_log denies
 */

interface BaseEnvelope<T> { result?: T; }
interface DvField { value: string; display_value: string; }
type DvRow = Record<string, DvField>;

async function getJson<T>(url: string): Promise<{ status: number; body: T | null }> {
  try {
    const res = await fetch(url, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return { status: res.status, body: null };
    return { status: res.status, body: (await res.json()) as T };
  } catch {
    return { status: 0, body: null };
  }
}

async function postJson<T>(url: string, body: unknown): Promise<{ status: number; body: T | null }> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return { status: res.status, body: null };
    return { status: res.status, body: (await res.json()) as T };
  } catch {
    return { status: 0, body: null };
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function v(row: DvRow | undefined, key: string): string {
  return row?.[key]?.value ?? '';
}
function dv(row: DvRow | undefined, key: string): string {
  return row?.[key]?.display_value ?? '';
}
function ts(s: string): number {
  if (!s) return 0;
  // SN ISO format: "2026-01-23 14:55:32" — parsed in local TZ
  const ms = Date.parse(s.replace(' ', 'T') + 'Z');
  return Number.isNaN(ms) ? 0 : ms;
}

// ── Flow info ──────────────────────────────────────────────────────────────

async function handleGetInfo(flowSysId: string): Promise<FlowGetInfoResponse> {
  const url =
    `/api/now/table/sys_hub_flow/${flowSysId}` +
    `?sysparm_fields=sys_id,name,internal_name,sys_class_name,active,description,` +
    `sys_updated_on,trigger_type,table_name` +
    `&sysparm_display_value=all`;
  const { status, body } = await getJson<BaseEnvelope<DvRow>>(url);
  if (!body?.result) {
    return {
      ok: false,
      info: null,
      error: status === 404
        ? 'Flow not found. Check the URL.'
        : `Failed to load flow (HTTP ${status}).`,
    };
  }
  const r = body.result;
  const info: FlowInfo = {
    sysId: v(r, 'sys_id'),
    name: v(r, 'name'),
    internalName: v(r, 'internal_name'),
    status: v(r, 'active') === 'true' ? 'Active' : 'Inactive',
    description: v(r, 'description'),
    sysClassName: v(r, 'sys_class_name'),
    triggerType: dv(r, 'trigger_type') || v(r, 'trigger_type'),
    triggerTable: dv(r, 'table_name') || v(r, 'table_name'),
    updatedOn: ts(v(r, 'sys_updated_on')),
  };
  return { ok: true, info };
}

// ── Recent executions ──────────────────────────────────────────────────────

async function handleGetExecutions(
  flowSysId: string,
  limit = 10,
  offset = 0
): Promise<FlowGetExecutionsResponse> {
  const url =
    `/api/now/table/sys_flow_context` +
    `?sysparm_query=flow=${flowSysId}^ORDERBYDESCsys_created_on` +
    `&sysparm_fields=sys_id,state,started,ended,duration,error_message,` +
    `trigger_record,trigger_table,sys_created_on` +
    `&sysparm_display_value=all` +
    `&sysparm_limit=${limit}&sysparm_offset=${offset}`;
  const { status, body } = await getJson<BaseEnvelope<DvRow[]>>(url);
  if (!body?.result) {
    return {
      ok: false,
      executions: [],
      totalAvailable: 0,
      error: `Failed to load executions (HTTP ${status}).`,
    };
  }
  const executions: FlowExecution[] = body.result.map((r) => {
    const startedAt = ts(v(r, 'started') || v(r, 'sys_created_on'));
    const endedAt = ts(v(r, 'ended'));
    const durRaw = v(r, 'duration');
    const durationMs = durRaw ? Number(durRaw) : (endedAt && startedAt ? endedAt - startedAt : 0);
    return {
      sysId: v(r, 'sys_id'),
      state: v(r, 'state'),
      stateLabel: dv(r, 'state') || v(r, 'state'),
      startedAt,
      endedAt,
      durationMs,
      triggerDisplay: dv(r, 'trigger_record') || v(r, 'trigger_record') || '',
      errorMessage: v(r, 'error_message'),
    };
  });

  // Best-effort total count
  const stats = await getJson<{ result?: { stats?: { count?: string } } }>(
    `/api/now/stats/sys_flow_context?sysparm_query=flow=${flowSysId}&sysparm_count=true`
  );
  const totalAvailable = Number(stats.body?.result?.stats?.count ?? executions.length);
  return { ok: true, executions, totalAvailable };
}

// ── Steps for a single execution ───────────────────────────────────────────

async function fetchSteps(table: string, contextSysId: string): Promise<{ status: number; rows: DvRow[] | null }> {
  const url =
    `/api/now/table/${table}` +
    `?sysparm_query=context=${contextSysId}^ORDERBYsys_created_on` +
    `&sysparm_fields=sys_id,name,state,started,ended,inputs,outputs,error_message,` +
    `flow_element_type,order,sys_created_on` +
    `&sysparm_display_value=all` +
    `&sysparm_limit=200`;
  const { status, body } = await getJson<BaseEnvelope<DvRow[]>>(url);
  return { status, rows: body?.result ?? null };
}

async function handleGetSteps(contextSysId: string): Promise<FlowGetStepsResponse> {
  // Try sys_flow_log first
  let { status, rows } = await fetchSteps('sys_flow_log', contextSysId);

  // 401/403 → permissions issue; some platforms restrict. Try the alternate.
  if ((status === 401 || status === 403) && rows === null) {
    const alt = await fetchSteps('sys_flow_context_log', contextSysId);
    status = alt.status;
    rows = alt.rows;
  }

  if (!rows) {
    if (status === 401 || status === 403) {
      return {
        ok: false,
        steps: [],
        permissionsHint: true,
        error:
          'Flow execution data requires admin access. Ensure the Table API ACL allows reading sys_flow_log.',
      };
    }
    return {
      ok: false,
      steps: [],
      error: `Failed to load steps (HTTP ${status}).`,
    };
  }

  const steps: FlowStep[] = rows.map((r) => {
    const startedAt = ts(v(r, 'started') || v(r, 'sys_created_on'));
    const endedAt = ts(v(r, 'ended'));
    return {
      sysId: v(r, 'sys_id'),
      order: v(r, 'order'),
      name: v(r, 'name'),
      elementType: v(r, 'flow_element_type'),
      state: v(r, 'state'),
      stateLabel: dv(r, 'state') || v(r, 'state'),
      startedAt,
      endedAt,
      durationMs: endedAt && startedAt ? endedAt - startedAt : 0,
      inputsJson: v(r, 'inputs'),
      outputsJson: v(r, 'outputs'),
      errorMessage: v(r, 'error_message'),
    };
  });

  // Sort by `order` (string comparison) then by start time
  steps.sort((a, b) => {
    if (a.order && b.order && a.order !== b.order) return a.order.localeCompare(b.order);
    return a.startedAt - b.startedAt;
  });

  return { ok: true, steps };
}

// ── Test launcher ──────────────────────────────────────────────────────────

async function handleRunTest(
  flowSysId: string,
  triggerRecordSysId: string,
  triggerTable: string,
  inputs: Array<{ key: string; value: string }>
): Promise<FlowRunTestResponse> {
  // The cleanest "test from anywhere" route on most instances is the Flow
  // Designer test endpoint: /api/sn_flow_designer/v1/run/{sys_id}. It's
  // undocumented and varies by version, so we try it first then fall back.
  const inputsObj: Record<string, string> = {};
  for (const { key, value } of inputs) {
    if (key.trim()) inputsObj[key.trim()] = value;
  }
  if (triggerRecordSysId) {
    inputsObj['trigger_record'] = triggerRecordSysId;
    if (triggerTable) inputsObj['trigger_table'] = triggerTable;
  }

  // Attempt 1: undocumented test runner
  const r1 = await postJson<{ result?: { context?: { sys_id?: string } } }>(
    `/api/sn_flow_designer/v1/run/${flowSysId}`,
    { inputs: inputsObj }
  );
  if (r1.body?.result?.context?.sys_id) {
    return { ok: true, contextSysId: r1.body.result.context.sys_id };
  }

  // Attempt 2: directly create a sys_flow_context. Whether the platform picks
  // it up and runs depends on the trigger configuration — it usually doesn't,
  // so we surface a fallback URL.
  const r2 = await postJson<BaseEnvelope<{ sys_id?: string }>>(
    '/api/now/table/sys_flow_context',
    {
      flow: flowSysId,
      state: 'WAITING',
      trigger_record: triggerRecordSysId || '',
      trigger_table: triggerTable || '',
    }
  );

  const fallbackUrl = `/$flow-designer.do#/flow/${flowSysId}/test`;
  if (r2.body?.result?.sys_id) {
    return {
      ok: true,
      contextSysId: r2.body.result.sys_id,
      fallbackUrl,
      error: 'Created context, but the platform may not auto-run it. Use the test panel link if nothing appears.',
    };
  }

  return {
    ok: false,
    fallbackUrl,
    error: 'Could not start a test from REST. Use the Flow Designer test panel instead.',
  };
}

// ── Wire-up ────────────────────────────────────────────────────────────────

interface IncomingMessage {
  type?: string;
  flowSysId?: string;
  contextSysId?: string;
  triggerRecordSysId?: string;
  triggerTable?: string;
  inputs?: Array<{ key: string; value: string }>;
  limit?: number;
  offset?: number;
}

export function initFlowInspectorBridge(): void {
  chrome.runtime.onMessage.addListener((message: IncomingMessage, _sender, sendResponse) => {
    switch (message.type) {
      case 'FLOW_GET_INFO':
        if (typeof message.flowSysId !== 'string') {
          sendResponse({ ok: false, info: null, error: 'flowSysId required' });
          return false;
        }
        void handleGetInfo(message.flowSysId).then(sendResponse);
        return true;
      case 'FLOW_GET_EXECUTIONS':
        if (typeof message.flowSysId !== 'string') {
          sendResponse({ ok: false, executions: [], totalAvailable: 0, error: 'flowSysId required' });
          return false;
        }
        void handleGetExecutions(message.flowSysId, message.limit, message.offset).then(sendResponse);
        return true;
      case 'FLOW_GET_STEPS':
        if (typeof message.contextSysId !== 'string') {
          sendResponse({ ok: false, steps: [], error: 'contextSysId required' });
          return false;
        }
        void handleGetSteps(message.contextSysId).then(sendResponse);
        return true;
      case 'FLOW_RUN_TEST':
        if (typeof message.flowSysId !== 'string') {
          sendResponse({ ok: false, error: 'flowSysId required' });
          return false;
        }
        void handleRunTest(
          message.flowSysId,
          message.triggerRecordSysId ?? '',
          message.triggerTable ?? '',
          message.inputs ?? []
        ).then(sendResponse);
        return true;
    }
    return false;
  });
}
