import type {
  RunScriptResponse,
  GetCurrentScopeResponse,
} from '../../shared/messaging.js';

/**
 * Handles SCRIPT_RUNNER_* messages from the side panel.
 *
 * The content script is the right place for this because it inherits the
 * user's ServiceNow session — the side panel runs from chrome-extension://
 * and would need separate cookie handling.
 *
 * Execution path: POST to /sys.scripts.do with the script + sysparm_ck CSRF
 * token. The HTML response contains the script output inside <PRE> blocks.
 */

// ── CSRF token extraction ────────────────────────────────────────────────────

function extractSysparmCk(): string | null {
  // 1. Hidden form input — present on most classic UI pages
  const input = document.querySelector<HTMLInputElement>('input[name="sysparm_ck"]');
  if (input?.value) return input.value;

  // 2. Inline script: var g_ck = "..." or window.g_ck = "..."
  for (const script of document.querySelectorAll('script')) {
    const src = script.textContent ?? '';
    const m = src.match(/g_ck\s*=\s*['"]([a-f0-9]{30,})['"]/i);
    if (m) return m[1];
  }

  // 3. Recurse into same-origin iframes (Next UX wraps classic UI in frames)
  for (const frame of document.querySelectorAll('iframe')) {
    try {
      const doc = frame.contentDocument;
      if (!doc) continue;
      const fInput = doc.querySelector<HTMLInputElement>('input[name="sysparm_ck"]');
      if (fInput?.value) return fInput.value;
      for (const script of doc.querySelectorAll('script')) {
        const src = script.textContent ?? '';
        const m = src.match(/g_ck\s*=\s*['"]([a-f0-9]{30,})['"]/i);
        if (m) return m[1];
      }
    } catch { /* cross-origin iframe — skip */ }
  }

  return null;
}

// ── HTML output parsing ──────────────────────────────────────────────────────

function decodeHtmlEntities(s: string): string {
  const txt = document.createElement('textarea');
  txt.innerHTML = s;
  return txt.value;
}

function parseScriptOutput(html: string): string {
  const blocks: string[] = [];
  const re = /<pre[^>]*>([\s\S]*?)<\/pre>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    blocks.push(decodeHtmlEntities(m[1]).trimEnd());
  }
  if (blocks.length === 0) {
    // No <PRE> blocks — script may not have produced output, or the response
    // was an error page. Look for an error banner.
    const err = html.match(/<div[^>]*class="[^"]*notification[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    if (err) return decodeHtmlEntities(err[1]).replace(/<[^>]+>/g, '').trim();
    return '(no output)';
  }
  return blocks.join('\n').trim();
}

// ── Execute ──────────────────────────────────────────────────────────────────

async function executeScript(script: string): Promise<RunScriptResponse> {
  const startTime = Date.now();

  const ck = extractSysparmCk();
  if (!ck) {
    return {
      ok: false,
      error: 'Session token not found. Refresh the ServiceNow page and try again.',
    };
  }

  const fd = new FormData();
  fd.append('script', script);
  fd.append('sysparm_ck', ck);
  fd.append('runscript', 'Run script');
  fd.append('quota_managed_transaction', 'on');
  // sys_scope is required on some instances — leave blank for current scope
  fd.append('sys_scope', '');

  let response: Response;
  try {
    response = await fetch('/sys.scripts.do', {
      method: 'POST',
      body: fd,
      credentials: 'include',
    });
  } catch (e) {
    return { ok: false, error: `Network error: ${(e as Error).message}` };
  }

  if (response.status === 401 || response.status === 403) {
    return {
      ok: false,
      error: `${response.status} ${response.statusText} — session expired or you lack permissions for sys.scripts.do.`,
    };
  }
  if (!response.ok) {
    return { ok: false, error: `HTTP ${response.status} ${response.statusText}` };
  }

  const html = await response.text();
  const output = parseScriptOutput(html);
  const executionTimeMs = Date.now() - startTime;

  return { ok: true, output, executionTimeMs };
}

// ── Scope discovery ──────────────────────────────────────────────────────────

interface ScopePickerResponse {
  result?: {
    current?: { name?: string; scope?: string; sys_id?: string };
  };
}

async function getCurrentScope(): Promise<GetCurrentScopeResponse> {
  try {
    const res = await fetch('/api/now/ui/concoursepicker/application', {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return { scope: null, appName: null, appSysId: null };
    const data = (await res.json()) as ScopePickerResponse;
    const cur = data.result?.current;
    return {
      scope: cur?.scope ?? null,
      appName: cur?.name ?? null,
      appSysId: cur?.sys_id ?? null,
    };
  } catch {
    return { scope: null, appName: null, appSysId: null };
  }
}

// ── Wire up ──────────────────────────────────────────────────────────────────

export function initScriptRunnerBridge(): void {
  chrome.runtime.onMessage.addListener((message: { type?: string; script?: string }, _sender, sendResponse) => {
    if (message.type === 'SCRIPT_RUNNER_EXECUTE' && typeof message.script === 'string') {
      void executeScript(message.script).then(sendResponse);
      return true; // async sendResponse
    }
    if (message.type === 'SCRIPT_RUNNER_GET_SCOPE') {
      void getCurrentScope().then(sendResponse);
      return true;
    }
    return false;
  });
}
