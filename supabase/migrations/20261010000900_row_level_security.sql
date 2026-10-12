-- =============================================================================
-- Privileges and Row Level Security. See docs/DATA_MODEL.md §6.
--   * Signed-out visitors (anon) get nothing.
--   * Active teammates can read and edit everything (spec §2), archive instead
--     of delete, and hard-delete only a few small things.
--   * Server-only tables have RLS on and no policies.
--   * The server key (service_role) bypasses RLS; it is never sent to browsers.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Table privileges: start from nothing, then grant exactly what's needed.
-- (Supabase's defaults grant ALL, including TRUNCATE, to anon and authenticated.)
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon;
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from anon;

do $$
declare
  t text;
  team_tables text[] := array[
    'availability_blocks', 'crunch_periods',
    'synthe6_sessions', 'objectives', 'key_results',
    'organizations', 'org_meetings', 'org_meeting_attendees', 'hypotheses', 'hypothesis_tests',
    'team_meetings', 'meeting_updates', 'decisions', 'debriefs',
    'tasks', 'action_items',
    'checklist_templates', 'checklists', 'checklist_items',
    'candidates'
  ];
  deletable text[] := array['availability_blocks', 'crunch_periods', 'org_meeting_attendees', 'checklist_items'];
begin
  foreach t in array team_tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
    execute format(
      'create policy "Team can read" on public.%I for select to authenticated using ((select app.is_team_member()))', t);
    execute format(
      'create policy "Team can add" on public.%I for insert to authenticated with check ((select app.is_team_member()))', t);
    execute format(
      'create policy "Team can edit" on public.%I for update to authenticated using ((select app.is_team_member())) with check ((select app.is_team_member()))', t);
  end loop;

  foreach t in array deletable loop
    execute format('grant delete on public.%I to authenticated', t);
    execute format(
      'create policy "Team can delete" on public.%I for delete to authenticated using ((select app.is_team_member()))', t);
  end loop;
end;
$$;

-- Action items can be deleted only until they become a task.
grant delete on public.action_items to authenticated;
create policy "Team can delete unconverted" on public.action_items
  for delete to authenticated using ((select app.is_team_member()) and task_id is null);

-- People: everyone reads; profile fields are editable by the team. Email, login
-- link, rotation order and active flag change only through server actions.
alter table public.people enable row level security;
grant select on public.people to authenticated;
grant update (name, role, avatar_url, contact_preference, strengths, skills) on public.people to authenticated;
create policy "Team can read" on public.people
  for select to authenticated using ((select app.is_team_member()));
create policy "Team can edit profiles" on public.people
  for update to authenticated using ((select app.is_team_member())) with check ((select app.is_team_member()));

alter table public.actors enable row level security;
grant select on public.actors to authenticated;
create policy "Team can read" on public.actors
  for select to authenticated using ((select app.is_team_member()));

-- Reference data: read-only for the team.
alter table public.org_stages enable row level security;
grant select on public.org_stages to authenticated;
create policy "Team can read" on public.org_stages
  for select to authenticated using ((select app.is_team_member()));

alter table public.quarters enable row level security;
grant select on public.quarters to authenticated;
create policy "Team can read" on public.quarters
  for select to authenticated using ((select app.is_team_member()));

-- Help requests: anyone can ask (as themselves) and anyone can resolve.
alter table public.help_requests enable row level security;
grant select, insert, update on public.help_requests to authenticated;
create policy "Team can read" on public.help_requests
  for select to authenticated using ((select app.is_team_member()));
create policy "Team can ask as themselves" on public.help_requests
  for insert to authenticated
  with check ((select app.is_team_member()) and requester_id = (select app.current_person_id()));
create policy "Team can edit" on public.help_requests
  for update to authenticated using ((select app.is_team_member())) with check ((select app.is_team_member()));

-- Activity log: read-only; rows are written by the audit trigger only.
alter table public.activity_log enable row level security;
grant select on public.activity_log to authenticated;
create policy "Team can read" on public.activity_log
  for select to authenticated using ((select app.is_team_member()));

-- Feedback: send as yourself; the team can read and triage.
alter table public.feedback enable row level security;
grant select, insert on public.feedback to authenticated;
grant update (status) on public.feedback to authenticated;
create policy "Team can read" on public.feedback
  for select to authenticated using ((select app.is_team_member()));
create policy "Send as yourself" on public.feedback
  for insert to authenticated
  with check ((select app.is_team_member()) and person_id = (select app.current_person_id()));
create policy "Team can triage" on public.feedback
  for update to authenticated using ((select app.is_team_member())) with check ((select app.is_team_member()));

-- Usage analytics: record your own views; the team can read the totals.
alter table public.usage_events enable row level security;
grant select, insert on public.usage_events to authenticated;
grant usage on sequence public.usage_events_id_seq to authenticated;
create policy "Team can read" on public.usage_events
  for select to authenticated using ((select app.is_team_member()));
create policy "Record your own" on public.usage_events
  for insert to authenticated
  with check ((select app.is_team_member()) and person_id = (select app.current_person_id()));

-- Server-only tables: RLS on, no policies, no grants.
alter table public.app_settings enable row level security;
alter table public.event_dedupe enable row level security;

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema app from public;

-- Helpers that RLS policies and invoker-rights triggers call on behalf of the user.
grant execute on function
  app.today_et(),
  app.et_moment(date, time),
  app.current_person_id(),
  app.current_actor_id(),
  app.current_actor_kind(),
  app.is_team_member(),
  app.is_service_role(),
  app.enqueue_webhook(text, jsonb),
  app.org_event_payload(public.organizations),
  app.ensure_org_meeting_debrief(uuid),
  app.delete_created_record(regclass, uuid)
to authenticated, service_role;

-- Undo is available to teammates (it runs with their own rights, under RLS).
revoke execute on function public.undo_activity(bigint, boolean) from public;
grant execute on function public.undo_activity(bigint, boolean) to authenticated, service_role;
