# StratoCrest Ops — Data Model

**Status: implemented in Stage 1** (`supabase/migrations/`). The migrations are the source of
truth; this file is the readable overview. Where they differ, the migrations win. The SQL below is
a sketch, not a runnable migration.

---

## 1. Conventions

| Topic | Rule |
|---|---|
| Keys | `id uuid primary key default gen_random_uuid()` |
| Common columns | `created_at timestamptz`, `updated_at timestamptz`, `created_by uuid → actors`, `updated_by uuid → actors`. The database sets all four with a trigger. It ignores values the client sends, so a client can't fake an author. |
| Who did it | `actors` is one list of everyone who can change data: each person, and each bot (Grok). This gives `created_by` and `updated_by` a real foreign key, and lets the UI show a "via Grok" tag. |
| Moments vs days | A **moment** (a meeting start, a completion time) is stored as `timestamptz` in UTC and named `*_at`. A **calendar day** (a due date, a session date, a next-step date) is stored as `date` and named `*_date`. It always means that day in America/New_York. Storing a due day as midnight UTC would show the wrong day in ET, which is why the spec's "store as timestamptz" rule applies to moments only. |
| "Today" | `app.today_et()` = `(now() at time zone 'America/New_York')::date`. Used for overdue, stale, and due checks, in both SQL and TypeScript. |
| Required text | `NOT NULL` plus `CHECK (btrim(col) <> '')`, so blank strings are rejected too. Zod repeats the same rules in the UI and API with inline messages. |
| Machine values | Status, stage, and type values are stored in `snake_case`, for example `in_progress` and `pilot_proposed`. They are stable for the bot API. The UI shows labels such as "In Progress" from one file, `src/lib/labels.ts`. |
| Deleting | The main records (organizations, tasks, hypotheses, objectives, key results, decisions, candidates, checklist templates) are **archived** with `archived_at` and never hard-deleted. Anyone can restore them, and the activity log keeps the full history. |
| Helpers | SQL helper functions live in a private `app` schema that the API can't reach directly. |

## 2. Enums

```sql
create type actor_kind          as enum ('person', 'bot');
create type org_kind            as enum ('investor', 'customer');
create type org_region          as enum ('ohio', 'midwest', 'rest_of_us', 'international');
create type org_subtype         as enum ('vc', 'angel', 'grant_program',                                   -- investor
                                         'construction_firm', 'hard_hat_manufacturer', 'safety_distributor', -- customer
                                         'other');                                                          -- either
create type contact_method      as enum ('cold_email', 'warm_intro', 'synthe6_event', 'conference', 'other');
create type hypothesis_status   as enum ('untested', 'validated', 'invalidated');
create type hypothesis_decision as enum ('persevere', 'pivot', 'drop');
create type test_outcome        as enum ('supports', 'contradicts', 'inconclusive');
create type task_status         as enum ('to_do', 'in_progress', 'blocked', 'done');
create type task_priority       as enum ('low', 'medium', 'high');
create type debrief_kind        as enum ('synthe6', 'mentor', 'investor', 'customer', 'team_meeting');
create type debrief_status      as enum ('due', 'done');
create type availability_label  as enum ('class', 'work', 'other');
create type session_emphasis    as enum ('okr_share_out', 'mentor_coaching', 'demo_day_prep');
create type team_meeting_status as enum ('upcoming', 'held', 'canceled');
create type candidate_stage     as enum ('sourced', 'intro_call', 'trial_project', 'offer', 'joined', 'passed');
create type api_scope           as enum ('read', 'read_write');
```

Org **stages** are not an enum. They live in a small lookup table (§3.2) because each kind has its own
list, and the app needs to know their order to spot a stage advance for the wins feed.

## 3. Tables

`+common` below means `id`, `created_at`, `updated_at`, `created_by`, `updated_by` (see §1).

### 3.1 People and identity

