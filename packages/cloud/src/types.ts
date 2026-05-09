/** Mirrors the Supabase rows. */

export interface Profile {
  id: string;
  email: string;
  display_name?: string;
  subscription_tier: 'free' | 'pro' | 'team';
  created_at: string;
}

export interface Team {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
}

export interface TeamMember {
  team_id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
}

export interface Snippet {
  id: string;
  team_id: string;
  name: string;
  description?: string;
  code: string;
  language: string;
  category?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CustomCommand {
  id: string;
  team_id: string;
  label: string;
  command: string;
  description?: string;
  icon?: string;
  created_by: string;
  created_at: string;
}

export interface Bookmark {
  id: string;
  team_id: string;
  instance_name: string;
  table_name: string;
  sys_id: string;
  display_value?: string;
  url?: string;
  created_by: string;
  created_at: string;
}

export interface TeamInstance {
  id: string;
  team_id: string;
  name: string;
  url: string;
  environment?: 'dev' | 'test' | 'staging' | 'prod' | 'pdi';
  notes?: string;
  created_by: string;
  created_at: string;
}

export interface CloudConfig {
  /** Supabase project URL, e.g. https://abc.supabase.co. */
  url: string;
  /** Anon (public) key. RLS policies do the access control. */
  anonKey: string;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string };
}
