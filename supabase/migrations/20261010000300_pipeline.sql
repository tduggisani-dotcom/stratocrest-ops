-- =============================================================================
-- Investors and customers: one set of tables configured by `kind`.
-- See docs/DATA_MODEL.md §3.2 and spec §6.2–§6.3.
-- =============================================================================

create table public.org_stages (
  kind     public.org_kind not null,
  stage    text not null check (stage ~ '^[a-z_]+$'),
  label    text not null,
  position smallint not null,
  outcome  text not null check (outcome in ('open', 'won', 'lost')),
  primary key (kind, stage),
  unique (kind, position)
);
comment on table public.org_stages is 'Pipeline stages per kind, in order. outcome = open | won | lost.';

insert into public.org_stages (kind, stage, label, position, outcome) values
  ('investor', 'identified',     'Identified',     1, 'open'),
  ('investor', 'contacted',      'Contacted',      2, 'open'),
  ('investor', 'meeting',        'Meeting',        3, 'open'),
  ('investor', 'diligence',      'Diligence',      4, 'open'),
  ('investor', 'committed',      'Committed',      5, 'won'),
  ('investor', 'passed',         'Passed',         6, 'lost'),
  ('customer', 'identified',     'Identified',     1, 'open'),
  ('customer', 'contacted',      'Contacted',      2, 'open'),
  ('customer', 'discovery',      'Discovery',      3, 'open'),
  ('customer', 'pilot_proposed', 'Pilot Proposed', 4, 'open'),
  ('customer', 'pilot_active',   'Pilot Active',   5, 'open'),
  ('customer', 'converted',      'Converted',      6, 'won'),
  ('customer', 'lost',           'Lost',           7, 'lost');

create table public.organizations (
  id                      uuid primary key default gen_random_uuid(),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  created_by              uuid references public.actors (id),
  updated_by              uuid references public.actors (id),
  kind                    public.org_kind not null,
  name                    text not null check (btrim(name) <> '' and char_length(name) <= 200),
  stage                   text not null default 'identified',
  subtype                 public.org_subtype,
  owner_id                uuid not null references public.people (id),
  next_step               text not null check (btrim(next_step) <> '' and char_length(next_step) <= 500),
  next_step_date          date not null,
  contact_name            text check (char_length(contact_name) <= 200),
  contact_title           text check (char_length(contact_title) <= 200),
  contact_email           extensions.citext check (contact_email is null or (contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(contact_email) <= 254)),
  contact_phone           text check (char_length(contact_phone) <= 40),
  link                    text check (link is null or (link ~* '^https?://' and char_length(link) <= 2048)),
  city                    text check (char_length(city) <= 120),
  state_or_country        text check (char_length(state_or_country) <= 120),
  region                  public.org_region,
  first_contact_date      date,
  first_contact_method    public.contact_method,
  introduced_by           text check (char_length(introduced_by) <= 200),
  check_size_or_focus     text check (char_length(check_size_or_focus) <= 500),
  last_contact_date       date,
  notes                   text check (char_length(notes) <= 20000),
  key_result_id           uuid references public.key_results (id) on delete set null,
  related_organization_id uuid references public.organizations (id) on delete set null,
  archived_at             timestamptz,
  foreign key (kind, stage) references public.org_stages (kind, stage),
  check (
    subtype is null
    or subtype = 'other'
    or (kind = 'investor' and subtype in ('vc', 'angel', 'grant_program'))
    or (kind = 'customer' and subtype in ('construction_firm', 'hard_hat_manufacturer', 'safety_distributor'))
  ),
  check (related_organization_id is null or related_organization_id <> id)
);
comment on column public.organizations.owner_id is 'The Coatl point of contact. Required (implementation intention).';
comment on column public.organizations.next_step is 'Required concrete next step. With next_step_date this is the org''s follow-up.';
comment on column public.organizations.last_contact_date is 'Moved forward automatically when a meeting is logged; also editable.';
comment on column public.organizations.related_organization_id is 'The same company tracked as the other kind (investor and customer).';