```sql
actors (                               -- one row per person and per bot
  id uuid pk, kind actor_kind not null, display_name text not null,
  is_active boolean not null default true, created_at timestamptz)

people (
  id uuid pk references actors(id),    -- a person's id is also their actor id
  created_at, updated_at, created_by, updated_by,
  auth_user_id uuid unique null references auth.users(id),  -- linked when the account is created
  name text not null, role text not null,
  email citext unique not null,
  avatar_url text null,                -- falls back to initials (file uploads are out of scope)
  contact_preference text null,        -- e.g. "Text first; email for documents"
  strengths text[] not null default '{}' check (cardinality(strengths) <= 5),  -- CliftonStrengths top 5
  skills text[] not null default '{}',
  sort_order smallint not null,        -- display order and facilitator rotation
  is_active boolean not null default true)  -- inactive = cannot sign in, skipped in the rotation

availability_blocks ( +common,
  person_id uuid not null → people on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),   -- ISO: 1 = Monday … 7 = Sunday
  start_time time not null, end_time time not null check (end_time > start_time),  -- ET wall clock
  label availability_label not null, note text null)

crunch_periods ( +common,
  person_id uuid not null → people on delete cascade,
  start_date date not null, end_date date not null check (end_date >= start_date),
  label text not null)                 -- e.g. "Finals"
```

### 3.2 Investors and customers (one shared set of tables, configured by `kind`)

```sql
org_stages (                           -- reference data, created in a migration
  kind org_kind, stage text, label text not null, position smallint not null,
  outcome text not null check (outcome in ('open', 'won', 'lost')),
  primary key (kind, stage))
-- investor: identified 1, contacted 2, meeting 3, diligence 4, committed 5 (won), passed 6 (lost)
-- customer: identified 1, contacted 2, discovery 3, pilot_proposed 4, pilot_active 5, converted 6 (won), lost 7 (lost)

organizations ( +common,
  kind org_kind not null,
  name text not null,
  stage text not null default 'identified',
  foreign key (kind, stage) references org_stages,           -- an investor can't be put in a customer stage
  subtype org_subtype null,            -- CHECK: investor ∈ {vc, angel, grant_program, other}; customer ∈ {construction_firm, hard_hat_manufacturer, safety_distributor, other}
  owner_id uuid not null → people,     -- the "Coatl point of contact"
  next_step text not null,             -- implementation intention: owner + next step + date
  next_step_date date not null,
  contact_name, contact_title, contact_email, contact_phone text null,
  link text null,                      -- website or LinkedIn
  city text null, state_or_country text null, region org_region null,
  first_contact_date date null, first_contact_method contact_method null,
  introduced_by text null, check_size_or_focus text null,
  last_contact_date date null,         -- contact OUTSIDE meetings, entered by hand (e.g. an email);
                                       -- org_overview.last_contact_date also counts meetings that happened
  notes text null,
  key_result_id uuid null → key_results,
  related_organization_id uuid null → organizations,          -- same company tracked as the other kind
  archived_at timestamptz null)
-- unique (kind, lower(name)) where archived_at is null   ← blocks duplicate investors and customers, including from the bot

org_meetings ( +common,
  organization_id uuid not null → organizations,
  starts_at timestamptz not null,      -- may be in the future (a scheduled meeting)
  external_attendees text null,        -- their side, free text
  rating smallint null check (rating between 1 and 5),       -- empty until it happens
  summary text null check (char_length(summary) <= 200),     -- the one-liner in the tracker table
  notes text null, concerns_raised text null, materials_requested text null,
  follow_up_owner_id uuid null → people, follow_up_date date null,
  check ((follow_up_owner_id is null) = (follow_up_date is null)))   -- both or neither

org_meeting_attendees ( +common,       -- our side; replaces the spec's "attendees (person ids)" array
  org_meeting_id uuid → org_meetings on delete cascade,
  person_id uuid → people, unique (org_meeting_id, person_id))   -- own id so the audit log can track it

hypotheses ( +common,
  organization_id uuid null → organizations,                 -- null = applies across many orgs
  audience org_kind null,              -- set from the org when linked; lets the roll-up split investor vs customer
  owner_id uuid null → people,
  statement text not null, test_plan text null, success_criterion text null,
  result text null, learning text null,
  decision hypothesis_decision null,
  status hypothesis_status not null default 'untested',
  archived_at timestamptz null)

hypothesis_tests ( +common,            -- NEW: the evidence trail, one row per conversation that tested a hypothesis
  hypothesis_id uuid not null → hypotheses on delete cascade,
  org_meeting_id uuid null → org_meetings,
  test_date date not null, outcome test_outcome not null, evidence text not null)
```

