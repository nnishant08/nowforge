-- NowForge Feature 28 — Plugin Marketplace tables.
-- Apply after schema.sql.

create table if not exists plugins (
  id uuid primary key default uuid_generate_v4(),
  plugin_id text unique not null,         -- e.g. "com.author.plugin-name"
  name text not null,
  version text not null,
  author_id uuid references profiles(id),
  author_name text not null,
  description text,
  category text not null,
  tags text[],
  content jsonb not null,                  -- the full plugin JSON
  downloads int default 0,
  rating numeric(3,2) default 0,
  rating_count int default 0,
  approved boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists plugin_reviews (
  id uuid primary key default uuid_generate_v4(),
  plugin_id uuid references plugins(id) on delete cascade,
  user_id uuid references profiles(id),
  rating int check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamptz default now(),
  unique (plugin_id, user_id)
);

create table if not exists plugin_installs (
  id uuid primary key default uuid_generate_v4(),
  plugin_id uuid references plugins(id) on delete cascade,
  user_id uuid references profiles(id),
  installed_at timestamptz default now()
);

alter table plugins         enable row level security;
alter table plugin_reviews  enable row level security;
alter table plugin_installs enable row level security;

-- Anyone can read approved plugins
create policy "approved plugins read"   on plugins for select using (approved = true);
-- Authors can manage their own
create policy "author manage own"       on plugins for all using (author_id in (select id from me));
-- Reviews: anyone can read approved-plugin reviews; authenticated users can post their own
create policy "reviews read"            on plugin_reviews for select using (true);
create policy "reviews own write"       on plugin_reviews for all using (user_id in (select id from me));
-- Installs: each user sees their own
create policy "installs own"            on plugin_installs for all using (user_id in (select id from me));
