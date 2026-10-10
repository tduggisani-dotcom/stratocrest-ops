-- =============================================================================
-- Foundation: extensions, private `app` schema, enums, identity (actors/people),
-- availability, and the "who is acting" helpers used by triggers and RLS.
-- See docs/DATA_MODEL.md §1–§3.1 and §5.
-- =============================================================================

create extension if not exists citext with schema extensions;

-- Private helpers. Not exposed by the Data API (only `public` is).
create schema if not exists app;
revoke all on schema app from public;
grant usage on schema app to authenticated, service_role;
-- Function EXECUTE grants are set explicitly in the row-level-security migration.

-- ---------------------------------------------------------------------------
-- Enums (stored values are snake_case; UI labels live in src/lib/labels.ts)
-- ---------------------------------------------------------------------------
create type public.actor_kind          as enum ('person', 'bot');
create type public.org_kind            as enum ('investor', 'customer');
create type public.org_region          as enum ('ohio', 'midwest', 'rest_of_us', 'international');
create type public.org_subtype         as enum ('vc', 'angel', 'grant_program',
                                                'construction_firm', 'hard_hat_manufacturer', 'safety_distributor',
                                                'other');
create type public.contact_method      as enum ('cold_email', 'warm_intro', 'synthe6_event', 'conference', 'other');
create type public.hypothesis_status   as enum ('untested', 'validated', 'invalidated');
create type public.hypothesis_decision as enum ('persevere', 'pivot', 'drop');
create type public.test_outcome        as enum ('supports', 'contradicts', 'inconclusive');
create type public.task_status         as enum ('to_do', 'in_progress', 'blocked', 'done');
create type public.task_priority       as enum ('low', 'medium', 'high');
create type public.debrief_kind        as enum ('synthe6', 'mentor', 'investor', 'customer', 'team_meeting');
create type public.debrief_status      as enum ('due', 'done');
create type public.availability_label  as enum ('class', 'work', 'other');
create type public.session_emphasis    as enum ('okr_share_out', 'mentor_coaching', 'demo_day_prep');
create type public.team_meeting_status as enum ('upcoming', 'held', 'canceled');
create type public.candidate_stage     as enum ('sourced', 'intro_call', 'trial_project', 'offer', 'joined', 'passed');

-- ---------------------------------------------------------------------------
-- Time: every calendar-day rule uses America/New_York.
-- ---------------------------------------------------------------------------
create function app.today_et()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/New_York')::date
$$;

-- The moment a calendar day + wall-clock time happens in America/New_York.
create function app.et_moment(p_date date, p_time time)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select (p_date + p_time) at time zone 'America/New_York'
$$;

-- ---------------------------------------------------------------------------
-- Identity: actors (people + bots) and people.
-- ---------------------------------------------------------------------------
create table public.actors (
  id           uuid primary key default gen_random_uuid(),
  kind         public.actor_kind not null,
  display_name text not null check (btrim(display_name) <> '' and char_length(display_name) <= 120),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);
comment on table public.actors is 'Everyone who can change data: one row per person and per bot. created_by/updated_by point here.';

