-- =============================================================================
-- Business rules that must behave the same for people and the bot, plus the
-- scheduled checks. See docs/DATA_MODEL.md §5 and docs/ARCHITECTURE.md §5.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Outbound events (webhooks). Stage 1 wires every event to this function; it is
-- a no-op until Stage 6 adds the webhook tables and replaces its body.
-- -----------------------------------------------------------------------------
create function app.enqueue_webhook(p_event text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Stage 6: insert one webhook_deliveries row per active webhook subscribed to p_event.
  perform p_event, p_payload;
end;
$$;

create function app.org_event_payload(o public.organizations)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'organization_id', o.id,
    'kind', o.kind,
    'name', o.name,
    'stage', o.stage,
    'owner_id', o.owner_id,
    'next_step', o.next_step,
    'next_step_date', o.next_step_date
  )
$$;

-- -----------------------------------------------------------------------------
-- Organizations: kind never changes; events on create and stage change.
-- -----------------------------------------------------------------------------
create function app.tg_organization_kind_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.kind is distinct from old.kind then
    raise exception 'An organization''s kind (investor/customer) cannot change.'
      using errcode = 'check_violation', hint = 'Create a linked record of the other kind instead.';
  end if;
  return new;
end;
$$;

create trigger organizations_kind_immutable
  before update of kind on public.organizations
  for each row execute function app.tg_organization_kind_immutable();

create function app.tg_organization_events()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform app.enqueue_webhook('org.created', app.org_event_payload(new));
  elsif new.stage is distinct from old.stage then
    perform app.enqueue_webhook(
      'org.stage_changed',
      app.org_event_payload(new) || jsonb_build_object('from_stage', old.stage, 'to_stage', new.stage)
    );
  end if;
  return null;
end;
$$;

create trigger organizations_events
  after insert or update of stage on public.organizations
  for each row execute function app.tg_organization_events();

