-- =============================================================================
-- Logging and editing an investor or customer meeting in one step (spec §6.2:
-- "Logging a meeting takes ≤ 2 screens").
--
-- public.log_org_meeting() writes the meeting, who went from our side and
-- (optionally) the org's new next step in ONE statement:
--   * atomic: if any part fails (a bad attendee, a blank next step), nothing
--     is saved;
--   * one change for undo: the audit log groups entries by transaction,
--     statement time and actor, so public.undo_activity() on any of its
--     entries reverses the whole logged meeting (including the debrief the
--     database opened for a meeting that has already happened).
-- public.update_org_meeting() does the same for an edit: the meeting's fields,
-- the attendee set (replaced) and, optionally, the org's next step.
--
-- Both run with the caller's rights (RLS applies: only active teammates, or
-- the server key for the bot) and check what the table constraints can't:
-- the org exists and isn't archived, a rating only once the meeting has
-- happened, and a next step comes with its date. Length limits, the 1–5
-- rating range and "follow-up owner and date, both or neither" are the
-- tables' own CHECKs.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Shared checks (internal).
-- -----------------------------------------------------------------------------
create function app.check_org_meeting_input(
  p_organization_id uuid,
  p_starts_at       timestamptz,
  p_rating          smallint,
  p_next_step       text,
  p_next_step_date  date
)
returns void
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_kind     public.org_kind;
  v_archived timestamptz;
begin
  select o.kind, o.archived_at into v_kind, v_archived
    from public.organizations o
   where o.id = p_organization_id;
  if not found then
    raise exception 'That investor or customer no longer exists. Refresh and try again.'
      using errcode = 'foreign_key_violation';
  end if;
  if v_archived is not null then
    raise exception 'This % is archived. Restore it to log or edit its meetings.', v_kind
      using errcode = 'check_violation';
  end if;

  if p_starts_at is null then
    raise exception 'Pick the day and time of the meeting.' using errcode = 'not_null_violation';
  end if;
  if p_rating is not null and p_starts_at > now() then
    raise exception 'Rate the meeting after it happens.' using errcode = 'check_violation';
  end if;

  if (p_next_step is null) <> (p_next_step_date is null) then
    raise exception 'A new next step needs both the step and its date.' using errcode = 'check_violation';
  end if;
end;
$$;

-- The org's next step, when the meeting changed it. Skipped when it's the same,
-- so an unchanged next step adds nothing to the history.
create function app.set_org_next_step(
  p_organization_id uuid,
  p_next_step       text,
  p_next_step_date  date
)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.organizations o
     set next_step = btrim(p_next_step),
         next_step_date = p_next_step_date
   where o.id = p_organization_id
     and p_next_step is not null
     and (o.next_step, o.next_step_date) is distinct from (btrim(p_next_step), p_next_step_date);
$$;

