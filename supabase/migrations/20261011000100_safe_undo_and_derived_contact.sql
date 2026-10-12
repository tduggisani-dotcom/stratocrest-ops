-- =============================================================================
-- Fixes from the Stage 1 adversarial review.
--
-- 1. Undo works on whole changes and never destroys more than it should:
--    - activity_log.transaction_id + statement_at identify one change: one
--      statement (one API request), including everything its triggers did
--      (e.g. the bot logging a meeting + the debrief the trigger created).
--      Undo reverses the whole change, newest entry first. Scheduled jobs
--      ("system") are undone one entry at a time, because one job run touches
--      unrelated records.
--    - Undoing a create refuses when the record has changed since (unless
--      forced), like undoing an edit already did.
--    - Removing a record never cascades: it refuses while other records still
--      point at it (meeting updates, debriefs, tasks, ...), even when forced.
--    - Undo puts completion stamps back as they were (who ticked an item, when
--      a task was done).
-- 2. An org's last contact date is derived, not stored: org_overview counts the
--    latest meeting that has happened, plus organizations.last_contact_date for
--    contact outside meetings. Moving, re-assigning or undoing a meeting can no
--    longer leave a stale org looking recently contacted.
-- 3. A still-untouched debrief follows its meeting: removed if the meeting
--    moves into the future, re-dated if it moves to another day.
-- 4. wins_feed hides wins that were undone, and counts Passed -> Committed and
--    Lost -> Converted.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1a. Group activity by the statement (request) that made it.
-- -----------------------------------------------------------------------------
alter table public.activity_log
  add column transaction_id bigint,
  add column statement_at timestamptz;
-- Rows logged before this migration each count as their own change.
update public.activity_log
   set transaction_id = -id, statement_at = occurred_at
 where transaction_id is null;
alter table public.activity_log
  alter column transaction_id set default txid_current(),
  alter column transaction_id set not null,
  alter column statement_at set default statement_timestamp(),
  alter column statement_at set not null;
create index activity_log_change_idx on public.activity_log (transaction_id, statement_at);
comment on column public.activity_log.transaction_id is
  'With statement_at, identifies one change (one statement / API request, triggers included). Undo reverses a whole change.';
comment on column public.activity_log.statement_at is
  'When the top-level statement that made this change started (statement_timestamp()).';

