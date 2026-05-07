export interface ParsedServiceNowUrl {
  instanceName: string | null;
  tableName: string | null;
  sysId: string | null;
  view: string | null;
  encodedQuery: string | null;
  rawUrl: string;
}

/**
 * Decode a percent-encoded URL component, replacing %3D with = etc.
 * Returns the input unchanged if decoding fails.
 */
function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return value;
  }
}

/**
 * Extract the table name from a ServiceNow record URL path segment like
 * "incident.do", "incident_list.do", or "incident.do%3Fsys_id%3Dabc"
 */
function extractTableFromPath(path: string): string | null {
  const decoded = safeDecode(path);
  const match = decoded.match(/\/?([a-z_]+?)(?:_list)?\.do/i);
  return match ? match[1] : null;
}

/**
 * Parse a classic ServiceNow URL.
 * Handles patterns like:
 *   https://instance.service-now.com/incident.do?sys_id=abc123&sysparm_view=ess
 *   https://instance.service-now.com/nav_to.do?uri=incident.do?sys_id=abc123
 */
function parseClassicUrl(parsed: URL): Partial<ParsedServiceNowUrl> {
  const path = parsed.pathname;

  // nav_to.do pattern — uri param contains the real target
  if (path.includes('nav_to.do')) {
    const uri = parsed.searchParams.get('uri');
    if (uri) {
      const decoded = safeDecode(uri);
      const innerUrl = new URL(decoded, parsed.origin);
      return parseClassicUrl(innerUrl);
    }
    return {};
  }

  const tableName = extractTableFromPath(path);
  const sysId = parsed.searchParams.get('sys_id');
  const view = parsed.searchParams.get('sysparm_view');
  const encodedQuery = parsed.searchParams.get('sysparm_query');

  return { tableName, sysId, view, encodedQuery };
}

/**
 * Parse a workspace/Next Experience URL.
 * Handles patterns like:
 *   /now/nav/ui/classic/params/target/incident.do%3Fsys_id%3Dabc123
 *   /now/workspace/agent/record/incident/abc123
 */
function parseWorkspaceUrl(parsed: URL): Partial<ParsedServiceNowUrl> {
  const path = parsed.pathname;

  // Classic params embedded in Next UX URL
  const classicParamsMatch = path.match(/\/params\/target\/(.+)/);
  if (classicParamsMatch) {
    const target = safeDecode(classicParamsMatch[1]);
    try {
      const innerUrl = new URL(target, parsed.origin);
      return parseClassicUrl(innerUrl);
    } catch {
      const tableName = extractTableFromPath(target);
      const inner = target.includes('?') ? new URLSearchParams(target.split('?')[1]) : null;
      return {
        tableName,
        sysId: inner?.get('sys_id') ?? null,
        view: inner?.get('sysparm_view') ?? null,
        encodedQuery: inner?.get('sysparm_query') ?? null,
      };
    }
  }

  // /now/workspace/agent/record/{table}/{sys_id}
  const recordMatch = path.match(/\/record\/([a-z_]+)\/([a-f0-9]{32})/i);
  if (recordMatch) {
    return { tableName: recordMatch[1], sysId: recordMatch[2] };
  }

  return {};
}

/**
 * Parse any ServiceNow URL and return structured information.
 */
export function parseServiceNowUrl(url: string): ParsedServiceNowUrl {
  const base: ParsedServiceNowUrl = {
    instanceName: null,
    tableName: null,
    sysId: null,
    view: null,
    encodedQuery: null,
    rawUrl: url,
  };

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return base;
  }

  const host = parsed.hostname.toLowerCase();
  if (host.endsWith('.service-now.com')) {
    base.instanceName = host.replace('.service-now.com', '');
  }

  const path = parsed.pathname;
  const partial =
    path.includes('/now/') ? parseWorkspaceUrl(parsed) : parseClassicUrl(parsed);

  return { ...base, ...partial };
}

/**
 * Extract a sys_id from a URL if present.
 */
export function extractSysIdFromUrl(url: string): string | null {
  return parseServiceNowUrl(url).sysId;
}

/**
 * Extract a table name from a URL if present.
 */
export function extractTableFromUrl(url: string): string | null {
  return parseServiceNowUrl(url).tableName;
}

/**
 * Build a direct record URL for a given instance, table, and sys_id.
 */
export function buildRecordUrl(instanceUrl: string, table: string, sysId: string): string {
  const base = instanceUrl.replace(/\/$/, '');
  return `${base}/${table}.do?sys_id=${sysId}`;
}
