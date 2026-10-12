-- =============================================================================
-- Read models shared by the UI and the bot API. All use security_invoker, so
-- the caller's Row Level Security applies. See docs/DATA_MODEL.md §4.
-- =============================================================================

-- One row per investor/customer with its latest and next meeting and status flags.
create view public.org_overview
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
  o.last_contact_date,
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
  (app.today_et() - coalesce(o.last_contact_date, (o.created_at at time zone 'America/New_York')::date)) as days_since_contact,
  (s.outcome = 'open'
     and app.today_et() - coalesce(o.last_contact_date, (o.created_at at time zone 'America/New_York')::date) >= 14) as is_stale,
  (s.outcome = 'open' and o.next_step_date < app.today_et()) as follow_up_overdue
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
) nm on true;

comment on view public.org_overview is 'Investor/customer tracker rows: latest + next meeting, days since contact, stale (14+ days), follow-up overdue.';

-- Workload per active person, with the team average and an overload flag
-- (≥ 1.5× the team average and at least 3 above it).
create view public.person_workload
with (security_invoker = true)
as
with counts as (
  select
    p.id as person_id,
    p.name,
    p.role,
    p.avatar_url,
    p.sort_order,
    (select count(*) from public.tasks t
      where t.owner_id = p.id and t.status <> 'done' and t.archived_at is null)::int as open_tasks,
    (select count(*) from public.tasks t
      where t.owner_id = p.id and t.status <> 'done' and t.archived_at is null
        and t.due_date < app.today_et())::int as overdue_tasks,
    (select count(*) from public.organizations o
       join public.org_stages s on s.kind = o.kind and s.stage = o.stage
      where o.owner_id = p.id and o.archived_at is null and s.outcome = 'open'
        and o.next_step_date < app.today_et())::int as overdue_follow_ups,
    (select count(*) from public.org_meeting_attendees a
       join public.org_meetings m on m.id = a.org_meeting_id
      where a.person_id = p.id and m.starts_at > now()
        and m.starts_at <= now() + interval '7 days')::int as meetings_next_7_days,
    (select count(*) from public.debriefs d
      where d.facilitator_id = p.id and d.status = 'due'
        and d.due_date <= app.today_et())::int as debriefs_due
  from public.people p
  where p.is_active
),
totals as (
  select c.*, (c.open_tasks + c.overdue_follow_ups + c.meetings_next_7_days + c.debriefs_due) as total_load
  from counts c
)
select
  t.*,
  round(avg(t.total_load) over (), 1) as team_average,
  (t.total_load >= 1.5 * avg(t.total_load) over ()
     and t.total_load >= avg(t.total_load) over () + 3) as is_overloaded
from totals t;

comment on view public.person_workload is 'Open tasks, overdue items, upcoming meetings and due debriefs per person; is_overloaded flags well-above-average load.';

-- Wins: tasks completed, pipeline stages advanced, meetings rated 4+.
create view public.wins_feed
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
           and s_new.position > s_old.position
           and s_new.outcome <> 'lost'
      ))
    or (l.entity_type = 'org_meetings'
      and (l.after ->> 'rating')::int >= 4
      and coalesce((l.before ->> 'rating')::int, 0) < 4)
  );

comment on view public.wins_feed is 'Wins from the activity log: task_done, stage_advanced, strong_meeting (rating ≥ 4).';

grant select on public.org_overview, public.person_workload, public.wins_feed to authenticated;
