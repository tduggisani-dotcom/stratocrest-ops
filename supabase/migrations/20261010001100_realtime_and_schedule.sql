-- =============================================================================
-- Live updates (Supabase Realtime) and the scheduled checks (pg_cron).
-- =============================================================================

-- Realtime respects RLS: subscribers only receive rows they can read.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.people,
      public.synthe6_sessions,
      public.objectives,
      public.key_results,
      public.organizations,
      public.org_meetings,
      public.hypotheses,
      public.team_meetings,
      public.meeting_updates,
      public.decisions,
      public.debriefs,
      public.tasks,
      public.action_items,
      public.checklist_items,
      public.candidates,
      public.help_requests;
  end if;
end;
$$;

-- Every 15 minutes: next Sunday meeting, held meetings, due debriefs, events.
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;

select cron.schedule(
  'run-scheduled-checks',
  '*/15 * * * *',
  $$select app.run_scheduled_checks()$$
);