### 3.3 Tasks and OKRs

```sql
tasks ( +common,
  title text not null,
  next_action text not null,           -- the concrete first step
  owner_id uuid not null → people,
  due_date date not null,
  status task_status not null default 'to_do',
  priority task_priority not null default 'medium',
  notes text null,
  -- optional links (any combination)
  key_result_id → key_results, synthe6_session_id → synthe6_sessions, organization_id → organizations,
  team_meeting_id → team_meetings, org_meeting_id → org_meetings, debrief_id → debriefs,   -- all uuid null
  completed_at timestamptz null,       -- set and cleared by trigger when status enters or leaves 'done'
  archived_at timestamptz null)

quarters (                             -- seeded from spec §6.8
  id uuid pk, label text unique not null,          -- 'Q1' … 'Q4'
  start_date date not null, end_date date not null, share_out_date date not null,
  share_out_session_id uuid null → synthe6_sessions)
-- Q1 2026-10-14 → 2027-01-13 (goals set W2, first shared W5 on 2026-11-04, share-out W10)
-- Q2 2027-01-14 → 2027-04-07 (W22) · Q3 2027-04-08 → 2027-07-07 (W35) · Q4 2027-07-08 → 2027-09-29 (W47 graduation)

objectives ( +common,
  quarter_id uuid not null → quarters, title text not null, description text null,
  owner_id uuid not null → people, position smallint not null default 0,
  archived_at timestamptz null)

key_results ( +common,
  objective_id uuid not null → objectives on delete cascade,
  title text not null, unit text null,                    -- e.g. "investor meetings", "$", "%"
  start_value numeric not null default 0,                 -- NEW: progress = (current − start) / (target − start)
  target_value numeric not null check (target_value <> start_value),
  current_value numeric not null default 0,
  owner_id uuid not null → people, position smallint not null default 0,
  archived_at timestamptz null)
-- 2–4 per objective: a trigger blocks a 5th; objectives are created together with their KRs in one
-- transaction (minimum 2), and the share-out view flags any objective that has dropped below 2.
```

### 3.4 Synthe6, Sunday meetings, decisions, debriefs

