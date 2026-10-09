-- =============================================================================
-- Tasks and action items. See docs/DATA_MODEL.md §3.3–§3.4 and spec §6.4.
-- =============================================================================

create table public.tasks (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  created_by         uuid references public.actors (id),
  updated_by         uuid references public.actors (id),
  title              text not null check (btrim(title) <> '' and char_length(title) <= 200),
  next_action        text not null check (btrim(next_action) <> '' and char_length(next_action) <= 500),
  owner_id           uuid not null references public.people (id),
  due_date           date not null,
  status             public.task_status not null default 'to_do',
  priority           public.task_priority not null default 'medium',
  notes              text check (char_length(notes) <= 20000),
  key_result_id      uuid references public.key_results (id) on delete set null,
  synthe6_session_id uuid references public.synthe6_sessions (id) on delete set null,
  organization_id    uuid references public.organizations (id) on delete set null,
  team_meeting_id    uuid references public.team_meetings (id) on delete set null,
  org_meeting_id     uuid references public.org_meetings (id) on delete set null,
  debrief_id         uuid references public.debriefs (id) on delete set null,
  completed_at       timestamptz,
  archived_at        timestamptz,
  check ((status = 'done') = (completed_at is not null))
);
comment on column public.tasks.next_action is 'The concrete first step (implementation intention).';
create index tasks_owner_status_idx on public.tasks (owner_id, status) where archived_at is null;
create index tasks_due_idx on public.tasks (due_date) where archived_at is null and status <> 'done';
create index tasks_org_idx on public.tasks (organization_id);
create index tasks_key_result_idx on public.tasks (key_result_id);
create index tasks_session_idx on public.tasks (synthe6_session_id);
create index tasks_team_meeting_idx on public.tasks (team_meeting_id);
create index tasks_org_meeting_idx on public.tasks (org_meeting_id);
create index tasks_debrief_idx on public.tasks (debrief_id);

-- completed_at follows status.
create function app.tg_task_completed_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'done' then
    if tg_op = 'INSERT' or old.status <> 'done' or new.completed_at is null then
      new.completed_at := coalesce(case when tg_op = 'UPDATE' and old.status = 'done' then old.completed_at end, now());
    end if;
  else
    new.completed_at := null;
  end if;
  return new;
end;
$$;

create trigger tasks_completed_at
  before insert or update on public.tasks
  for each row execute function app.tg_task_completed_at();

create table public.action_items (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references public.actors (id),
  updated_by      uuid references public.actors (id),
  team_meeting_id uuid references public.team_meetings (id) on delete cascade,
  debrief_id      uuid references public.debriefs (id) on delete cascade,
  description     text not null check (btrim(description) <> '' and char_length(description) <= 1000),
  owner_id        uuid references public.people (id),
  due_date        date,
  task_id         uuid unique references public.tasks (id) on delete set null,
  check (num_nonnulls(team_meeting_id, debrief_id) = 1)
);
comment on column public.action_items.task_id is 'Set when the action item has been turned into a task.';
create index action_items_meeting_idx on public.action_items (team_meeting_id);
create index action_items_debrief_idx on public.action_items (debrief_id);
