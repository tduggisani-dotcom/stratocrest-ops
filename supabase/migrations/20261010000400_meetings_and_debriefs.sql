-- =============================================================================
-- Sunday team meetings, pre-meeting updates, decisions, debriefs.
-- See docs/DATA_MODEL.md §3.4 and spec §6.6–§6.7.
-- =============================================================================

create table public.team_meetings (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid references public.actors (id),
  updated_by     uuid references public.actors (id),
  meeting_date   date not null unique check (extract(isodow from meeting_date) = 7),
  starts_at      timestamptz not null,
  facilitator_id uuid not null references public.people (id),
  status         public.team_meeting_status not null default 'upcoming',
  notes          text check (char_length(notes) <= 20000)
);
comment on column public.team_meetings.meeting_date is 'A Sunday (calendar day in America/New_York).';
comment on column public.team_meetings.starts_at is 'Defaults to 9:00 AM ET on meeting_date; can be moved.';
create index team_meetings_facilitator_idx on public.team_meetings (facilitator_id);

-- starts_at defaults to 9:00 ET on the meeting day, and follows the date when it moves.
create function app.tg_team_meeting_starts_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.starts_at is null
     or (tg_op = 'UPDATE' and new.meeting_date is distinct from old.meeting_date and new.starts_at = old.starts_at) then
    new.starts_at := app.et_moment(new.meeting_date, time '09:00');
  end if;
  return new;
end;
$$;

-- Let inserts omit starts_at: the trigger fills it before NOT NULL is checked.
create trigger team_meetings_starts_at
  before insert or update of meeting_date, starts_at on public.team_meetings
  for each row execute function app.tg_team_meeting_starts_at();

create table public.meeting_updates (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references public.actors (id),
  updated_by      uuid references public.actors (id),
  team_meeting_id uuid not null references public.team_meetings (id) on delete cascade,
  person_id       uuid not null references public.people (id),
  done_last_week  text check (char_length(done_last_week) <= 5000),
  doing_this_week text check (char_length(doing_this_week) <= 5000),
  blocked_on      text check (char_length(blocked_on) <= 5000),
  decision_needed text check (char_length(decision_needed) <= 2000),
  submitted_at    timestamptz,
  unique (team_meeting_id, person_id)
);
comment on column public.meeting_updates.decision_needed is 'Non-empty values become the meeting agenda.';
create index meeting_updates_person_idx on public.meeting_updates (person_id);

create table public.decisions (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid references public.actors (id),
  updated_by        uuid references public.actors (id),
  team_meeting_id   uuid references public.team_meetings (id) on delete set null,
  meeting_update_id uuid references public.meeting_updates (id) on delete set null,
  statement         text not null check (btrim(statement) <> '' and char_length(statement) <= 2000),
  rationale         text check (char_length(rationale) <= 10000),
  decision_date     date not null,
  owner_id          uuid references public.people (id),
  archived_at       timestamptz,
  search            tsvector generated always as (
                      to_tsvector('english'::regconfig, statement || ' ' || coalesce(rationale, ''))
                    ) stored
);
create index decisions_search_idx on public.decisions using gin (search);
create index decisions_meeting_idx on public.decisions (team_meeting_id);
create index decisions_date_idx on public.decisions (decision_date desc) where archived_at is null;

create table public.debriefs (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  created_by         uuid references public.actors (id),
  updated_by         uuid references public.actors (id),
  kind               public.debrief_kind not null,
  synthe6_session_id uuid unique references public.synthe6_sessions (id) on delete cascade,
  org_meeting_id     uuid unique references public.org_meetings (id) on delete cascade,
  team_meeting_id    uuid unique references public.team_meetings (id) on delete cascade,
  due_date           date not null,
  status             public.debrief_status not null default 'due',
  planned            text check (char_length(planned) <= 10000),
  actual             text check (char_length(actual) <= 10000),
  worked             text check (char_length(worked) <= 10000),
  change             text check (char_length(change) <= 10000),
  facilitator_id     uuid references public.people (id),
  completed_at       timestamptz,
  -- exactly one event, and it matches the kind
  check (num_nonnulls(synthe6_session_id, org_meeting_id, team_meeting_id) = 1),
  check ((kind in ('synthe6', 'mentor')) = (synthe6_session_id is not null)),
  check ((kind in ('investor', 'customer')) = (org_meeting_id is not null)),
  check ((kind = 'team_meeting') = (team_meeting_id is not null)),
  check ((status = 'done') = (completed_at is not null))
);
comment on table public.debriefs is 'One per event. "Due" when status = due and due_date <= today (ET).';
create index debriefs_status_due_idx on public.debriefs (status, due_date);
create index debriefs_facilitator_idx on public.debriefs (facilitator_id);

-- An org-meeting debrief's kind always matches the org (investor/customer);
-- completed_at follows status.
create function app.tg_debrief_defaults()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.org_meeting_id is not null then
    select o.kind::text::public.debrief_kind into new.kind
      from public.org_meetings m
      join public.organizations o on o.id = m.organization_id
     where m.id = new.org_meeting_id;
  end if;

  if new.status = 'done' and new.completed_at is null then
    new.completed_at := now();
  elsif new.status = 'due' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

create trigger debriefs_defaults
  before insert or update on public.debriefs
  for each row execute function app.tg_debrief_defaults();
