-- =============================================================================
-- Activity log (audit trail, wins feed, undo) and the common-columns + audit
-- triggers on every business table. See docs/DATA_MODEL.md §3.7 and §5.
-- =============================================================================

create table public.activity_log (
  id             bigint generated always as identity primary key,
  occurred_at    timestamptz not null default now(),
  actor_kind     text not null check (actor_kind in ('person', 'bot', 'system')),
  actor_id       uuid references public.actors (id),
  action         text not null check (action in ('insert', 'update', 'archive', 'restore', 'delete', 'undo')),
  entity_type    text not null,
  entity_id      uuid not null,
  before         jsonb,
  after          jsonb,
  changed_fields text[],
  undo_of        bigint references public.activity_log (id)
);
comment on table public.activity_log is 'Append-only. Written only by app.tg_audit(). entity_type = table name.';
comment on column public.activity_log.undo_of is 'Set on entries written while undoing another entry.';
create index activity_log_entity_idx on public.activity_log (entity_type, entity_id, occurred_at desc);
create index activity_log_occurred_idx on public.activity_log (occurred_at desc);
create index activity_log_undo_of_idx on public.activity_log (undo_of) where undo_of is not null;

-- Columns that never count as a change (bookkeeping and generated columns).
create function app.audit_ignored_columns()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['created_at', 'created_by', 'updated_at', 'updated_by', 'search']
$$;

-- Trigger arguments (optional): names of columns to redact from before/after.
create function app.tg_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before  jsonb;
  v_after   jsonb;
  v_changed text[];
  v_action  text;
  v_id      uuid;
  v_actor   uuid := app.current_actor_id();
  v_undo_of bigint := nullif(current_setting('app.undo_of', true), '')::bigint;
  v_redact  text;
begin
  if tg_op = 'INSERT' then
    v_after := to_jsonb(new);
    v_id := new.id;
    v_action := 'insert';
  elsif tg_op = 'UPDATE' then
    v_before := to_jsonb(old);
    v_after := to_jsonb(new);
    v_id := new.id;
    select array_agg(a.key order by a.key)
      into v_changed
      from jsonb_each(v_after) a
     where a.value is distinct from v_before -> a.key
       and a.key <> all (app.audit_ignored_columns());
    if v_changed is null then
      return null; -- nothing meaningful changed
    end if;
    v_action := case
      when v_before ->> 'archived_at' is null and v_after ->> 'archived_at' is not null then 'archive'
      when v_before ->> 'archived_at' is not null and v_after ->> 'archived_at' is null then 'restore'
      else 'update'
    end;
  else
    v_before := to_jsonb(old);
    v_id := old.id;
    v_action := 'delete';
  end if;

  if v_undo_of is not null then
    v_action := 'undo';
  end if;

  foreach v_redact in array coalesce(tg_argv, array[]::text[]) loop
    v_before := v_before - v_redact;
    v_after := v_after - v_redact;
  end loop;

  insert into public.activity_log (actor_kind, actor_id, action, entity_type, entity_id, before, after, changed_fields, undo_of)
  values (
    coalesce((select a.kind::text from public.actors a where a.id = v_actor), 'system'),
    v_actor, v_action, tg_table_name, v_id, v_before, v_after, v_changed, v_undo_of
  );
  return null;
end;
$$;

-- Attach the common-columns trigger and the audit trigger to every business table.
do $$
declare
  t text;
begin
  foreach t in array array[
    'people', 'availability_blocks', 'crunch_periods',
    'synthe6_sessions', 'objectives', 'key_results',
    'organizations', 'org_meetings', 'org_meeting_attendees', 'hypotheses', 'hypothesis_tests',
    'team_meetings', 'meeting_updates', 'decisions', 'debriefs',
    'tasks', 'action_items',
    'checklist_templates', 'checklists', 'checklist_items',
    'candidates', 'help_requests'
  ] loop
    execute format(
      'create trigger set_common_columns before insert or update on public.%I
         for each row execute function app.tg_set_common_columns()', t);
    execute format(
      'create trigger audit after insert or update or delete on public.%I
         for each row execute function app.tg_audit()', t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Undo one activity-log entry (spec §6.11 "can be undone by a person").
--   created a record  → archive it (or delete it, for tables without archive)
--   modified a record → put the changed fields back
--   removed a record  → re-insert the old row
-- Refuses when the record has changed since, unless p_force is true.
-- Runs as the caller, so Row Level Security still applies.
-- -----------------------------------------------------------------------------
create function public.undo_activity(p_log_id bigint, p_force boolean default false)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  e         public.activity_log%rowtype;
  v_table   regclass;
  v_current jsonb;
  v_field   text;
  v_set     text;
  v_cols    text;
begin
  if not (app.is_team_member() or app.is_service_role()) then
    raise exception 'Only team members can undo changes.' using errcode = 'insufficient_privilege';
  end if;

  select * into e from public.activity_log where id = p_log_id;
  if not found then
    raise exception 'Activity % not found.', p_log_id using errcode = 'no_data_found';
  end if;
  if exists (select 1 from public.activity_log l where l.undo_of = p_log_id) then
    raise exception 'This change has already been undone.' using errcode = 'unique_violation';
  end if;
  if e.entity_type not in (
    'people', 'availability_blocks', 'crunch_periods', 'synthe6_sessions', 'objectives', 'key_results',
    'organizations', 'org_meetings', 'org_meeting_attendees', 'hypotheses', 'hypothesis_tests',
    'team_meetings', 'meeting_updates', 'decisions', 'debriefs', 'tasks', 'action_items',
    'checklist_templates', 'checklists', 'checklist_items', 'candidates', 'help_requests'
  ) then
    raise exception 'Changes to % cannot be undone.', e.entity_type using errcode = 'feature_not_supported';
  end if;

  v_table := format('public.%I', e.entity_type)::regclass;
  perform set_config('app.undo_of', p_log_id::text, true);

  execute format('select to_jsonb(t) from %s t where t.id = $1', v_table) into v_current using e.entity_id;

  if e.before is null then
    -- The change created the record.
    if v_current is null then
      raise exception 'The record no longer exists.' using errcode = 'no_data_found';
    end if;
    if v_current ? 'archived_at' then
      execute format('update %s set archived_at = now() where id = $1', v_table) using e.entity_id;
    else
      execute format('delete from %s where id = $1', v_table) using e.entity_id;
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
    if v_set is null then
      return;
    end if;
    execute format(
      'update %1$s t set %2$s from jsonb_populate_record(null::%1$s, $1) b where t.id = $2',
      v_table, v_set
    ) using e.before, e.entity_id;

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
end;
$$;
comment on function public.undo_activity is 'Reverse one activity_log entry. Logged as action = undo with undo_of set.';
