import type {
  CloudConfig, Session, Profile, Team, TeamMember,
  Snippet, CustomCommand, Bookmark, TeamInstance,
} from './types.js';

/**
 * Minimal Supabase client built on fetch — no SDK dependency.
 *
 * The Supabase JS SDK is ~80 KB and pulls in postgrest-js + realtime-js +
 * gotrue-js + storage-js. We only need REST + auth + a thin RLS-aware
 * fetcher, which is ~150 lines of plain fetch.
 */

export class CloudClient {
  private session: Session | null = null;

  constructor(private readonly config: CloudConfig) {}

  setSession(session: Session | null): void {
    this.session = session;
  }

  getSession(): Session | null {
    return this.session;
  }

  // ── Auth ────────────────────────────────────────────────────────────────

  async signUp(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
    const res = await fetch(`${this.config.url}/auth/v1/signup`, {
      method: 'POST',
      headers: this.publicHeaders(),
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) return { ok: false, error: await res.text() };
    return { ok: true };
  }

  async signIn(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
    const res = await fetch(`${this.config.url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: this.publicHeaders(),
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) return { ok: false, error: await res.text() };
    const data = await res.json() as {
      access_token: string; refresh_token: string;
      user: { id: string; email: string };
    };
    this.session = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      user: { id: data.user.id, email: data.user.email },
    };
    return { ok: true };
  }

  signOut(): void {
    if (!this.session) return;
    void fetch(`${this.config.url}/auth/v1/logout`, {
      method: 'POST',
      headers: this.authHeaders(),
    });
    this.session = null;
  }

  // ── Profile ─────────────────────────────────────────────────────────────

  async getMyProfile(): Promise<Profile | null> {
    const res = await this.select<Profile>('profiles', '?select=*&limit=1');
    return res[0] ?? null;
  }

  // ── Teams ───────────────────────────────────────────────────────────────

  async listTeams(): Promise<Team[]> {
    return this.select<Team>('teams', '?select=*');
  }

  async createTeam(name: string): Promise<Team | null> {
    const r = await this.insert<Team>('teams', { name });
    return r[0] ?? null;
  }

  async listMembers(teamId: string): Promise<TeamMember[]> {
    return this.select<TeamMember>('team_members', `?team_id=eq.${teamId}`);
  }

  // ── Snippets / Commands / Bookmarks / Instances ────────────────────────

  listSnippets(teamId: string): Promise<Snippet[]>     { return this.select('snippets',        `?team_id=eq.${teamId}&order=updated_at.desc`); }
  createSnippet(s: Omit<Snippet, 'id' | 'created_at' | 'updated_at'>): Promise<Snippet[]> { return this.insert('snippets', s); }
  deleteSnippet(id: string): Promise<void>             { return this.del('snippets',        `?id=eq.${id}`); }

  listCommands(teamId: string): Promise<CustomCommand[]> { return this.select('custom_commands', `?team_id=eq.${teamId}`); }
  createCommand(c: Omit<CustomCommand, 'id' | 'created_at'>): Promise<CustomCommand[]> { return this.insert('custom_commands', c); }
  deleteCommand(id: string): Promise<void>             { return this.del('custom_commands', `?id=eq.${id}`); }

  listBookmarks(teamId: string): Promise<Bookmark[]>   { return this.select('bookmarks',       `?team_id=eq.${teamId}`); }
  createBookmark(b: Omit<Bookmark, 'id' | 'created_at'>): Promise<Bookmark[]> { return this.insert('bookmarks',       b); }
  deleteBookmark(id: string): Promise<void>            { return this.del('bookmarks',        `?id=eq.${id}`); }

  listInstances(teamId: string): Promise<TeamInstance[]> { return this.select('team_instances',  `?team_id=eq.${teamId}`); }
  createInstance(i: Omit<TeamInstance, 'id' | 'created_at'>): Promise<TeamInstance[]> { return this.insert('team_instances',  i); }
  deleteInstance(id: string): Promise<void>            { return this.del('team_instances',   `?id=eq.${id}`); }

  // ── Internals ──────────────────────────────────────────────────────────

  private publicHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      apikey: this.config.anonKey,
    };
  }
  private authHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      apikey: this.config.anonKey,
      Authorization: this.session ? `Bearer ${this.session.accessToken}` : `Bearer ${this.config.anonKey}`,
    };
  }

  private async select<T>(table: string, query: string): Promise<T[]> {
    const res = await fetch(`${this.config.url}/rest/v1/${table}${query}`, {
      headers: this.authHeaders(),
    });
    if (!res.ok) return [];
    return (await res.json()) as T[];
  }

  private async insert<T>(table: string, body: unknown): Promise<T[]> {
    const res = await fetch(`${this.config.url}/rest/v1/${table}`, {
      method: 'POST',
      headers: { ...this.authHeaders(), Prefer: 'return=representation' } as HeadersInit,
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await res.text());
    return (await res.json()) as T[];
  }

  private async del(table: string, query: string): Promise<void> {
    const res = await fetch(`${this.config.url}/rest/v1/${table}${query}`, {
      method: 'DELETE',
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(await res.text());
  }
}