-- -----------------------------------------------------------------------------
-- 1b. Removing a record that an undone change created: never cascades.
-- -----------------------------------------------------------------------------
create or replace function app.delete_created_record(p_table regclass, p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r          record;
  v_exists   boolean;
  v_blockers text[] := '{}';
begin
  if not (app.is_team_member() or app.is_service_role()) then
    raise exception 'Only team members can undo changes.' using errcode = 'insufficient_privilege';
  end if;
  if p_table not in (
    'public.availability_blocks'::regclass, 'public.crunch_periods'::regclass,
    'public.synthe6_sessions'::regclass, 'public.org_meetings'::regclass,
    'public.org_meeting_attendees'::regclass, 'public.hypothesis_tests'::regclass,
    'public.team_meetings'::regclass, 'public.meeting_updates'::regclass,
    'public.debriefs'::regclass, 'public.action_items'::regclass,
    'public.checklists'::regclass, 'public.checklist_items'::regclass,
    'public.help_requests'::regclass
  ) then
    raise exception 'Records in % cannot be removed by undo.', p_table using errcode = 'feature_not_supported';
  end if;

  -- Refuse while anything still points at the record (no silent cascades).
  for r in
    select c.conrelid::regclass as tbl, a.attname as col
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
     where c.contype = 'f' and c.confrelid = p_table and cardinality(c.conkey) = 1
  loop
    execute format('select exists (select 1 from %s where %I = $1)', r.tbl, r.col) into v_exists using p_id;
    if v_exists then
      v_blockers := array_append(v_blockers, r.tbl::text);
    end if;
  end loop;
  if cardinality(v_blockers) > 0 then
    raise exception 'Other records still point at this one (%). Undo or remove those first.',
      array_to_string(v_blockers, ', ')
      using errcode = 'foreign_key_violation';
  end if;

  execute format('delete from %s where id = $1', p_table) using p_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 1c. Undo one entry (internal; runs with the caller's rights).
-- -----------------------------------------------------------------------------
create function app.undo_entry(e public.activity_log, p_force boolean)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_table   regclass := format('public.%I', e.entity_type)::regclass;
  v_current jsonb;
  v_field   text;
  v_set     text;
  v_cols    text;
begin
  -- Rows written while reversing this entry are logged as action = undo, undo_of = e.id.
  perform set_config('app.undo_of', e.id::text, true);

  execute format('select to_jsonb(t) from %s t where t.id = $1', v_table) into v_current using e.entity_id;

  if e.before is null then
    -- The change created the record.
    if v_current is null then
      raise exception 'The record no longer exists.' using errcode = 'no_data_found';
    end if;
    if not p_force
       and (v_current - app.audit_ignored_columns()) is distinct from (e.after - app.audit_ignored_columns()) then
      raise exception 'This record has changed since it was created.'
        using errcode = 'serialization_failure', hint = 'Review the latest version, then undo with force.';
    end if;
    if v_current ? 'archived_at' then
      execute format('update %s set archived_at = now() where id = $1', v_table) using e.entity_id;
    else
      perform app.delete_created_record(v_table, e.entity_id);
    end if;

  elsif e.after is not null then
    -- The change modified the record.
    if v_current is null then
      raise exception 'The record no longer exists.' using errcode = 'no_data_found';
    end if;
    if not p_force then
      foreach v_field in array coalesce(e.changed_fields, '{}') loop
        if (v_current -> v_field) is distinct from (e.after -> v_field) then
          raise exception 'This record has changed since (field "%").', v_field
            using errcode = 'serialization_failure', hint = 'Review the latest version, then undo with force.';
        end if;
      end loop;
    end if;
    select string_agg(format('%I = b.%I', f, f), ', ')
      into v_set
      from unnest(e.changed_fields) f
      join pg_attribute a on a.attrelid = v_table and a.attname = f and a.attnum > 0
                          and not a.attisdropped and a.attgenerated = '';
    if v_set is not null then
      execute format(
        'update %1$s t set %2$s from jsonb_populate_record(null::%1$s, $1) b where t.id = $2',
        v_table, v_set
      ) using e.before, e.entity_id;
    end if;

  else
    -- The change removed the record.
    if v_current is not null then
      raise exception 'The record already exists.' using errcode = 'unique_violation';
    end if;
    select string_agg(quote_ident(a.attname), ', ' order by a.attnum)
      into v_cols
      from pg_attribute a
     where a.attrelid = v_table and a.attnum > 0 and not a.attisdropped
       and a.attgenerated = '' and a.attidentity = '';
    execute format(
      'insert into %1$s (%2$s) select %2$s from jsonb_populate_record(null::%1$s, $1)',
      v_table, v_cols
    ) using e.before;
  end if;

  perform set_config('app.undo_of', '', true);
end;
$$;

-- -----------------------------------------------------------------------------
-- 1d. Undo a change: the whole request it belongs to, newest entry first.
-- -----------------------------------------------------------------------------
create or replace function public.undo_activity(p_log_id bigint, p_force boolean default false)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  e       public.activity_log%rowtype;
  v_group bigint[];
  r       public.activity_log%rowtype;
begin
  if not (app.is_team_member() or app.is_service_role()) then
    raise exception 'Only team members can undo changes.' using errcode = 'insufficient_privilege';
  end if;

  select * into e from public.activity_log where id = p_log_id;
  if not found then
    raise exception 'Activity % not found.', p_log_id using errcode = 'no_data_found';
  end if;

  -- Scheduled jobs touch unrelated records in one run: undo those one at a time.
  if e.actor_kind = 'system' then
    v_group := array[e.id];
  else
    select array_agg(l.id order by l.id)
      into v_group
      from public.activity_log l
     where l.transaction_id = e.transaction_id
       and l.statement_at = e.statement_at
       and l.actor_id is not distinct from e.actor_id;
  end if;

  if exists (select 1 from public.activity_log u where u.undo_of = any (v_group)) then
    raise exception 'This change has already been undone.' using errcode = 'unique_violation';
  end if;
  if exists (
    select 1 from public.activity_log l
     where l.id = any (v_group)
       and l.entity_type not in (
         'people', 'availability_blocks', 'crunch_periods', 'synthe6_sessions', 'objectives', 'key_results',
         'organizations', 'org_meetings', 'org_meeting_attendees', 'hypotheses', 'hypothesis_tests',
         'team_meetings', 'meeting_updates', 'decisions', 'debriefs', 'tasks', 'action_items',
         'checklist_templates', 'checklists', 'checklist_items', 'candidates', 'help_requests')
  ) then
    raise exception 'Changes to % cannot be undone.', e.entity_type using errcode = 'feature_not_supported';
  end if;

  for r in select * from public.activity_log l where l.id = any (v_group) order by l.id desc loop
    perform app.undo_entry(r, p_force);
  end loop;
end;
$$;
comment on function public.undo_activity is
  'Reverse the change an activity_log entry belongs to (every entry from the same statement / request; one entry for scheduled jobs). Refuses when records changed since (unless p_force) and never cascades deletes.';

-- -----------------------------------------------------------------------------
-- 1e. Completion stamps survive undo.
-- -----------------------------------------------------------------------------
create or replace function app.tg_task_completed_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('app.undo_of', true), '') <> '' then
    -- Undo restores the stored completion time as it was.
    if new.status <> 'done' then
      new.completed_at := null;
    elsif new.completed_at is null then
      new.completed_at := now();
    end if;
    return new;
  end if;

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

create or replace function app.tg_checklist_item_done()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('app.undo_of', true), '') <> '' then
    -- Undo restores who ticked the item and when, as they were.
    if new.done_at is null then
      new.done_by := null;
    end if;
    return new;
  end if;

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