-- -----------------------------------------------------------------------------
-- Org meetings: move last_contact_date forward, create the debrief once the
-- meeting has happened, and announce newly logged meetings.
-- -----------------------------------------------------------------------------
create function app.ensure_org_meeting_debrief(p_meeting_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  insert into public.debriefs (kind, org_meeting_id, due_date, facilitator_id)
  select o.kind::text::public.debrief_kind,
         m.id,
         (m.starts_at at time zone 'America/New_York')::date,
         o.owner_id
    from public.org_meetings m
    join public.organizations o on o.id = m.organization_id
   where m.id = p_meeting_id
     and m.starts_at <= now()
  on conflict do nothing;
end;
$$;

create function app.tg_org_meeting_effects()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_day date := (new.starts_at at time zone 'America/New_York')::date;
begin
  if new.starts_at <= now() then
    update public.organizations
       set last_contact_date = v_day
     where id = new.organization_id
       and (last_contact_date is null or last_contact_date < v_day);
    perform app.ensure_org_meeting_debrief(new.id);
  end if;

  -- Moved to an org of the other kind: the debrief follows (investor ↔ customer).
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    update public.debriefs d
       set kind = o.kind::text::public.debrief_kind
      from public.organizations o
     where d.org_meeting_id = new.id
       and o.id = new.organization_id
       and d.kind::text <> o.kind::text;
  end if;

  if tg_op = 'INSERT' then
    perform app.enqueue_webhook('org_meeting.logged', (
      select jsonb_build_object(
        'org_meeting_id', new.id,
        'organization_id', o.id,
        'kind', o.kind,
        'organization_name', o.name,
        'starts_at', new.starts_at,
        'rating', new.rating,
        'summary', new.summary,
        'follow_up_owner_id', new.follow_up_owner_id,
        'follow_up_date', new.follow_up_date
      )
      from public.organizations o where o.id = new.organization_id
    ));
  end if;
  return null;
end;
$$;

create trigger org_meetings_effects
  after insert or update of starts_at, organization_id on public.org_meetings
  for each row execute function app.tg_org_meeting_effects();

-- -----------------------------------------------------------------------------
-- Help requests: announce new ones.
-- -----------------------------------------------------------------------------
create function app.tg_help_request_events()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform app.enqueue_webhook('help_request.created', jsonb_build_object(
    'help_request_id', new.id,
    'requester_id', new.requester_id,
    'entity_type', new.entity_type,
    'entity_id', new.entity_id,
    'message', new.message
  ));
  return null;
end;
$$;

create trigger help_requests_events
  after insert on public.help_requests
  for each row execute function app.tg_help_request_events();

-- -----------------------------------------------------------------------------
-- Sunday meetings: make sure the next one exists, with a rotating facilitator.
-- The "next" meeting is today's until noon ET on a Sunday, then next week's.
-- -----------------------------------------------------------------------------
create function app.ensure_next_team_meeting()
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
  if v_target = v_today and now() >= app.et_moment(v_today, time '12:00') then
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
-- Debriefs that come due automatically (spec §6.7).
-- Synthe6 sessions and Sunday meetings only count from app_settings
-- .automation_start_date onward, so going live doesn't create a backlog.
-- -----------------------------------------------------------------------------
create function app.create_due_debriefs()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_today date := app.today_et();
  v_start date := coalesce(
    (select (s.value #>> '{}')::date from public.app_settings s where s.key = 'automation_start_date'),
    'infinity'::date
  );
  v_count integer := 0;
  v_rows  integer;
begin
  -- Synthe6 sessions: due the day after they end.
  insert into public.debriefs (kind, synthe6_session_id, due_date, facilitator_id)
  select case when s.emphasis = 'mentor_coaching' then 'mentor' else 'synthe6' end::public.debrief_kind,
         s.id, s.end_date + 1, s.owner_id
    from public.synthe6_sessions s
   where not s.is_break
     and s.end_date < v_today
     and s.end_date >= v_start
     and not exists (select 1 from public.debriefs d where d.synthe6_session_id = s.id)
  on conflict do nothing;
  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;

  -- Org meetings that have happened (logged ahead of time, now in the past).
  insert into public.debriefs (kind, org_meeting_id, due_date, facilitator_id)
  select o.kind::text::public.debrief_kind, m.id, (m.starts_at at time zone 'America/New_York')::date, o.owner_id
    from public.org_meetings m
    join public.organizations o on o.id = m.organization_id
   where m.starts_at <= now()
     and not exists (select 1 from public.debriefs d where d.org_meeting_id = m.id)
  on conflict do nothing;
  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;

  -- Sunday meetings that were held.
  insert into public.debriefs (kind, team_meeting_id, due_date, facilitator_id)
  select 'team_meeting', m.id, m.meeting_date, m.facilitator_id
    from public.team_meetings m
   where m.status = 'held'
     and m.meeting_date >= v_start
     and not exists (select 1 from public.debriefs d where d.team_meeting_id = m.id)
  on conflict do nothing;
  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;

  return v_count;
end;
$$;

-- -----------------------------------------------------------------------------
-- The scheduled checks (pg_cron, every 15 minutes). Safe to run any time.
-- -----------------------------------------------------------------------------
create function app.run_scheduled_checks()
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

  -- Meetings logged ahead of time that have now happened count as contact.
  update public.organizations o
     set last_contact_date = x.last_day
    from (
      select m.organization_id, max((m.starts_at at time zone 'America/New_York')::date) as last_day
        from public.org_meetings m
       where m.starts_at <= now()
       group by m.organization_id
    ) x
   where x.organization_id = o.id
     and (o.last_contact_date is null or o.last_contact_date < x.last_day);

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

-- Server-side entry point (seed script, tests, a future "run now" button).
create function public.run_scheduled_checks()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select app.run_scheduled_checks()
$$;
revoke execute on function public.run_scheduled_checks() from public, anon, authenticated;
grant execute on function public.run_scheduled_checks() to service_role;