```sql
synthe6_sessions ( +common,
  week_number smallint null unique,    -- null for break weeks
  week_label text null unique,         -- 'W1' … 'W48'
  start_date date not null unique, end_date date not null check (end_date >= start_date),  -- W3 is a range
  start_time time null, end_time time null,      -- unknown for now → shown as all-day (see questions)
  format text not null, activity_type text not null, topic text null,
  is_break boolean not null default false,
  emphasis session_emphasis null,      -- okr_share_out W5/W10/W22/W35 · mentor_coaching · demo_day_prep W38–W43
  owner_id uuid null → people, notes text null, deliverables text null)

team_meetings ( +common,
  meeting_date date unique not null check (extract(isodow from meeting_date) = 7),   -- Sundays
  starts_at timestamptz not null,      -- 9:00 AM ET on meeting_date
  facilitator_id uuid not null → people,
  status team_meeting_status not null default 'upcoming',
  notes text null)

meeting_updates ( +common,             -- written pre-meeting updates
  team_meeting_id uuid not null → team_meetings on delete cascade,
  person_id uuid not null → people, unique (team_meeting_id, person_id),
  done_last_week text null, doing_this_week text null, blocked_on text null,
  decision_needed text null,           -- non-empty values become the agenda
  submitted_at timestamptz null)

decisions ( +common,                   -- replaces team_meetings.decisions jsonb → searchable and linkable
  team_meeting_id uuid null → team_meetings,
  meeting_update_id uuid null → meeting_updates,          -- the agenda item it settles
  statement text not null, rationale text null,
  decision_date date not null, owner_id uuid null → people,
  search tsvector generated always as (to_tsvector('english', statement || ' ' || coalesce(rationale, ''))) stored,
  archived_at timestamptz null)        -- GIN index on search

action_items ( +common,                -- NEW: from team meetings and debriefs; one click turns one into a task
  team_meeting_id uuid null → team_meetings, debrief_id uuid null → debriefs,   -- exactly one is set
  description text not null, owner_id uuid null → people, due_date date null,
  task_id uuid null unique → tasks)    -- set when converted

debriefs ( +common,
  kind debrief_kind not null,
  synthe6_session_id uuid null unique → synthe6_sessions,     -- kinds synthe6, mentor
  org_meeting_id     uuid null unique → org_meetings,         -- kinds investor, customer
  team_meeting_id    uuid null unique → team_meetings,        -- kind team_meeting
  -- CHECK: exactly one link is set, and it matches kind; unique = one debrief per event
  due_date date not null, status debrief_status not null default 'due',
  planned text null, actual text null, worked text null, change text null,
  facilitator_id uuid null → people,
  completed_at timestamptz null)
```

### 3.5 Checklists

```sql
checklist_templates ( +common,
  name text unique not null, description text null,
  items jsonb not null default '[]',   -- [{ "text": "...", "hint": "..." }], edited as a whole
  archived_at timestamptz null)

checklists ( +common,
  template_id uuid null → checklist_templates, title text not null,
  synthe6_session_id, organization_id, org_meeting_id, task_id, person_id uuid null   -- exactly one set
)                                      -- person_id = onboarding checklist for a new teammate

checklist_items ( +common,             -- rows, not jsonb, so two people ticking at once can't overwrite each other
  checklist_id uuid not null → checklists on delete cascade,
  position smallint not null, text text not null,
  done_at timestamptz null, done_by uuid null → actors)
```

### 3.6 Recruiting and help

```sql
candidates ( +common,
  name text not null, email citext null, role_sought text not null, source text null,
  stage candidate_stage not null default 'sourced',
  owner_id uuid not null → people, notes text null,
  joined_person_id uuid null → people, -- set when moved to 'joined' (profile + onboarding checklist created)
  archived_at timestamptz null)

help_requests ( +common,
  requester_id uuid not null → people,
  entity_type text null, entity_id uuid null,   -- the item it's about (any of the main tables), or none
  message text not null,
  resolved_by uuid null → people, resolved_at timestamptz null, resolution_note text null)
```

### 3.7 Audit, feedback, analytics

```sql
activity_log (                         -- append-only; written only by triggers
  id bigint generated always as identity pk,
  occurred_at timestamptz not null default now(),
  actor_kind text not null check (actor_kind in ('person', 'bot', 'system')),   -- 'system' = scheduled jobs
  actor_id uuid null → actors,
  action text not null,                -- insert | update | archive | restore | delete | undo
  entity_type text not null, entity_id uuid not null,      -- entity_type = table name
  before jsonb null, after jsonb null, changed_fields text[] null,
  undo_of bigint null → activity_log,  -- set on the entry that reverses another
  transaction_id bigint, statement_at timestamptz)  -- together: one change (one statement/API request,
                                       -- triggers included); undo reverses a whole change

feedback (id, created_at, person_id → people, page_path text not null, message text not null,
          status text not null default 'new' check (status in ('new', 'seen', 'done')))

usage_events (                         -- first-party analytics: no IP address, no user agent, no third parties
  id bigint identity pk, occurred_at timestamptz, person_id → people,
  kind text check (kind in ('page_view', 'feature_use')),
  section text not null, path text not null, feature text null)

app_settings (key text pk, value jsonb not null, updated_at timestamptz)   -- server-only
-- e.g. automation_start_date: automatic debriefs are only created for events on or after this date,
--      so going live doesn't create a backlog of old debriefs

event_dedupe (event text, entity_id uuid, dedupe_key text default '', created_at,
              primary key (event, entity_id, dedupe_key))   -- server-only
-- Remembers which scheduled events (task.overdue, debrief.due) were already sent, so the
-- scheduled checks never send twice and never touch business rows. dedupe_key = the task's
-- due date, so moving the date lets task.overdue fire again.
```

