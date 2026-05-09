import type { InstanceCreds } from '../config.js';

/**
 * "Are we about to mutate production?" check. We tag instances at config
 * time with `environment: 'prod'`; if missing, fall back to the spec's
 * keyword regex so the safety prompt is still useful out of the box.
 */
const PROD_HOST_RE = /\b(prod|production)\b/i;

export function isProdInstance(creds: InstanceCreds): boolean {
  if (creds.environment === 'prod') return true;
  try {
    const host = new URL(creds.url).host;
    return PROD_HOST_RE.test(host);
  } catch {
    return false;
  }
}

/** Build the warning prefix used in confirmation prompts. */
export function prodWarningPrefix(creds: InstanceCreds): string {
  if (!isProdInstance(creds)) return '';
  return '⚠️  PRODUCTION INSTANCE — ';
}
