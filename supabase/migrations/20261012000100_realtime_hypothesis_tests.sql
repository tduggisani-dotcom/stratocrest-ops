-- =============================================================================
-- Live updates for the Stage 3 pages: a hypothesis's test log (evidence from
-- each conversation) refreshes the org page and the hypothesis roll-up.
-- Realtime respects RLS: subscribers only receive rows they can read.
-- =============================================================================

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.hypothesis_tests;
  end if;
end;
$$;
