/**
 * Each synced file carries a single-line metadata comment at the top:
 *
 *   // NowForge: {"table":"sys_script","sys_id":"...","field":"script", ...}
 *
 * That comment is how we map a file back to its source record. We strip
 * it before pushing and re-add it after pulling.
 */

export interface NowForgeMetadata {
  table: string;
  sys_id: string;
  field: string;
  /** ISO yyyy-MM-dd HH:mm:ss as returned by ServiceNow. */
  updated_on: string;
  scope: string;
  name: string;
  /** Filename within a multi-file record's folder (e.g. "client.js" for widgets). */
  filename: string;
  /** Instance name this file was pulled from. */
  instance: string;
}

const HEADER_PREFIX = '// NowForge: ';

export function buildHeaderComment(meta: NowForgeMetadata): string {
  return HEADER_PREFIX + JSON.stringify(meta);
}

/**
 * If `content` starts with a NowForge header line, parse and return the metadata
 * plus the body without the header. Otherwise returns null.
 */
export function readHeader(content: string): { meta: NowForgeMetadata; body: string } | null {
  // Look at the first line only — must start with `// NowForge: `.
  const newlineIdx = content.indexOf('\n');
  const firstLine = newlineIdx >= 0 ? content.slice(0, newlineIdx) : content;
  if (!firstLine.startsWith(HEADER_PREFIX)) return null;

  const json = firstLine.slice(HEADER_PREFIX.length).trim();
  let meta: NowForgeMetadata;
  try {
    meta = JSON.parse(json) as NowForgeMetadata;
  } catch {
    return null;
  }
  if (!meta.table || !meta.sys_id || !meta.field) return null;

  const body = newlineIdx >= 0 ? content.slice(newlineIdx + 1) : '';
  return { meta, body };
}

/** Wrap a body in a header comment. */
export function wrapWithHeader(body: string, meta: NowForgeMetadata): string {
  // Body might already have its own leading newline — collapse.
  const cleanBody = body.startsWith('\n') ? body : '\n' + body;
  return buildHeaderComment(meta) + cleanBody;
}

/** Strip a body's leading NowForge header if present. */
export function stripHeader(content: string): string {
  const parsed = readHeader(content);
  return parsed ? parsed.body.replace(/^\n/, '') : content;
}
