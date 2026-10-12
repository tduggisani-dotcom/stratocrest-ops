-- =============================================================================
-- An org-meeting debrief is never due before the day it was opened.
--
-- The debrief for an org meeting is opened automatically, due on the meeting
-- day. A meeting logged after the fact (on Monday, for last Wednesday's call)
-- therefore showed its debrief as overdue the moment it was logged, and fixing
-- the meeting's time later re-dated an untouched debrief into the past again.
-- Now the due date is the meeting day, or the day the debrief was opened if
-- that's later. Undo still restores a debrief exactly as it was.
-- =============================================================================

create function app.tg_org_debrief_due_date()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.org_meeting_id is null or coalesce(current_setting('app.undo_of', true), '') <> '' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.due_date := greatest(new.due_date, app.today_et());
  elsif new.due_date is distinct from old.due_date then
    new.due_date := greatest(new.due_date, (new.created_at at time zone 'America/New_York')::date);
  end if;
  return new;
end;
$$;

create trigger debriefs_org_due_date
  before insert or update of due_date on public.debriefs
  for each row execute function app.tg_org_debrief_due_date();

comment on function app.tg_org_debrief_due_date is
  'An org-meeting debrief is due on the meeting day, or on the day it was opened if later.';
