-- =============================================================================
-- Synthe6 program sessions, quarters, objectives, key results.
-- See docs/DATA_MODEL.md §3.3–§3.4 and spec §6.5, §6.8.
-- =============================================================================

create table public.synthe6_sessions (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references public.actors (id),
  updated_by    uuid references public.actors (id),
  week_number   smallint unique check (week_number between 1 and 60),
  week_label    text unique check (week_label ~ '^W[0-9]{1,2}$'),
  start_date    date not null unique,
  end_date      date not null,
  start_time    time,
  end_time      time,
  format        text not null check (btrim(format) <> '' and char_length(format) <= 80),
  activity_type text not null check (btrim(activity_type) <> '' and char_length(activity_type) <= 80),
  topic         text check (char_length(topic) <= 300),
  is_break      boolean not null default false,
  emphasis      public.session_emphasis,
  owner_id      uuid references public.people (id),
  notes         text check (char_length(notes) <= 10000),
  deliverables  text check (char_length(deliverables) <= 5000),
  check (end_date >= start_date),
  check ((week_number is null) = (week_label is null)),
  check ((week_number is null) = is_break),
  check (end_time is null or start_time is null or end_time > start_time)
);
comment on table public.synthe6_sessions is 'Synthe6 Cohort 2 schedule (spec §11). Break weeks have no week number.';
comment on column public.synthe6_sessions.start_time is 'Wall-clock start in America/New_York; null = all-day until known.';

create table public.quarters (
  id                   uuid primary key default gen_random_uuid(),
  label                text not null unique check (label ~ '^Q[1-4]$'),
  start_date           date not null,
  end_date             date not null,
  share_out_date       date not null,
  share_out_session_id uuid references public.synthe6_sessions (id),
  check (end_date >= start_date),
  check (share_out_date between start_date and end_date)
);
comment on table public.quarters is 'OKR quarters on Synthe6 labels (spec §6.8). Seeded by scripts/seed.ts.';

create table public.objectives (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references public.actors (id),
  updated_by  uuid references public.actors (id),
  quarter_id  uuid not null references public.quarters (id),
  title       text not null check (btrim(title) <> '' and char_length(title) <= 200),
  description text check (char_length(description) <= 5000),
  owner_id    uuid not null references public.people (id),
  position    smallint not null default 0,
  archived_at timestamptz
);
create index objectives_quarter_idx on public.objectives (quarter_id) where archived_at is null;
create index objectives_owner_idx on public.objectives (owner_id);

create table public.key_results (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references public.actors (id),
  updated_by    uuid references public.actors (id),
  objective_id  uuid not null references public.objectives (id) on delete cascade,
  title         text not null check (btrim(title) <> '' and char_length(title) <= 200),
  unit          text check (char_length(unit) <= 40),
  start_value   numeric not null default 0,
  target_value  numeric not null,
  current_value numeric not null default 0,
  owner_id      uuid not null references public.people (id),
  position      smallint not null default 0,
  archived_at   timestamptz,
  check (target_value <> start_value)
);
comment on column public.key_results.start_value is 'Progress = (current − start) / (target − start), clamped to 0–100%.';
create index key_results_objective_idx on public.key_results (objective_id) where archived_at is null;
create index key_results_owner_idx on public.key_results (owner_id);

-- At most 4 active key results per objective (spec §6.8: 2–4).
create function app.tg_key_results_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.archived_at is null and (
       select count(*) from public.key_results k
        where k.objective_id = new.objective_id
          and k.archived_at is null
          and k.id <> new.id
     ) >= 4 then
    raise exception 'An objective can have at most 4 key results.'
      using errcode = 'check_violation', hint = 'Archive one before adding another.';
  end if;
  return new;
end;
$$;

create trigger key_results_limit
  before insert or update of objective_id, archived_at on public.key_results
  for each row execute function app.tg_key_results_limit();
