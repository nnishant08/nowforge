/**
 * Flow Designer URL detection. Lives in shared/ so the side panel can
 * detect from chrome.tabs.query results without a content-script round trip.
 */

const URL_PATTERNS: RegExp[] = [
  /\/\$flow-designer\.do/i,
  /\/now\/flow-designer\b/i,
  /\bflow[-_]designer\b/i,
];

export function isFlowDesignerUrl(url: string): boolean {
  return URL_PATTERNS.some((re) => re.test(url));
}

const SYS_ID_PATTERNS: RegExp[] = [
  /[#/]flow\/([a-f0-9]{32})/i,                    // #/flow/<sys_id> or /flow/<sys_id>
  /[#/]flow\/([a-f0-9]{32})\/(?:latest|published)/i,
  /[#/]subflow\/([a-f0-9]{32})/i,
  /[#/]action\/([a-f0-9]{32})/i,
];

/**
 * Best-effort flow sys_id extraction from a Flow Designer URL.
 * Looks at the URL path AND hash. Returns null if not found —
 * caller should show a "Select a flow" empty state.
 */
export function extractFlowSysId(url: string): string | null {
  let parsed: URL;
  try { parsed = new URL(url); } catch { return null; }

  const candidates = [
    parsed.hash,                       // most common — Flow Designer uses hash routing
    parsed.pathname,
    parsed.pathname + parsed.hash,
  ];

  for (const candidate of candidates) {
    for (const re of SYS_ID_PATTERNS) {
      const m = candidate.match(re);
      if (m?.[1]) return m[1].toLowerCase();
    }
  }
  return null;
}