-- No duplicate active investors/customers with the same name (also protects bot creates).
create unique index organizations_kind_name_key on public.organizations (kind, lower(name)) where archived_at is null;
create index organizations_kind_stage_idx on public.organizations (kind, stage) where archived_at is null;
create index organizations_owner_idx on public.organizations (owner_id);
create index organizations_next_step_date_idx on public.organizations (next_step_date) where archived_at is null;
create index organizations_key_result_idx on public.organizations (key_result_id);

create table public.org_meetings (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid references public.actors (id),
  updated_by          uuid references public.actors (id),
  organization_id     uuid not null references public.organizations (id),
  starts_at           timestamptz not null,
  external_attendees  text check (char_length(external_attendees) <= 500),
  rating              smallint check (rating between 1 and 5),
  summary             text check (char_length(summary) <= 200),
  notes               text check (char_length(notes) <= 20000),
  concerns_raised     text check (char_length(concerns_raised) <= 5000),
  materials_requested text check (char_length(materials_requested) <= 5000),
  follow_up_owner_id  uuid references public.people (id),
  follow_up_date      date,
  check ((follow_up_owner_id is null) = (follow_up_date is null))
);
comment on column public.org_meetings.summary is 'One-line "how it went", shown in the tracker table.';
comment on column public.org_meetings.rating is '1–5; empty until the meeting has happened.';
create index org_meetings_org_starts_idx on public.org_meetings (organization_id, starts_at desc);
create index org_meetings_starts_idx on public.org_meetings (starts_at);

create table public.org_meeting_attendees (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid references public.actors (id),
  updated_by     uuid references public.actors (id),
  org_meeting_id uuid not null references public.org_meetings (id) on delete cascade,
  person_id      uuid not null references public.people (id),
  unique (org_meeting_id, person_id)
);
create index org_meeting_attendees_person_idx on public.org_meeting_attendees (person_id);

create table public.hypotheses (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid references public.actors (id),
  updated_by        uuid references public.actors (id),
  organization_id   uuid references public.organizations (id),
  audience          public.org_kind,
  owner_id          uuid references public.people (id),
  statement         text not null check (btrim(statement) <> '' and char_length(statement) <= 1000),
  test_plan         text check (char_length(test_plan) <= 5000),
  success_criterion text check (char_length(success_criterion) <= 2000),
  result            text check (char_length(result) <= 5000),
  learning          text check (char_length(learning) <= 5000),
  decision          public.hypothesis_decision,
  status            public.hypothesis_status not null default 'untested',
  archived_at       timestamptz
);
comment on column public.hypotheses.audience is 'Copied from the linked org''s kind; set by hand when not linked to one org.';
create index hypotheses_org_idx on public.hypotheses (organization_id);
create index hypotheses_status_idx on public.hypotheses (status) where archived_at is null;

-- Keep `audience` in step with the linked organization.
create function app.tg_hypothesis_audience()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.organization_id is not null then
    select o.kind into new.audience from public.organizations o where o.id = new.organization_id;
  end if;
  return new;
end;
$$;

create trigger hypotheses_audience
  before insert or update of organization_id on public.hypotheses
  for each row execute function app.tg_hypothesis_audience();

create table public.hypothesis_tests (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid references public.actors (id),
  updated_by     uuid references public.actors (id),
  hypothesis_id  uuid not null references public.hypotheses (id) on delete cascade,
  org_meeting_id uuid references public.org_meetings (id) on delete set null,
  test_date      date not null,
  outcome        public.test_outcome not null,
  evidence       text not null check (btrim(evidence) <> '' and char_length(evidence) <= 5000)
);
comment on table public.hypothesis_tests is 'Evidence trail: each conversation that tested a hypothesis and what it showed.';
create index hypothesis_tests_hypothesis_idx on public.hypothesis_tests (hypothesis_id, test_date desc);
create index hypothesis_tests_meeting_idx on public.hypothesis_tests (org_meeting_id);
