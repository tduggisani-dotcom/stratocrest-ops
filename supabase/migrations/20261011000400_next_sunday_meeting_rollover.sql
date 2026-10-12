-- =============================================================================
-- Next Sunday's meeting exists as soon as today's is over.
--
-- The scheduled checks mark a Sunday meeting held two hours after it starts
-- (11:00 ET for the usual 9:00 start), but app.ensure_next_team_meeting only
-- moved on to next week's meeting at noon ET. In between, no meeting was
-- 'upcoming', so This Week said "No Sunday meeting scheduled" for about an
-- hour every Sunday.
--
-- 1. On a Sunday, the next meeting is next week's from noon ET (as before), or
--    as soon as today's meeting is no longer upcoming (held or canceled).
-- 2. app.run_scheduled_checks makes sure the next meeting exists again after
--    marking meetings held, so the run that ends today's meeting also creates
--    next week's. Its body is otherwise unchanged from 20261011000100.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Sunday meetings: make sure the next one exists, with a rotating facilitator.
-- The "next" meeting is today's on a Sunday until noon ET or until it is held
-- or canceled, whichever comes first; then next week's.
-- -----------------------------------------------------------------------------
create or replace function app.ensure_next_team_meeting()
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_today       date := app.today_et();
  v_target      date;
  v_id          uuid;
  v_prev_order  smallint;
  v_facilitator uuid;
begin
  v_target := v_today + ((7 - extract(isodow from v_today)::int) % 7);
  if v_target = v_today
     and (now() >= app.et_moment(v_today, time '12:00')
          or exists (
            select 1 from public.team_meetings m
             where m.meeting_date = v_today and m.status <> 'upcoming'
          )) then
    v_target := v_today + 7;
  end if;

  select m.id into v_id from public.team_meetings m where m.meeting_date = v_target;
  if found then
    return v_id;
  end if;

  -- Next active person (by sort_order) after the most recent facilitator; wrap around.
  select p.sort_order into v_prev_order
    from public.team_meetings m
    join public.people p on p.id = m.facilitator_id
   where m.meeting_date < v_target
   order by m.meeting_date desc
   limit 1;

  select p.id into v_facilitator
    from public.people p
   where p.is_active and (v_prev_order is null or p.sort_order > v_prev_order)
   order by p.sort_order
   limit 1;

  if v_facilitator is null then
    select p.id into v_facilitator from public.people p where p.is_active order by p.sort_order limit 1;
  end if;
  if v_facilitator is null then
    return null; -- nobody to facilitate yet (before seeding)
  end if;

  insert into public.team_meetings (meeting_date, facilitator_id)
  values (v_target, v_facilitator)
  on conflict (meeting_date) do nothing
  returning id into v_id;
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- The scheduled checks (pg_cron, every 15 minutes). Safe to run any time.
-- -----------------------------------------------------------------------------
create or replace function app.run_scheduled_checks()
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_today    date := app.today_et();
  v_held     integer;
  v_debriefs integer;
  v_events   integer := 0;
  r          record;
begin
  perform app.ensure_next_team_meeting();

  -- A Sunday meeting counts as held two hours after it starts.
  update public.team_meetings
     set status = 'held'
   where status = 'upcoming'
     and starts_at <= now() - interval '2 hours';
  get diagnostics v_held = row_count;

  -- Today's meeting may have just been held: next week's is the next one now.
  perform app.ensure_next_team_meeting();

  v_debriefs := app.create_due_debriefs();

  -- debrief.due: once per debrief.
  for r in
    select d.id, d.kind, d.due_date, d.facilitator_id
      from public.debriefs d
     where d.status = 'due'
       and d.due_date <= v_today
       and not exists (
         select 1 from public.event_dedupe x where x.event = 'debrief.due' and x.entity_id = d.id
       )
  loop
    insert into public.event_dedupe (event, entity_id) values ('debrief.due', r.id) on conflict do nothing;
    perform app.enqueue_webhook('debrief.due', jsonb_build_object(
      'debrief_id', r.id, 'kind', r.kind, 'due_date', r.due_date, 'facilitator_id', r.facilitator_id));
    v_events := v_events + 1;
  end loop;

  -- task.overdue: once per task per due date.
  for r in
    select t.id, t.title, t.owner_id, t.due_date
      from public.tasks t
     where t.status <> 'done'
       and t.archived_at is null
       and t.due_date < v_today
       and not exists (
         select 1 from public.event_dedupe x
          where x.event = 'task.overdue' and x.entity_id = t.id and x.dedupe_key = t.due_date::text
       )
  loop
    insert into public.event_dedupe (event, entity_id, dedupe_key)
    values ('task.overdue', r.id, r.due_date::text) on conflict do nothing;
    perform app.enqueue_webhook('task.overdue', jsonb_build_object(
      'task_id', r.id, 'title', r.title, 'owner_id', r.owner_id, 'due_date', r.due_date));
    v_events := v_events + 1;
  end loop;

  return jsonb_build_object('meetings_held', v_held, 'debriefs_created', v_debriefs, 'events_queued', v_events);
end;
$$;
