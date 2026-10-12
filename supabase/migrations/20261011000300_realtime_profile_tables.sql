-- =============================================================================
-- Live updates for the Stage 2 pages: publish the tables they also show.
--
-- - availability_blocks, crunch_periods: a profile's busy times and crunch
--   periods (and the task list's crunch markers) update without a reload.
-- - org_meeting_attendees: This Week's "Meetings in the next 7 days" shows who
--   is going; changing only the attendees didn't refresh it.
--
-- Realtime respects RLS: subscribers only receive rows they can read.
-- =============================================================================

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.availability_blocks,
      public.crunch_periods,
      public.org_meeting_attendees;
  end if;
end;
$$;