### 3.8 Bot API and integrations (built in Stage 6; tables listed now so the model is complete)

```sql
api_keys (
  id uuid pk, created_at,
  bot_id uuid not null → actors,       -- the bot (an actor with kind 'bot'), e.g. "Grok Chief of Staff"
  name text not null,
  key_prefix text not null,            -- first characters, shown in Settings to tell keys apart
  key_hash text unique not null,       -- SHA-256 of the full key; the key itself is shown once and never stored
  scope api_scope not null,
  created_by uuid not null → people, last_used_at timestamptz null,
  revoked_at timestamptz null, revoked_by uuid null → people)
-- Rotating a key = new key for the same bot, so history still reads "via Grok".

api_rate_limits (api_key_id → api_keys, window_start timestamptz, request_count int,
                 primary key (api_key_id, window_start))   -- fixed-window counter; old rows pruned hourly

webhooks ( +common,
  name text not null, url text not null check (url like 'https://%'),
  events text[] not null,              -- subset of: org.created, org.stage_changed, org_meeting.logged,
                                       --            task.overdue, help_request.created, debrief.due
  secret text not null,                -- HMAC signing secret; server-only (no client access)
  is_active boolean not null default true)

webhook_deliveries (                   -- the delivery log shown in Settings
  id uuid pk, created_at, webhook_id → webhooks on delete cascade,
  event text not null, event_id uuid not null,   -- same event_id on every retry (receiver can de-duplicate)
  payload jsonb not null,
  status text not null check (status in ('pending', 'succeeded', 'failed', 'dead')),
  attempt_count smallint not null default 0, next_attempt_at timestamptz,
  last_attempt_at timestamptz null, last_response_status smallint null, last_error text null,
  delivered_at timestamptz null)
-- Retry backoff: 1 min, 5 min, 30 min, 2 h, 6 h, then 'dead'.

capture_drafts ( +common,              -- POST /api/v1/capture lands here; a person confirms or discards
  raw_text text not null,
  proposed_type text not null default 'unknown'
    check (proposed_type in ('task', 'organization', 'org_meeting', 'hypothesis', 'help_request', 'unknown')),
  proposed_fields jsonb not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'discarded')),
  reviewed_by uuid null → people, reviewed_at timestamptz null,
  result_entity_type text null, result_entity_id uuid null)

calendar_event_links (entity_type text, entity_id uuid, google_event_id text not null,
                      content_hash text not null, synced_at timestamptz,
                      primary key (entity_type, entity_id))   -- keeps the Calendar push idempotent

integration_runs (id bigint identity pk, job text not null,   -- sheets_mirror | calendar_push | webhook_dispatch
                  started_at, finished_at, status text, detail jsonb)
```

## 4. Derived data (computed, never stored)

