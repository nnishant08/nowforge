-- NowForge Team Sync — PostgreSQL schema for Supabase.
-- Run once on your Supabase project. RLS policies at the bottom enforce
-- "users can only see their own team's data".

create extension if not exists "uuid-ossp";

-- ── Profiles (1 per Supabase auth user) ─────────────────────────────────────
create table if not exists profiles (
  id uuid primary key default uuid_generate_v4(),
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  email text unique not null,
  display_name text,
  subscription_tier text default 'free' check (subscription_tier in ('free','pro','team')),
  created_at timestamptz default now()
);

-- ── Teams ───────────────────────────────────────────────────────────────────
create table if not exists teams (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table if not exists team_members (
  team_id uuid references teams(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  role text default 'member' check (role in ('admin','member')),
  joined_at timestamptz default now(),
  primary key (team_id, user_id)
);

-- ── Shared snippets ─────────────────────────────────────────────────────────
create table if not exists snippets (
  id uuid primary key default uuid_generate_v4(),
  team_id uuid references teams(id) on delete cascade,
  name text not null,
  description text,
  code text not null,
  language text default 'javascript',
  category text,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── Shared custom commands (for the command bar) ────────────────────────────
create table if not exists custom_commands (
  id uuid primary key default uuid_generate_v4(),
  team_id uuid references teams(id) on delete cascade,
  label text not null,
  command text not null,
  description text,
  icon text,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- ── Shared bookmarks ────────────────────────────────────────────────────────
create table if not exists bookmarks (
  id uuid primary key default uuid_generate_v4(),
  team_id uuid references teams(id) on delete cascade,
  instance_name text not null,
  table_name text not null,
  sys_id text not null,
  display_value text,
  url text,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- ── Shared instance registry ────────────────────────────────────────────────
create table if not exists team_instances (
  id uuid primary key default uuid_generate_v4(),
  team_id uuid references teams(id) on delete cascade,
  name text not null,
  url text not null,
  environment text check (environment in ('dev','test','staging','prod','pdi')),
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- ── Helper view: current user's profile id ─────────────────────────────────
create or replace view me as
  select p.* from profiles p where p.auth_user_id = auth.uid();

-- ── Row Level Security ──────────────────────────────────────────────────────
alter table profiles        enable row level security;
alter table teams           enable row level security;
alter table team_members    enable row level security;
alter table snippets        enable row level security;
alter table custom_commands enable row level security;
alter table bookmarks       enable row level security;
alter table team_instances  enable row level security;

-- A user can read/update their own profile
create policy "self profile read"  on profiles for select using (auth_user_id = auth.uid());
create policy "self profile write" on profiles for update using (auth_user_id = auth.uid());

-- Users can see teams they belong to
create policy "team read"   on teams for select using (
  id in (select team_id from team_members where user_id in (select id from me))
);
create policy "team admin"  on teams for all using (
  id in (
    select tm.team_id from team_members tm
    where tm.user_id in (select id from me) and tm.role = 'admin'
  )
);

-- Memberships
create policy "member read"  on team_members for select using (
  user_id in (select id from me) or
  team_id in (select team_id from team_members where user_id in (select id from me))
);
create policy "member admin" on team_members for all using (
  team_id in (
    select tm.team_id from team_members tm
    where tm.user_id in (select id from me) and tm.role = 'admin'
  )
);

-- Generic team-scoped policy: snippets, commands, bookmarks, instances
create policy "snippets team read"   on snippets        for select using (team_id in (select team_id from team_members where user_id in (select id from me)));
create policy "snippets team write"  on snippets        for all    using (team_id in (select team_id from team_members where user_id in (select id from me)));

create policy "commands team read"   on custom_commands for select using (team_id in (select team_id from team_members where user_id in (select id from me)));
create policy "commands team write"  on custom_commands for all    using (team_id in (select team_id from team_members where user_id in (select id from me)));

create policy "bookmarks team read"  on bookmarks       for select using (team_id in (select team_id from team_members where user_id in (select id from me)));
create policy "bookmarks team write" on bookmarks       for all    using (team_id in (select team_id from team_members where user_id in (select id from me)));

create policy "instances team read"  on team_instances  for select using (team_id in (select team_id from team_members where user_id in (select id from me)));
create policy "instances team write" on team_instances  for all    using (team_id in (select team_id from team_members where user_id in (select id from me)));
