-- Care Group Planner — initial schema
-- Roles: pastor (church admin), leader (group). Members have no account and answer via /s/[token].

create extension if not exists vector;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Core tables
-- ---------------------------------------------------------------------------

create table churches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  locale text not null default 'en' check (locale in ('en', 'zh-Hant')),
  invite_code text not null unique default encode(gen_random_bytes(6), 'hex'),
  created_at timestamptz not null default now()
);

create table profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  church_id uuid not null references churches (id) on delete cascade,
  role text not null check (role in ('pastor', 'leader')),
  display_name text,
  locale text not null default 'en' check (locale in ('en', 'zh-Hant')),
  created_at timestamptz not null default now()
);

create table groups (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references churches (id) on delete cascade,
  leader_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  locale text not null default 'en' check (locale in ('en', 'zh-Hant')),
  has_rightnow_access boolean not null default false,
  created_at timestamptz not null default now()
);
create index groups_church_idx on groups (church_id);
create index groups_leader_idx on groups (leader_id);

create table seasons (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups (id) on delete cascade,
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'open', 'closed')),
  survey_token text not null unique default encode(gen_random_bytes(16), 'hex'),
  target_weeks int not null default 6 check (target_weeks between 1 and 52),
  opened_at timestamptz,
  created_at timestamptz not null default now()
);
create index seasons_group_idx on seasons (group_id);

create table tags (
  key text primary key,
  family text not null check (family in ('bible_area', 'practice', 'living', 'life_stage', 'situation')),
  label_en text not null,
  label_zh text not null
);

create table survey_questions (
  id text primary key,
  section text not null check (section in ('A', 'B1', 'B2', 'C', 'D', 'E', 'F')),
  type text not null,
  tag_key text references tags (key),
  difficulty int check (difficulty between 1 and 3),
  options jsonb,
  correct jsonb,
  text_en text not null,
  text_zh text not null,
  sort_order int not null default 0
);

-- Anonymous by default: no IP, no user agent, no account. display_name only if the member opts in.
create table survey_responses (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references seasons (id) on delete cascade,
  locale text not null default 'en',
  answers jsonb not null,
  free_text_scrubbed text,
  free_text_tags jsonb not null default '{}'::jsonb,
  share_with_leader boolean not null default false,
  display_name text,
  crisis_flag boolean not null default false,
  created_at timestamptz not null default now(),
  constraint display_name_requires_opt_in check (share_with_leader or display_name is null)
);
create index survey_responses_season_idx on survey_responses (season_id);

create table leader_observations (
  season_id uuid not null references seasons (id) on delete cascade,
  tag_key text not null references tags (key),
  value real not null check (value between 0 and 1),
  updated_at timestamptz not null default now(),
  primary key (season_id, tag_key)
);

create table group_need_profiles (
  season_id uuid primary key references seasons (id) on delete cascade,
  needs jsonb not null,
  depth_target int not null check (depth_target between 1 and 3),
  hidden_needs jsonb not null default '[]'::jsonb,
  tiered_questions boolean not null default false,
  format_share jsonb not null default '{}'::jsonb,
  meta jsonb not null default '{}'::jsonb, -- masterySpread, medianPrepMinutes
  n int not null,
  computed_at timestamptz not null default now()
);

create table resources (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,
  church_id uuid references churches (id) on delete cascade, -- null = global catalog; set for custom resources
  source text not null check (source in ('bibleproject', 'rightnow', 'custom')),
  title text not null,
  title_zh text,
  description text not null default '',
  description_zh text,
  url text not null,
  attribution text,
  language text[] not null default '{en}',
  units int not null default 1 check (units >= 1),
  minutes_per_unit int not null default 10,
  depth int not null default 2 check (depth between 1 and 3),
  format text not null default 'video' check (format in ('video', 'discussion', 'reading')),
  has_guide boolean not null default false,
  access text not null default 'free' check (access in ('free', 'subscription')),
  embedding vector(1536),
  tag_status text not null default 'pending' check (tag_status in ('pending', 'ai', 'reviewed')),
  created_at timestamptz not null default now()
);
create index resources_embedding_idx on resources using hnsw (embedding vector_cosine_ops);

