import { ServiceNowApiClient, type AuthCredentials } from '@nowforge/core';

/**
 * VS Code-side ServiceNow REST client. Wraps @nowforge/core's client for
 * Table API operations and adds:
 *   - `pingInstance` for connection-test
 *   - `runBackgroundScript` for the Run Script command
 *
 * Node 18+ ships `fetch` globally so core's client (fetch-based) works here.
 */
export class VsCodeServiceNowClient extends ServiceNowApiClient {
  /** Stored alongside the parent so background-script POST can reuse them. */
  private readonly _baseUrl: string;
  private readonly _authHeader: string;

  constructor(instanceUrl: string, auth: AuthCredentials) {
    super({ instanceUrl, auth });
    this._baseUrl = instanceUrl.replace(/\/$/, '');
    this._authHeader = 'Basic ' + Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
  }

  get baseUrl(): string { return this._baseUrl; }

  /** GET sys_properties to validate auth + reachability. */
  async pingInstance(): Promise<{ ok: true } | { ok: false; status: number; body: string }> {
    try {
      await this.getRecords('sys_properties', {
        query: 'name=instance_name',
        fields: ['name', 'value'],
        limit: 1,
      });
      return { ok: true };
    } catch (err) {
      const e = err as { status?: number; body?: string; message?: string };
      return {
        ok: false,
        status: e.status ?? 0,
        body: e.body ?? e.message ?? 'unknown error',
      };
    }
  }

  /**
   * Run a script via /sys.scripts.do. We have to fetch the page once to grab
   * the CSRF token, then POST the form. Output is in <PRE> blocks.
   */
  async runBackgroundScript(script: string): Promise<{ ok: boolean; output: string; error?: string }> {
    // 1. Get CSRF token
    const pageRes = await fetch(`${this._baseUrl}/sys.scripts.do`, {
      method: 'GET',
      headers: { Authorization: this._authHeader, Accept: 'text/html' },
    });
    if (!pageRes.ok) {
      return { ok: false, output: '', error: `Failed to fetch /sys.scripts.do: HTTP ${pageRes.status}` };
    }
    const pageHtml = await pageRes.text();
    const ckMatch =
      pageHtml.match(/name="sysparm_ck"[^>]*value="([a-f0-9]+)"/i) ||
      pageHtml.match(/g_ck\s*=\s*['"]([a-f0-9]+)['"]/i);
    if (!ckMatch) {
      return { ok: false, output: '', error: 'CSRF token (sysparm_ck) not found on /sys.scripts.do.' };
    }
    const ck = ckMatch[1];

    // 2. POST the form
    const body = new URLSearchParams();
    body.append('script', script);
    body.append('sysparm_ck', ck);
    body.append('runscript', 'Run script');
    body.append('quota_managed_transaction', 'on');
    body.append('sys_scope', '');

    const runRes = await fetch(`${this._baseUrl}/sys.scripts.do`, {
      method: 'POST',
      headers: {
        Authorization: this._authHeader,
        Accept: 'text/html',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });
    if (!runRes.ok) {
      return { ok: false, output: '', error: `HTTP ${runRes.status}` };
    }
    const html = await runRes.text();

    // 3. Parse <PRE>...</PRE> blocks
    const blocks: string[] = [];
    const re = /<pre[^>]*>([\s\S]*?)<\/pre>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      blocks.push(decodeEntities(m[1]).trimEnd());
    }
    return { ok: true, output: blocks.length ? blocks.join('\n').trim() : '(no output)' };
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}
