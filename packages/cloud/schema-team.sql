-- NowForge Feature 22 — Team Features additions.
-- Apply this AFTER schema.sql.

create table if not exists shared_pipelines (
  id uuid primary key default uuid_generate_v4(),
  team_id uuid references teams(id) on delete cascade,
  name text not null,
  config jsonb not null,
  created_by uuid references profiles(id),
  updated_at timestamptz default now()
);

create table if not exists code_reviews (
  id uuid primary key default uuid_generate_v4(),
  team_id uuid references teams(id) on delete cascade,
  instance_url text not null,
  table_name text not null,
  record_sys_id text not null,
  record_name text,
  line_number int,
  comment text not null,
  author_id uuid references profiles(id),
  resolved boolean default false,
  created_at timestamptz default now()
);

create table if not exists activity_log (
  id uuid primary key default uuid_generate_v4(),
  team_id uuid references teams(id) on delete cascade,
  user_id uuid references profiles(id),
  action text not null,         -- e.g. 'script_push', 'pipeline_run', 'test_run'
  details jsonb,
  created_at timestamptz default now()
);

create table if not exists organization_settings (
  team_id uuid primary key references teams(id) on delete cascade,
  require_review boolean default false,
  prod_admin_only boolean default true,
  min_quality_score int default 0,
  features jsonb default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- RLS
alter table shared_pipelines       enable row level security;
alter table code_reviews           enable row level security;
alter table activity_log           enable row level security;
alter table organization_settings  enable row level security;

create policy "shared_pipelines team"      on shared_pipelines      for all using (team_id in (select team_id from team_members where user_id in (select id from me)));
create policy "code_reviews team"           on code_reviews          for all using (team_id in (select team_id from team_members where user_id in (select id from me)));
create policy "activity_log team read"     on activity_log          for select using (team_id in (select team_id from team_members where user_id in (select id from me)));
create policy "activity_log self insert"   on activity_log          for insert with check (user_id in (select id from me));
create policy "settings team read"         on organization_settings for select using (team_id in (select team_id from team_members where user_id in (select id from me)));
create policy "settings team admin"        on organization_settings for all
  using (team_id in (select tm.team_id from team_members tm where tm.user_id in (select id from me) and tm.role = 'admin'));