| Name | What it is |
|---|---|
| `org_overview` view | Each org plus owner name and avatar, **latest past meeting** (date, rating, summary), **next upcoming meeting**, days since contact, `is_stale`, `follow_up_overdue`, and stage label and position. It powers the tracker table, the cards, the Kanban, CSV export, and `/summary/investors`. |
| Last contact | The later of the latest meeting that has happened and `organizations.last_contact_date` (contact entered by hand). Derived, never stored, so moving or undoing a meeting can't leave it wrong. |
| Stale | Stage outcome is `open` and at least 14 days since last contact (or since the org was added, if never contacted), in ET. |
| Follow-up overdue | Stage outcome is `open` and `next_step_date < today`. An org's **follow-up** is its next step; the owner is the org owner. |
| Debrief "due" | `status = 'due' and due_date <= today`. Future ones show as "Upcoming". |
| `person_workload` view | Per active person: open tasks, overdue tasks, overdue follow-ups, meetings in the next 7 days, and debriefs due. A person is flagged when their total is ≥ 1.5× the team average **and** at least 3 above it. |
| `wins_feed` view | Activity-log entries for tasks moved to done, stage advances (forward among open stages, or into the won stage from anywhere), and meetings rated 4 or higher. Wins that were undone are hidden. |
| Agenda | Non-empty `meeting_updates.decision_needed` for the upcoming meeting. |
| Current quarter | The quarter whose dates include today. Before Q1 starts (before 2026-10-14) it is Q1. |

## 5. Rules the database enforces (so the UI and the bot behave the same)

Triggers:

1. **Common columns:** sets `updated_at`, `created_by` and `updated_by` from the current actor.
2. **Audit:** after insert, update or delete on every business table, writes to `activity_log` (before, after, and changed fields). No-op updates are skipped.
3. **Tasks:** fills or clears `completed_at`.
4. **Org meetings:** queue `org_meeting.logged`, and create the debrief (status `due`, due that day, facilitated by the org owner) once the meeting time has passed. A debrief nobody has started follows its meeting: it is removed if the meeting moves into the future, re-dated if it moves to another day, and handed to the new owner if it moves to another org.
5. **Organizations:** queue `org.created` on insert and `org.stage_changed` (from → to) when the stage changes. An org's `kind` can't change after it is created.
6. **Help requests:** queue `help_request.created`.
7. **Hypotheses:** copy `audience` from the linked org.
8. **Key results:** at most 4 per objective.
9. **People:** create and sync the matching `actors` row, and link the login (`auth_user_id`) by email in either order (person first or login first).
10. **Sunday meetings:** `starts_at` defaults to 9:00 AM ET on `meeting_date`. **Debriefs:** an org-meeting debrief's kind is copied from the org; `completed_at` follows status. **Checklist items:** ticking records who and when.

Every text column also has a length limit (CHECK), so a bot can't store a megabyte in a name.

Scheduled jobs (Supabase **pg_cron**, see `docs/ARCHITECTURE.md` §5):

- **Every 15 min, `app.run_scheduled_checks()`:**
  - Make sure next Sunday's meeting exists. The facilitator is the next active person by `sort_order` after the last meeting's facilitator.
  - Create due debriefs for Synthe6 sessions (not breaks) the day after they end, and for org meetings and Sunday meetings that have taken place.
  - Mark past Sunday meetings as `held`.
  - Queue `debrief.due` and `task.overdue`, once per item (tracked in `event_dedupe`).

  Synthe6 and Sunday-meeting debriefs only count from `app_settings.automation_start_date` (set by
  the first `pnpm seed`). Org-meeting debriefs are always created, because people log those on purpose.
  `public.run_scheduled_checks()` lets the server (secret key only) run the checks on demand.
- **Every minute:** if webhook deliveries are waiting, call the app's dispatcher.
- **Every 15 min:** call the app's Google Sheets and Calendar sync.

**How the database knows who is acting.** `app.current_actor_id()` decides who made each change. For a signed-in person, it is the `people` row linked to their login (`auth.uid()`). For the bot, the API route runs with the server key and sends the bot's actor id in a request header. **The header is trusted only on requests made with the server key**, so a browser can't pretend to be someone else. If neither applies (a scheduled job), the actor is `system`.