-- -----------------------------------------------------------------------------
-- Log a meeting.
-- -----------------------------------------------------------------------------
create function public.log_org_meeting(
  p_organization_id     uuid,
  p_starts_at           timestamptz,
  p_attendee_ids        uuid[] default null,
  p_external_attendees  text default null,
  p_rating              smallint default null,
  p_summary             text default null,
  p_notes               text default null,
  p_concerns_raised     text default null,
  p_materials_requested text default null,
  p_follow_up_owner_id  uuid default null,
  p_follow_up_date      date default null,
  p_next_step           text default null,
  p_next_step_date      date default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_meeting_id uuid;
begin
  perform app.check_org_meeting_input(
    p_organization_id, p_starts_at, p_rating, p_next_step, p_next_step_date);

  insert into public.org_meetings (
    organization_id, starts_at, external_attendees, rating, summary, notes,
    concerns_raised, materials_requested, follow_up_owner_id, follow_up_date)
  values (
    p_organization_id, p_starts_at, p_external_attendees, p_rating, p_summary, p_notes,
    p_concerns_raised, p_materials_requested, p_follow_up_owner_id, p_follow_up_date)
  returning id into v_meeting_id;

  insert into public.org_meeting_attendees (org_meeting_id, person_id)
  select distinct v_meeting_id, a.person_id
    from unnest(coalesce(p_attendee_ids, '{}')) as a (person_id)
   where a.person_id is not null;

  perform app.set_org_next_step(p_organization_id, p_next_step, p_next_step_date);
  return v_meeting_id;
end;
$$;
comment on function public.log_org_meeting is
  'Log an org meeting: the meeting, our attendees and (optionally) the org''s new next step, as one change (atomic; one undo). Null optional arguments mean "none"; the next step is left as it is unless both p_next_step and p_next_step_date are given. Returns the meeting id.';

-- -----------------------------------------------------------------------------
-- Edit a meeting.
-- -----------------------------------------------------------------------------
create function public.update_org_meeting(
  p_meeting_id          uuid,
  p_starts_at           timestamptz,
  p_attendee_ids        uuid[] default null,
  p_external_attendees  text default null,
  p_rating              smallint default null,
  p_summary             text default null,
  p_notes               text default null,
  p_concerns_raised     text default null,
  p_materials_requested text default null,
  p_follow_up_owner_id  uuid default null,
  p_follow_up_date      date default null,
  p_next_step           text default null,
  p_next_step_date      date default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_org_id uuid;
begin
  -- Lock the meeting so two edits at once apply one after the other.
  select m.organization_id into v_org_id
    from public.org_meetings m
   where m.id = p_meeting_id
     for update;
  if not found then
    raise exception 'That meeting no longer exists. Refresh and try again.' using errcode = 'no_data_found';
  end if;

  perform app.check_org_meeting_input(v_org_id, p_starts_at, p_rating, p_next_step, p_next_step_date);

  update public.org_meetings
     set starts_at = p_starts_at,
         external_attendees = p_external_attendees,
         rating = p_rating,
         summary = p_summary,
         notes = p_notes,
         concerns_raised = p_concerns_raised,
         materials_requested = p_materials_requested,
         follow_up_owner_id = p_follow_up_owner_id,
         follow_up_date = p_follow_up_date
   where id = p_meeting_id;

  -- Who went: replace the set (null leaves it as it is).
  if p_attendee_ids is not null then
    delete from public.org_meeting_attendees a
     where a.org_meeting_id = p_meeting_id
       and a.person_id <> all (array_remove(p_attendee_ids, null));
    insert into public.org_meeting_attendees (org_meeting_id, person_id)
    select distinct p_meeting_id, n.person_id
      from unnest(p_attendee_ids) as n (person_id)
     where n.person_id is not null
    on conflict (org_meeting_id, person_id) do nothing;
  end if;

  perform app.set_org_next_step(v_org_id, p_next_step, p_next_step_date);
  return p_meeting_id;
end;
$$;
comment on function public.update_org_meeting is
  'Edit an org meeting: replaces its fields, replaces who went from our side (null = leave as is) and optionally sets the org''s new next step, as one change (atomic; one undo). Returns the meeting id.';

-- -----------------------------------------------------------------------------
-- Privileges: teammates (under RLS) and the server; never signed-out visitors.
-- -----------------------------------------------------------------------------
revoke execute on function
  app.check_org_meeting_input(uuid, timestamptz, smallint, text, date),
  app.set_org_next_step(uuid, text, date),
  public.log_org_meeting(uuid, timestamptz, uuid[], text, smallint, text, text, text, text, uuid, date, text, date),
  public.update_org_meeting(uuid, timestamptz, uuid[], text, smallint, text, text, text, text, uuid, date, text, date)
from public, anon;

grant execute on function
  app.check_org_meeting_input(uuid, timestamptz, smallint, text, date),
  app.set_org_next_step(uuid, text, date),
  public.log_org_meeting(uuid, timestamptz, uuid[], text, smallint, text, text, text, text, uuid, date, text, date),
  public.update_org_meeting(uuid, timestamptz, uuid[], text, smallint, text, text, text, text, uuid, date, text, date)
to authenticated, service_role;