-- -----------------------------------------------------------------------------
-- 2 + 3. Org meetings: no stored contact date; untouched debriefs follow.
-- -----------------------------------------------------------------------------
comment on column public.organizations.last_contact_date is
  'Last contact OUTSIDE logged meetings (e.g. an email). org_overview.last_contact_date also counts meetings that have happened.';

-- Security definer so it can remove an untouched debrief (teammates can't delete debriefs).
create or replace function app.tg_org_meeting_effects()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date := (new.starts_at at time zone 'America/New_York')::date;
begin
  if tg_op = 'UPDATE' then
    -- A debrief nobody has started yet follows its meeting.
    if new.starts_at > now() then
      delete from public.debriefs d
       where d.org_meeting_id = new.id
         and d.status = 'due'
         and num_nonnulls(d.planned, d.actual, d.worked, d.change) = 0
         and not exists (select 1 from public.action_items a where a.debrief_id = d.id)
         and not exists (select 1 from public.tasks t where t.debrief_id = d.id);
    else
      update public.debriefs d
         set due_date = v_day
       where d.org_meeting_id = new.id
         and d.status = 'due'
         and d.due_date <> v_day;
    end if;

    -- Moved to another org: the debrief's kind follows (investor <-> customer),
    -- and an untouched debrief goes to the new org's owner.
    if new.organization_id is distinct from old.organization_id then
      update public.debriefs d
         set kind = o.kind::text::public.debrief_kind,
             facilitator_id = case
               when d.status = 'due' and num_nonnulls(d.planned, d.actual, d.worked, d.change) = 0
               then o.owner_id else d.facilitator_id end
        from public.organizations o
       where d.org_meeting_id = new.id
         and o.id = new.organization_id;
    end if;
  end if;

  if new.starts_at <= now() then
    perform app.ensure_org_meeting_debrief(new.id);
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

-- The scheduled checks no longer copy meeting days into last_contact_date.
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

-- last_contact_date = the later of the latest meeting that happened and any
-- contact entered by hand; manual_last_contact_date shows the hand-entered one.
create or replace view public.org_overview
with (security_invoker = true)
as
select
  o.id,
  o.kind,
  o.name,
  o.stage,
  s.label    as stage_label,
  s.position as stage_position,
  s.outcome  as stage_outcome,
  o.subtype,
  o.owner_id,
  owner.name       as owner_name,
  owner.avatar_url as owner_avatar_url,
  o.next_step,
  o.next_step_date,
  o.contact_name,
  o.contact_title,
  o.contact_email,
  o.contact_phone,
  o.link,
  o.city,
  o.state_or_country,
  o.region,
  o.first_contact_date,
  o.first_contact_method,
  o.introduced_by,
  o.check_size_or_focus,
  c.last_contact_date,
  o.key_result_id,
  o.related_organization_id,
  o.created_at,
  o.updated_at,
  o.archived_at,
  lm.id        as latest_meeting_id,
  lm.starts_at as latest_meeting_at,
  lm.rating    as latest_rating,
  lm.summary   as latest_summary,
  nm.id        as next_meeting_id,
  nm.starts_at as next_meeting_at,
  (app.today_et() - coalesce(c.last_contact_date, (o.created_at at time zone 'America/New_York')::date)) as days_since_contact,
  (s.outcome = 'open'
     and app.today_et() - coalesce(c.last_contact_date, (o.created_at at time zone 'America/New_York')::date) >= 14) as is_stale,
  (s.outcome = 'open' and o.next_step_date < app.today_et()) as follow_up_overdue,
  o.last_contact_date as manual_last_contact_date
from public.organizations o
join public.org_stages s on s.kind = o.kind and s.stage = o.stage
join public.people owner on owner.id = o.owner_id
left join lateral (
  select m.id, m.starts_at, m.rating, m.summary
    from public.org_meetings m
   where m.organization_id = o.id and m.starts_at <= now()
   order by m.starts_at desc
   limit 1
) lm on true
left join lateral (
  select m.id, m.starts_at
    from public.org_meetings m
   where m.organization_id = o.id and m.starts_at > now()
   order by m.starts_at asc
   limit 1
) nm on true
cross join lateral (
  select greatest(o.last_contact_date, (lm.starts_at at time zone 'America/New_York')::date) as last_contact_date
) c;

comment on view public.org_overview is
  'Investor/customer tracker rows: latest + next meeting, last contact (meetings + manual), days since contact, stale (14+ days), follow-up overdue.';

-- -----------------------------------------------------------------------------
-- 4. Wins: hide undone wins; count reaching the won stage from anywhere.
-- -----------------------------------------------------------------------------
create or replace view public.wins_feed
with (security_invoker = true)
as
select
  l.id,
  l.occurred_at,
  l.actor_kind,
  l.actor_id,
  l.entity_type,
  l.entity_id,
  case l.entity_type
    when 'tasks' then 'task_done'
    when 'organizations' then 'stage_advanced'
    else 'strong_meeting'
  end as win_kind,
  l.after
from public.activity_log l
where l.after is not null
  and l.undo_of is null
  -- not undone (or undone and then redone)
  and not exists (
    select 1 from public.activity_log u
     where u.undo_of = l.id
       and not exists (select 1 from public.activity_log r where r.undo_of = u.id)
  )
  and (
    (l.entity_type = 'tasks'
      and l.after ->> 'status' = 'done'
      and coalesce(l.before ->> 'status', '') <> 'done')
    or (l.entity_type = 'organizations'
      and l.before is not null
      and l.before ->> 'stage' is distinct from l.after ->> 'stage'
      and exists (
        select 1
          from public.org_stages s_new
          join public.org_stages s_old on s_old.kind = s_new.kind
         where s_new.kind::text = l.after ->> 'kind'
           and s_new.stage = l.after ->> 'stage'
           and s_old.stage = l.before ->> 'stage'
           and (
             (s_new.outcome = 'won' and s_old.outcome <> 'won')
             or (s_new.outcome = 'open' and s_old.outcome = 'open' and s_new.position > s_old.position)
           )
      ))
    or (l.entity_type = 'org_meetings'
      and (l.after ->> 'rating')::int >= 4
      and coalesce((l.before ->> 'rating')::int, 0) < 4)
  );

comment on view public.wins_feed is
  'Wins from the activity log: task_done, stage_advanced (forward among open stages, or into the won stage), strong_meeting (rating >= 4). Undone wins are hidden.';

-- -----------------------------------------------------------------------------
-- Privileges for the new helper (called from the invoker-rights undo).
-- -----------------------------------------------------------------------------
revoke execute on function app.undo_entry(public.activity_log, boolean) from public;
grant execute on function app.undo_entry(public.activity_log, boolean) to authenticated, service_role;
grant execute on function app.audit_ignored_columns() to authenticated, service_role;
grant select on public.org_overview, public.wins_feed to authenticated;
