import type { CloudClient } from './client.js';

/**
 * Feature 22 helpers — shared pipelines, code reviews, activity logging,
 * org settings. Built as functions (not class methods) so we don't bloat
 * the CloudClient surface; pass the client in as the first argument.
 */

export interface SharedPipeline {
  id: string;
  team_id: string;
  name: string;
  /** Full pipeline definition (matches Feature 18's Pipeline shape). */
  config: Record<string, unknown>;
  created_by: string;
  updated_at: string;
}

export interface CodeReview {
  id: string;
  team_id: string;
  instance_url: string;
  table_name: string;
  record_sys_id: string;
  record_name?: string;
  line_number?: number;
  comment: string;
  author_id: string;
  resolved: boolean;
  created_at: string;
}

export interface ActivityEntry {
  id: string;
  team_id: string;
  user_id: string;
  action: string;
  details?: Record<string, unknown>;
  created_at: string;
}

export interface OrgSettings {
  team_id: string;
  require_review: boolean;
  prod_admin_only: boolean;
  min_quality_score: number;
  features: Record<string, boolean>;
  updated_at: string;
}

// ── Shared Pipelines ───────────────────────────────────────────────────────

export async function listSharedPipelines(client: CloudClient, teamId: string): Promise<SharedPipeline[]> {
  return clientSelect<SharedPipeline>(client, 'shared_pipelines', `?team_id=eq.${teamId}`);
}
export async function saveSharedPipeline(
  client: CloudClient, p: Omit<SharedPipeline, 'id' | 'updated_at'>
): Promise<SharedPipeline[]> {
  return clientInsert<SharedPipeline>(client, 'shared_pipelines', p);
}

// ── Code Reviews ───────────────────────────────────────────────────────────

export async function listReviewsForRecord(
  client: CloudClient, teamId: string, table: string, sysId: string
): Promise<CodeReview[]> {
  return clientSelect<CodeReview>(
    client, 'code_reviews',
    `?team_id=eq.${teamId}&table_name=eq.${table}&record_sys_id=eq.${sysId}&order=created_at.desc`
  );
}
export async function postReview(
  client: CloudClient, r: Omit<CodeReview, 'id' | 'created_at'>
): Promise<CodeReview[]> {
  return clientInsert<CodeReview>(client, 'code_reviews', r);
}
export async function resolveReview(client: CloudClient, id: string): Promise<void> {
  await clientPatch(client, 'code_reviews', `?id=eq.${id}`, { resolved: true });
}

// ── Activity log ───────────────────────────────────────────────────────────

export async function logActivity(
  client: CloudClient, teamId: string, action: string, details?: Record<string, unknown>
): Promise<void> {
  const session = client.getSession();
  if (!session) return;
  await clientInsert(client, 'activity_log', {
    team_id: teamId,
    user_id: session.user.id,
    action,
    details: details ?? null,
  });
}

export async function recentActivity(client: CloudClient, teamId: string, limit = 50): Promise<ActivityEntry[]> {
  return clientSelect<ActivityEntry>(
    client, 'activity_log',
    `?team_id=eq.${teamId}&order=created_at.desc&limit=${limit}`
  );
}

// ── Org settings ───────────────────────────────────────────────────────────

export async function getOrgSettings(client: CloudClient, teamId: string): Promise<OrgSettings | null> {
  const list = await clientSelect<OrgSettings>(client, 'organization_settings', `?team_id=eq.${teamId}`);
  return list[0] ?? null;
}
export async function setOrgSettings(
  client: CloudClient, teamId: string, settings: Partial<OrgSettings>
): Promise<void> {
  // Upsert via Prefer: resolution=merge-duplicates would be cleaner but we
  // keep it simple: try update, fall back to insert.
  const existing = await getOrgSettings(client, teamId);
  if (existing) {
    await clientPatch(client, 'organization_settings', `?team_id=eq.${teamId}`, settings);
  } else {
    await clientInsert(client, 'organization_settings', { team_id: teamId, ...settings });
  }
}

// ── Internal helpers (avoid touching CloudClient privates) ─────────────────

interface MinimalCloudClient {
  getSession(): { accessToken: string; user: { id: string; email: string } } | null;
  /** @internal — exposed via type cast since the public client doesn't surface raw fetch. */
}

interface AccessHeaders { headers: HeadersInit; }

function buildHeaders(client: MinimalCloudClient, anonKey: string): AccessHeaders {
  const session = client.getSession();
  return {
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: session ? `Bearer ${session.accessToken}` : `Bearer ${anonKey}`,
    },
  };
}

async function clientSelect<T>(client: CloudClient, table: string, query: string): Promise<T[]> {
  const cfg = (client as unknown as { config: { url: string; anonKey: string } }).config;
  const { headers } = buildHeaders(client, cfg.anonKey);
  const res = await fetch(`${cfg.url}/rest/v1/${table}${query}`, { headers });
  if (!res.ok) return [];
  return (await res.json()) as T[];
}

async function clientInsert<T>(client: CloudClient, table: string, body: unknown): Promise<T[]> {
  const cfg = (client as unknown as { config: { url: string; anonKey: string } }).config;
  const { headers } = buildHeaders(client, cfg.anonKey);
  const res = await fetch(`${cfg.url}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=representation' } as HeadersInit,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as T[];
}

async function clientPatch(client: CloudClient, table: string, query: string, body: unknown): Promise<void> {
  const cfg = (client as unknown as { config: { url: string; anonKey: string } }).config;
  const { headers } = buildHeaders(client, cfg.anonKey);
  const res = await fetch(`${cfg.url}/rest/v1/${table}${query}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
}
