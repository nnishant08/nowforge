export type EnvironmentType = 'dev' | 'test' | 'uat' | 'staging' | 'prod' | 'unknown';

export interface InstanceInfo {
  instanceName: string;
  environmentType: EnvironmentType;
  isServiceNowDomain: boolean;
  baseUrl: string;
}

// Match a keyword anywhere in the instance name, with one constraint: the
// keyword must be followed by a digit, dash, underscore, or end-of-string —
// never by another letter. This catches the patterns SN instances use:
//   calibr8nowdemo1  ← demo·1   ✓ dev
//   acme-dev         ← dev·$    ✓ dev
//   dev01            ← dev·0    ✓ dev
//   companyqa1       ← qa·1     ✓ test
//   mystaging        ← staging·$ ✓ staging
// while still rejecting substring traps:
//   device           ← dev·i    ✗ (i is a letter)
//   developer        ← dev·e, develop·e ✗
//   endeavor         ← no `dev` substring ✗
const DEV_PATTERNS = /(dev|develop|development|sandbox|demo|trial|personal)(?=[^a-z]|$)/i;
const TEST_PATTERNS = /(test|tst|testing|qa|quality)(?=[^a-z]|$)/i;
const UAT_PATTERNS = /(uat|acceptance|accept|preprod|pre-prod)(?=[^a-z]|$)/i;
const STAGING_PATTERNS = /(stag|staging|stage)(?=[^a-z]|$)/i;

/**
 * Classify the environment type from an instance name based on common naming conventions.
 * Prod is assumed if no known non-prod keyword is found.
 */
export function detectEnvironmentType(instanceName: string): EnvironmentType {
  if (DEV_PATTERNS.test(instanceName)) return 'dev';
  if (TEST_PATTERNS.test(instanceName)) return 'test';
  if (UAT_PATTERNS.test(instanceName)) return 'uat';
  if (STAGING_PATTERNS.test(instanceName)) return 'staging';
  return 'prod';
}

/**
 * Parse a ServiceNow URL and return information about the instance.
 * Works with both https://instance.service-now.com URLs and custom domains.
 */
export function getInstanceInfoFromUrl(url: string): InstanceInfo | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase();
  const isServiceNowDomain = host.endsWith('.service-now.com');

  let instanceName: string;
  if (isServiceNowDomain) {
    instanceName = host.replace('.service-now.com', '');
  } else {
    // For custom domains, use the full hostname as the instance identifier
    instanceName = host;
  }

  if (!instanceName) return null;

  const baseUrl = `${parsed.protocol}//${parsed.host}`;

  return {
    instanceName,
    environmentType: detectEnvironmentType(instanceName),
    isServiceNowDomain,
    baseUrl,
  };
}

/**
 * Check if a URL is a ServiceNow instance URL.
 */
export function isServiceNowUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.toLowerCase().endsWith('.service-now.com');
  } catch {
    return false;
  }
}
