-- =============================================================================
-- Checklists, recruiting, help requests, feedback, usage analytics, settings.
-- See docs/DATA_MODEL.md §3.5–§3.7 and spec §6.9–§6.10, §7.
-- =============================================================================

create table public.checklist_templates (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references public.actors (id),
  updated_by  uuid references public.actors (id),
  name        text not null check (btrim(name) <> '' and char_length(name) <= 120),
  description text check (char_length(description) <= 2000),
  items       jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 100),
  archived_at timestamptz
);
comment on column public.checklist_templates.items is 'Ordered array of { "text": string, "hint"?: string }.';
create unique index checklist_templates_name_key on public.checklist_templates (lower(name)) where archived_at is null;

create table public.checklists (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  created_by         uuid references public.actors (id),
  updated_by         uuid references public.actors (id),
  template_id        uuid references public.checklist_templates (id) on delete set null,
  title              text not null check (btrim(title) <> '' and char_length(title) <= 200),
  synthe6_session_id uuid references public.synthe6_sessions (id) on delete cascade,
  organization_id    uuid references public.organizations (id) on delete cascade,
  org_meeting_id     uuid references public.org_meetings (id) on delete cascade,
  task_id            uuid references public.tasks (id) on delete cascade,
  person_id          uuid references public.people (id) on delete cascade,
  check (num_nonnulls(synthe6_session_id, organization_id, org_meeting_id, task_id, person_id) = 1)
);
comment on column public.checklists.person_id is 'Onboarding checklist for a new teammate.';
create index checklists_session_idx on public.checklists (synthe6_session_id);
create index checklists_org_idx on public.checklists (organization_id);
create index checklists_org_meeting_idx on public.checklists (org_meeting_id);
create index checklists_task_idx on public.checklists (task_id);
create index checklists_person_idx on public.checklists (person_id);

create table public.checklist_items (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references public.actors (id),
  updated_by   uuid references public.actors (id),
  checklist_id uuid not null references public.checklists (id) on delete cascade,
  position     smallint not null default 0,
  text         text not null check (btrim(text) <> '' and char_length(text) <= 500),
  hint         text check (char_length(hint) <= 1000),
  done_at      timestamptz,
  done_by      uuid references public.actors (id)
);
create index checklist_items_checklist_idx on public.checklist_items (checklist_id, position);

-- Ticking an item records who and when; unticking clears both.
create function app.tg_checklist_item_done()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.done_at is not null and (tg_op = 'INSERT' or old.done_at is null) then
    new.done_at := now();
    new.done_by := app.current_actor_id();
  elsif new.done_at is null then
    new.done_by := null;
  elsif tg_op = 'UPDATE' then
    new.done_at := old.done_at;
    new.done_by := old.done_by;
  end if;
  return new;
end;
$$;

create trigger checklist_items_done
  before insert or update on public.checklist_items
  for each row execute function app.tg_checklist_item_done();

create table public.candidates (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid references public.actors (id),
  updated_by       uuid references public.actors (id),
  name             text not null check (btrim(name) <> '' and char_length(name) <= 120),
  email            extensions.citext check (email is null or (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254)),
  role_sought      text not null check (btrim(role_sought) <> '' and char_length(role_sought) <= 120),
  source           text check (char_length(source) <= 200),
  stage            public.candidate_stage not null default 'sourced',
  owner_id         uuid not null references public.people (id),
  notes            text check (char_length(notes) <= 20000),
  joined_person_id uuid references public.people (id) on delete set null,
  archived_at      timestamptz
);
create index candidates_stage_idx on public.candidates (stage) where archived_at is null;

-- Items people can ask for help on (entity_type = table name, as in activity_log).
create table public.help_requests (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references public.actors (id),
  updated_by      uuid references public.actors (id),
  requester_id    uuid not null references public.people (id),
  entity_type     text check (entity_type in (
                    'organizations', 'org_meetings', 'hypotheses', 'tasks', 'objectives', 'key_results',
                    'synthe6_sessions', 'team_meetings', 'decisions', 'debriefs', 'checklists', 'candidates')),
  entity_id       uuid,
  message         text not null check (btrim(message) <> '' and char_length(message) <= 2000),
  resolved_by     uuid references public.people (id),
  resolved_at     timestamptz,
  resolution_note text check (char_length(resolution_note) <= 2000),
  check ((entity_type is null) = (entity_id is null)),
  check ((resolved_at is null) = (resolved_by is null))
);
create index help_requests_open_idx on public.help_requests (created_at desc) where resolved_at is null;
create index help_requests_entity_idx on public.help_requests (entity_type, entity_id);

create table public.feedback (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  person_id  uuid not null references public.people (id),
  page_path  text not null check (page_path ~ '^/' and char_length(page_path) <= 500),
  message    text not null check (btrim(message) <> '' and char_length(message) <= 5000),
  status     text not null default 'new' check (status in ('new', 'seen', 'done'))
);
create index feedback_created_idx on public.feedback (created_at desc);

-- First-party usage analytics: no IP address, no user agent, no third parties.
create table public.usage_events (
  id          bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  person_id   uuid not null references public.people (id),
  kind        text not null check (kind in ('page_view', 'feature_use')),
  section     text not null check (section ~ '^[a-z0-9_-]{1,40}$'),
  path        text not null check (path ~ '^/' and char_length(path) <= 500),
  feature     text check (feature ~ '^[a-z0-9_.:-]{1,80}$')
);
create index usage_events_occurred_idx on public.usage_events (occurred_at desc);

-- Small key/value settings, server-only.
create table public.app_settings (
  key        text primary key check (key ~ '^[a-z0-9_]+$'),
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
comment on table public.app_settings is 'automation_start_date: automatic debriefs are only created for events on/after this ET date.';

-- Remembers which outbound events were already sent, so scheduled checks never
-- send twice and never have to touch business rows. dedupe_key lets an event
-- fire again when its cause changes (e.g. a task's due date moves).
create table public.event_dedupe (
  event      text not null,
  entity_id  uuid not null,
  dedupe_key text not null default '',
  created_at timestamptz not null default now(),
  primary key (event, entity_id, dedupe_key)
);