create table public.people (
  id                 uuid primary key default gen_random_uuid() references public.actors (id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  created_by         uuid references public.actors (id),
  updated_by         uuid references public.actors (id),
  auth_user_id       uuid unique references auth.users (id) on delete set null,
  name               text not null check (btrim(name) <> '' and char_length(name) <= 120),
  role               text not null check (btrim(role) <> '' and char_length(role) <= 120),
  email              extensions.citext not null unique check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  avatar_url         text check (avatar_url is null or (avatar_url ~ '^https://' and char_length(avatar_url) <= 2048)),
  contact_preference text check (char_length(contact_preference) <= 500),
  strengths          text[] not null default '{}' check (cardinality(strengths) <= 5),
  skills             text[] not null default '{}' check (cardinality(skills) <= 30),
  sort_order         smallint not null,
  is_active          boolean not null default true
);
comment on column public.people.sort_order is 'Display order and Sunday-meeting facilitator rotation.';
comment on column public.people.is_active is 'Inactive people cannot sign in and are skipped in the facilitator rotation.';
create index people_auth_user_id_idx on public.people (auth_user_id);

-- A person's id is also their actor id: create the actor row first.
create function app.tg_people_actor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- Link to an existing login with the same email, if there is one.
    if new.auth_user_id is null then
      select u.id into new.auth_user_id
        from auth.users u
       where lower(u.email) = lower(new.email::text)
       limit 1;
    end if;
    insert into public.actors (id, kind, display_name, is_active)
    values (new.id, 'person', new.name, new.is_active)
    on conflict (id) do update set display_name = excluded.display_name, is_active = excluded.is_active;
  elsif new.name is distinct from old.name or new.is_active is distinct from old.is_active then
    update public.actors set display_name = new.name, is_active = new.is_active where id = new.id;
  end if;
  return new;
end;
$$;

create trigger people_actor_sync
  before insert or update on public.people
  for each row execute function app.tg_people_actor();

-- Link a login to its person when the auth user is created (seed, invite, dashboard).
create function app.tg_link_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Compare lowercased text: with search_path = '' the citext "=" operator
  -- (in schema extensions) isn't found, and a plain text compare is case-sensitive.
  update public.people
     set auth_user_id = new.id
   where lower(email::text) = lower(new.email)
     and auth_user_id is null;
  return new;
end;
$$;

create trigger link_auth_user_to_person
  after insert on auth.users
  for each row execute function app.tg_link_auth_user();

-- ---------------------------------------------------------------------------
-- "Who is acting?" — used by the common-columns trigger, the audit log, and RLS.
-- ---------------------------------------------------------------------------

-- The signed-in person (any active state), or null.
create function app.current_person_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id from public.people p where p.auth_user_id = auth.uid()
$$;

-- True when the request comes from an active teammate's login.
create function app.is_team_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.people p where p.auth_user_id = auth.uid() and p.is_active
  )
$$;

-- True when the request was made with the server (secret) key.
create function app.is_service_role()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') = 'service_role'
$$;

-- The actor behind this change:
--   1. a signed-in person → their person id;
--   2. a server-key request → the active actor named in the `x-actor-id` header
--      (the bot API and server-side actions set it; browsers can't use the server key);
--   3. otherwise (scheduled jobs, migrations) → null, recorded as "system".
create function app.current_actor_id()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor  uuid;
  v_header text;
begin
  v_actor := app.current_person_id();
  if v_actor is not null then
    return v_actor;
  end if;

  if app.is_service_role() then
    v_header := nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-actor-id';
    if v_header ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      select a.id into v_actor from public.actors a where a.id = v_header::uuid and a.is_active;
      return v_actor;
    end if;
  end if;

  return null;
end;
$$;

-- 'person' | 'bot' | 'system'
create function app.current_actor_kind()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select a.kind::text from public.actors a where a.id = app.current_actor_id()), 'system')
$$;

-- ---------------------------------------------------------------------------
-- Common columns: created_at/created_by are set once; updated_at/updated_by on
-- every write. Client-supplied values are ignored.
-- ---------------------------------------------------------------------------
create function app.tg_set_common_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app.current_actor_id();
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.created_by := v_actor;
  else
    new.created_at := old.created_at;
    new.created_by := old.created_by;
  end if;
  new.updated_at := now();
  new.updated_by := v_actor;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Availability
-- ---------------------------------------------------------------------------
create table public.availability_blocks (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.actors (id),
  updated_by uuid references public.actors (id),
  person_id  uuid not null references public.people (id) on delete cascade,
  weekday    smallint not null check (weekday between 1 and 7),
  start_time time not null,
  end_time   time not null,
  label      public.availability_label not null,
  note       text check (char_length(note) <= 200),
  check (end_time > start_time)
);
comment on column public.availability_blocks.weekday is 'ISO weekday: 1 = Monday … 7 = Sunday.';
comment on column public.availability_blocks.start_time is 'Wall-clock time in America/New_York.';
create index availability_blocks_person_idx on public.availability_blocks (person_id);

create table public.crunch_periods (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.actors (id),
  updated_by uuid references public.actors (id),
  person_id  uuid not null references public.people (id) on delete cascade,
  start_date date not null,
  end_date   date not null,
  label      text not null check (btrim(label) <> '' and char_length(label) <= 120),
  check (end_date >= start_date)
);
create index crunch_periods_person_idx on public.crunch_periods (person_id, start_date);