## 6. Row Level Security (on every table)

| Tables | Signed-in team member¹ | Not signed in | Server only (secret key) |
|---|---|---|---|
| All business tables | select, insert, update (everyone can edit everything, per spec §2) | nothing | everything |
| Hard delete | only `availability_blocks`, `crunch_periods`, `org_meeting_attendees`, `checklist_items`, unconverted `action_items`. Everything else is archived. | – | – |
| `activity_log` | select | nothing | written only by the audit trigger |
| `people`, `actors` | select; update `people` **profile fields only** (name, role, avatar, contact preference, strengths, skills) | nothing | insert, and changes to email, login link, rotation order, active flag |
| `help_requests` | select, update; insert only as yourself (`requester_id` = you) | nothing | – |
| `feedback`, `usage_events` | insert only as yourself; select | nothing | – |
| `org_stages`, `quarters` | select | nothing | – |
| `app_settings`, `event_dedupe`, and in Stage 6 `api_keys`, `api_rate_limits`, `webhooks`, `webhook_deliveries`, `calendar_event_links`, `integration_runs` | **no direct access**. Settings pages read them through server code that first checks team membership, so key hashes and webhook secrets never reach a browser. | nothing | everything |

¹ "Team member" = `app.is_team_member()`: the login belongs to a `people` row with `is_active = true`.

Table privileges start from nothing (Supabase's defaults, which include `TRUNCATE`, are revoked) and
only what each row in this table needs is granted. `public.undo_activity()` runs with the caller's
rights. The one exception is removing a record an undone change created on a table teammates can't
delete from (e.g. a meeting the bot logged): a narrow helper does that after re-checking team
membership. It refuses while other records point at it, and never deletes people.

## 7. Seed data (production-safe; spec §7)

- **Migration (reference data):** `org_stages`.
- **`pnpm seed`** (idempotent, safe to re-run):
  - The six people (names, roles, rotation order). Emails come from the `TEAM_EMAILS` environment variable, so they never land in git.
  - The four quarters.
  - All 53 rows of the Synthe6 schedule (48 weeks + 5 break weeks), with emphasis tags.
  - The four starter checklist templates.
  - `app_settings.automation_start_date`.
- **`pnpm seed:demo`** (development only): example investors, customers, and tasks, every name prefixed `[DEMO]`. It refuses to run when `APP_ENV=production` or when pointed at the production project.

## 8. Changes from the spec's starting point (summary)

1. **`actors`** (people + bots) gives created_by and updated_by real foreign keys and powers "via Grok".
2. **`date`** for calendar days and **`timestamptz`** for moments. All display and input is in ET.
3. **`snake_case` stored values**, with labels in the UI.
4. **`org_stages` lookup** checks stages per kind and gives them an order (for stage advances).
5. Meeting attendees as a **join table**; added `contact_email`, `contact_phone` and `related_organization_id` on orgs, plus a **unique name per kind** to stop duplicates.
6. **`hypothesis_tests`** records what each conversation taught us about a hypothesis (principle 2).
7. **`decisions`** and **`action_items`** tables instead of jsonb, so decisions are searchable and action items turn into tasks.
8. **`checklist_items`** rows instead of jsonb, so two people can tick items at once.
9. Debriefs link to their event with real foreign keys and a `due_date`, one debrief per event.
10. **`quarters`** table, seeded from §6.8. Key results gain a `start_value`.
11. Tasks link to a Sunday meeting, an org meeting, or a debrief separately, because the spec's single "meeting_id" was ambiguous.
12. **Archive instead of delete** on main records.
13. Supporting tables for Stage 6 and Stage 7: `capture_drafts`, `webhook_deliveries`, `api_rate_limits`, `calendar_event_links`, `integration_runs`, `usage_events`, `app_settings`.
14. *(Stage 1)* `event_dedupe` instead of "already notified" columns on tasks and debriefs, so scheduled jobs never edit business rows or clutter their history.