create table resource_tags (
  resource_id uuid not null references resources (id) on delete cascade,
  tag_key text not null references tags (key),
  relevance real not null check (relevance between 0 and 1),
  source text not null default 'ai' check (source in ('ai', 'pastor')),
  primary key (resource_id, tag_key)
);

create table church_catalog (
  church_id uuid not null references churches (id) on delete cascade,
  resource_id uuid not null references resources (id) on delete cascade,
  status text not null default 'allowed' check (status in ('allowed', 'blocked')),
  priority real not null default 0.5 check (priority between 0 and 1),
  notes text,
  updated_at timestamptz not null default now(),
  primary key (church_id, resource_id)
);

create table recommendations (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references seasons (id) on delete cascade,
  resource_id uuid not null references resources (id) on delete cascade,
  score real not null,
  breakdown jsonb not null,
  rationale_en text,
  rationale_zh text,
  rank int not null,
  created_at timestamptz not null default now()
);
create index recommendations_season_idx on recommendations (season_id);

create table session_plans (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references seasons (id) on delete cascade,
  resource_id uuid not null references resources (id) on delete cascade,
  content jsonb not null,
  locale text not null default 'en',
  created_at timestamptz not null default now()
);
create index session_plans_season_idx on session_plans (season_id);

create table feedback (
  id uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null references recommendations (id) on delete cascade,
  action text not null check (action in ('picked', 'dismissed')),
  rating int check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helper functions (security definer so policies don't recurse through RLS)
-- ---------------------------------------------------------------------------

create or replace function public.my_church_id() returns uuid
language sql stable security definer set search_path = public as $$
  select church_id from profiles where user_id = auth.uid()
$$;

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from profiles where user_id = auth.uid()
$$;

create or replace function public.can_access_group(gid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from groups g
    where g.id = gid
      and (g.leader_id = auth.uid()
           or (g.church_id = public.my_church_id() and public.my_role() = 'pastor'))
  )
$$;

create or replace function public.can_access_season(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from seasons s where s.id = sid and public.can_access_group(s.group_id))
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table churches enable row level security;
alter table profiles enable row level security;
alter table groups enable row level security;
alter table seasons enable row level security;
alter table tags enable row level security;
alter table survey_questions enable row level security;
alter table survey_responses enable row level security;
alter table leader_observations enable row level security;
alter table group_need_profiles enable row level security;
alter table resources enable row level security;
alter table resource_tags enable row level security;
alter table church_catalog enable row level security;
alter table recommendations enable row level security;
alter table session_plans enable row level security;
alter table feedback enable row level security;

create policy churches_select on churches for select using (id = public.my_church_id());
create policy churches_update on churches for update using (id = public.my_church_id() and public.my_role() = 'pastor');

create policy profiles_select on profiles for select
  using (user_id = auth.uid() or (church_id = public.my_church_id() and public.my_role() = 'pastor'));
create policy profiles_update_self on profiles for update using (user_id = auth.uid())
  with check (user_id = auth.uid() and role = public.my_role() and church_id = public.my_church_id());

create policy groups_select on groups for select using (public.can_access_group(id));
create policy groups_insert on groups for insert
  with check (church_id = public.my_church_id() and leader_id = auth.uid());
create policy groups_update on groups for update using (public.can_access_group(id))
  with check (church_id = public.my_church_id());
create policy groups_delete on groups for delete using (public.can_access_group(id));

create policy seasons_all on seasons for all using (public.can_access_group(group_id)) with check (public.can_access_group(group_id));

create policy tags_read on tags for select using (true);
create policy questions_read on survey_questions for select using (true);

-- Responses: readable by the group's leader / church pastor; inserted only via submit_survey_response().
create policy responses_select on survey_responses for select using (public.can_access_season(season_id));

create policy observations_all on leader_observations for all
  using (public.can_access_season(season_id)) with check (public.can_access_season(season_id));
create policy need_profiles_all on group_need_profiles for all
  using (public.can_access_season(season_id)) with check (public.can_access_season(season_id));
create policy recommendations_all on recommendations for all
  using (public.can_access_season(season_id)) with check (public.can_access_season(season_id));
create policy session_plans_all on session_plans for all
  using (public.can_access_season(season_id)) with check (public.can_access_season(season_id));
create policy feedback_all on feedback for all
  using (exists (select 1 from recommendations r where r.id = recommendation_id and public.can_access_season(r.season_id)))
  with check (exists (select 1 from recommendations r where r.id = recommendation_id and public.can_access_season(r.season_id)));

create policy resources_select on resources for select to authenticated
  using (church_id is null or church_id = public.my_church_id());
create policy resources_write on resources for all to authenticated
  using (public.my_role() = 'pastor' and (church_id = public.my_church_id() or church_id is null))
  with check (public.my_role() = 'pastor' and (church_id = public.my_church_id() or church_id is null));

create policy resource_tags_select on resource_tags for select to authenticated using (true);
create policy resource_tags_write on resource_tags for all to authenticated
  using (public.my_role() = 'pastor') with check (public.my_role() = 'pastor');

create policy catalog_select on church_catalog for select using (church_id = public.my_church_id());
create policy catalog_write on church_catalog for all
  using (church_id = public.my_church_id() and public.my_role() = 'pastor')
  with check (church_id = public.my_church_id() and public.my_role() = 'pastor');

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Onboarding: first login creates a church (pastor) or joins one with an invite code (leader).
create or replace function public.create_church(church_name text, church_locale text default 'en')
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if exists (select 1 from profiles where user_id = auth.uid()) then raise exception 'profile exists'; end if;
  insert into churches (name, locale) values (church_name, church_locale) returning id into cid;
  insert into profiles (user_id, church_id, role, locale) values (auth.uid(), cid, 'pastor', church_locale);
  -- Start with every global resource allowed; the pastor can block / prioritise.
  insert into church_catalog (church_id, resource_id)
    select cid, r.id from resources r where r.church_id is null;
  return cid;
end $$;

create or replace function public.join_church(code text, user_locale text default 'en')
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select id into cid from churches where invite_code = code;
  if cid is null then raise exception 'invalid invite code'; end if;
  insert into profiles (user_id, church_id, role, locale) values (auth.uid(), cid, 'leader', user_locale)
    on conflict (user_id) do nothing;
  return cid;
end $$;

-- Public survey metadata for a capability token (no auth).
create or replace function public.get_survey(token text)
returns table (season_id uuid, season_name text, group_name text, group_locale text, status text)
language sql stable security definer set search_path = public as $$
  select s.id, s.name, g.name, g.locale, s.status
  from seasons s join groups g on g.id = s.group_id
  where s.survey_token = token
$$;

create or replace function public.submit_survey_response(
  token text,
  p_locale text,
  p_answers jsonb,
  p_free_text_scrubbed text,
  p_free_text_tags jsonb,
  p_share_with_leader boolean,
  p_display_name text,
  p_crisis_flag boolean
) returns uuid language plpgsql security definer set search_path = public as $$
declare sid uuid; rid uuid;
begin
  select id into sid from seasons where survey_token = token and status = 'open';
  if sid is null then raise exception 'survey not open'; end if;
  insert into survey_responses (season_id, locale, answers, free_text_scrubbed, free_text_tags,
                                share_with_leader, display_name, crisis_flag)
  values (sid, coalesce(p_locale, 'en'), p_answers, left(p_free_text_scrubbed, 2000), coalesce(p_free_text_tags, '{}'::jsonb),
          coalesce(p_share_with_leader, false),
          case when coalesce(p_share_with_leader, false) then left(nullif(trim(p_display_name), ''), 60) else null end,
          coalesce(p_crisis_flag, false))
  returning id into rid;
  return rid;
end $$;

-- Vector retrieval over the catalog.
create or replace function public.match_resources(query_embedding vector(1536), match_count int default 50, candidate_ids uuid[] default null)
returns table (id uuid, similarity real)
language sql stable security definer set search_path = public as $$
  select r.id, (1 - (r.embedding <=> query_embedding))::real as similarity
  from resources r
  where r.embedding is not null and (candidate_ids is null or r.id = any (candidate_ids))
  order by r.embedding <=> query_embedding
  limit match_count
$$;

grant execute on function public.get_survey(text) to anon, authenticated;
grant execute on function public.submit_survey_response(text, text, jsonb, text, jsonb, boolean, text, boolean) to anon, authenticated;
grant execute on function public.create_church(text, text) to authenticated;
grant execute on function public.join_church(text, text) to authenticated;
grant execute on function public.match_resources(vector, int, uuid[]) to authenticated;
revoke execute on function public.get_survey(text) from public;
