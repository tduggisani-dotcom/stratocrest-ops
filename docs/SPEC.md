# StratoCrest Ops — Master Build Spec

> **How to use this file:** Save it as `docs/SPEC.md` in an empty project folder, open Claude Code there, and send:
> "Read docs/SPEC.md fully. Follow the Working Rules. Start with Stage 0."

---

## 1. Mission

Build **StratoCrest Ops**, a private, people-first web app where the six-person StratoCrest team runs everything: Synthe6 program milestones, the investor tracker, the customer and pilot pipeline, tasks, OKRs, Sunday meetings, debriefs, checklists, and the team itself. It must also be easy for our Grok-based AI Chief of Staff bot to read from and write to.

**Success means:** within two weeks of launch, the team stops tracking investors, tasks, and meeting notes in texts and spreadsheets, and every investor and customer has an owner, a next step, and a date.

---

## 2. Context

- **Company:** StratoCrest, operating as Coatl Composites (Delaware). Product: Coatl, a bio-based aerogel/starch composite liner for construction hard hats.
- **Program:** Synthe6 Materials Accelerator, cohort 2 (Bounce Innovation Hub / Polymer Industry Cluster, Akron, OH). The program runs Oct 2026 – Oct 2027. Full schedule in §11.
- **Core problem:** information is scattered across texts, emails, and people's heads. We're behind other cohort teams on investors and customer acquisition.
- **Team (all users; everyone can view and edit):**
  | Name | Role |
  |---|---|
  | John LaRocco | CEO |
  | Taeyoon Eom | CTO |
  | Brad Hall | COO |
  | Sam Browning | CFO |
  | Ian Zalcberg | IT Director |
  | Tanush | R&D Lead |
- Most of the team are students with classes and jobs. The app must be fast on phones.
- **Team meeting:** every Sunday at 9:00 AM ET. **Time zone for everything:** America/New_York.
- **Existing tooling:** a Grok Chief of Staff bot that uses Google Sheets, Drive, and Calendar as its records layer.

---

## 3. Product principles (evidence-based; these drive features, not just copy)

1. **People first.** Every screen answers "what do I need to do?" and "who can I ask?" before "what's the project status?" Every item shows its owner's avatar and name.
2. **Outreach as hypothesis testing** (Camuffo et al., *Management Science* RCT). Every investor and customer conversation records what we believe, how we're testing it, and what we learned.
3. **Debrief everything that matters** (Tannenbaum & Cerasoli 2013 meta-analysis: ~20–25% performance gain, strongest when team-focused and facilitated).
4. **Specific, hard goals** (Locke & Latham). Quarterly OKRs tied to Synthe6 share-outs.
5. **Implementation intentions** (Gollwitzer & Sheeran 2006, d = 0.65). No task, investor, or customer is saved without ONE owner, a concrete next step, and a date.
6. **Checklists for recurring high-stakes events** (adapted from the WHO surgical checklist).
7. **Tighter meetings** (Rogelberg). Written updates before the meeting, so the meeting itself goes to decisions.

---

## 4. Tech stack (decided — push back in Stage 0 only if something is a real problem)

- **Framework:** Next.js (App Router) + TypeScript (strict mode)
- **UI:** Tailwind CSS + shadcn/ui; lucide-react icons; light and dark mode
- **Backend / DB / Auth:** Supabase (Postgres, Auth with email magic links, Row Level Security, Realtime for live updates)
- **Validation:** Zod schemas shared between forms and API routes
- **Data fetching:** server components + server actions for the UI; route handlers under `/api/v1` for the bot API
- **Testing:** Vitest (unit), Playwright (end-to-end smoke tests, including a mobile viewport)
- **Hosting:** Vercel (free tier) + Supabase (free tier)
- **Google integration:** Google service account for Sheets and Calendar (Stage 6)
- **Dates:** store as UTC `timestamptz`; display and accept input in America/New_York

Use exact, current stable versions. Don't add other libraries without stating why.

---

## 5. Data model (starting point — refine in Stage 0, then keep the migrations as the source of truth)

All tables: `id uuid pk`, `created_at`, `updated_at`, `created_by` (person or bot), `updated_by`.

- **people** — name, role, email, avatar_url, contact_preference, strengths (text[]; CliftonStrengths top 5), skills (text[]), is_active
- **availability_blocks** — person_id, weekday, start_time, end_time, label (class/work/other); **crunch_periods** — person_id, start_date, end_date, label
- **organizations** — kind (`investor` | `customer`), name, contact_name, contact_title, link, city, region (`Ohio` | `Midwest` | `Rest of US` | `International`), state_or_country, subtype (VC / angel / grant program / construction firm / hard hat manufacturer / safety distributor / other), stage, owner_id (required), first_contact_date, first_contact_method (cold email / warm intro / Synthe6 event / conference / other), introduced_by, check_size_or_focus, next_step (required), next_step_date (required), last_contact_date, notes, key_result_id (nullable)
  - investor stages: Identified → Contacted → Meeting → Diligence → Committed / Passed
  - customer stages: Identified → Contacted → Discovery → Pilot Proposed → Pilot Active → Converted / Lost
- **org_meetings** — organization_id, starts_at, attendees (person ids), rating (1–5, nullable until it happens), summary, concerns_raised, materials_requested, follow_up_owner_id, follow_up_date
- **hypotheses** — organization_id (nullable), statement, test_plan, success_criterion, result, learning, decision (`Persevere` | `Pivot` | `Drop` | null), status (`Untested` | `Validated` | `Invalidated`)
- **tasks** — title, owner_id (required), due_date (required), next_action (required), status (`To Do` | `In Progress` | `Blocked` | `Done`), priority, links: key_result_id / session_id / organization_id / meeting_id (all nullable), completed_at
- **objectives** — quarter label, title, owner_id; **key_results** — objective_id, title, target_value, current_value, unit, owner_id
- **synthe6_sessions** — week_label, date (or date range), format, activity_type, topic, is_break, owner_id (nullable), notes, deliverables
- **team_meetings** — date, facilitator_id, decisions (jsonb list), notes; **meeting_updates** — team_meeting_id, person_id, done_last_week, doing_this_week, blocked_on, decision_needed
- **debriefs** — kind (synthe6 / mentor / investor / customer / team_meeting), linked id, planned, actual, worked, change, facilitator_id, status (`Due` | `Done`)
- **checklist_templates** — name, items (jsonb); **checklists** — template_id, linked type + id, items with done state
- **candidates** — name, role_sought, source, stage (Sourced → Intro call → Trial project → Offer → Joined / Passed), owner_id, notes
- **help_requests** — requester_id, linked type + id, message, resolved_by, resolved_at
- **activity_log** — actor_type (`person` | `bot`), actor_id, action, entity type + id, before/after (jsonb). This powers the audit trail, the wins feed, and undo.
- **api_keys** — name, hashed_key, scope (`read` | `read_write`), created_by, last_used_at, revoked_at
- **webhooks** — url, events (text[]), secret, is_active; **feedback** — person_id, page_path, message

Enforce required fields both in the DB (NOT NULL / CHECK constraints) and in the UI (Zod, with clear inline messages).

---

## 6. Features and acceptance criteria

### 6.1 This Week (home)
- Next Synthe6 session (date, format, topic, countdown)
- Next Sunday meeting: facilitator, plus who has and hasn't posted their pre-meeting update
- Investor and customer meetings in the next 7 days
- **My work:** the signed-in person's open tasks, follow-ups, and debriefs due
- **Needs attention:** overdue tasks, overdue follow-ups, orgs with no contact in 14+ days, debriefs due, open help requests
- Current-quarter OKR progress bars
- ✅ Done when: a new user sees a useful page with empty states that explain how to add the first item, and a user with data sees their own items first.

### 6.2 Investor Tracker (highest priority after the foundation)
- Default view: a sortable, filterable table with these columns up front: **Company | Location | First contact | Meeting date (latest and next) | Coatl point of contact | How it went (latest 1–5 rating, color-coded, plus a one-line summary)**
- Filters: stage, owner, region, rating, stale (14+ days)
- Summary bar: total, count per stage, meetings this month, average rating, follow-ups due this week
- Kanban by stage as a secondary view, with drag to change stage
- Detail page: contact info, meeting log (chronological), hypothesis log, linked tasks, debriefs, activity history
- Logging a meeting takes **≤ 2 screens** and then prompts a debrief and a follow-up task (one click)
- CSV export of the current filtered view
- On phones the table becomes cards that show company, location, meeting date, point of contact, and rating
- ✅ Done when: you can add an investor, log two meetings with ratings, see the latest one in the table, filter by region, export CSV, and the whole flow works at 390 px width.

### 6.3 Customer & Pilot Pipeline
- Same structure and components as 6.2 (reuse them; don't duplicate code), with customer subtypes and stages
- Hypothesis roll-up page across all investors and customers: Untested / Validated / Invalidated

### 6.4 Tasks
- Create with required owner, due date, and next action. Optional links to a key result, session, org, or meeting
- Views: My tasks, by owner, by status, due this week. Quick status change inline
- Warn (not block) when the due date falls inside the owner's crunch period

### 6.5 Synthe6 Program
- Timeline of all sessions (seeded from §11); past ones dimmed, the next one highlighted; break weeks greyed out
- Emphasize OKR share-outs (W5, W10, W22, W35), mentor coaching, and Demo Day prep (W38–W43)
- Each session: owner, notes, deliverables, an attached prep checklist, and a debrief (auto-marked Due the day after)

### 6.6 Meetings & Decisions
- Auto-create the next Sunday meeting. Facilitator rotates through active people in order
- Pre-meeting update form (done / doing / blocked / decision needed). The agenda is built from "decision needed" items
- Record decisions and action items. Action items become tasks in one click
- Searchable decision log

### 6.7 Debriefs
- One template: What was planned? What happened? What worked? What will we change? Action items → tasks
- Auto-created as Due after Synthe6 sessions, org meetings, and team meetings. A list view filterable by kind and status

### 6.8 OKRs
- Quarters follow Synthe6's own labels: goals are set at W2 (2026-10-14) and first shared at W5 (2026-11-04); **Q1** runs to the Q1 share-out at W10 (2027-01-13), **Q2** to W22 (2027-04-07), **Q3** to W35 (2027-07-07), and **Q4** to graduation at W47 (2027-09-29)
- 2–4 key results per objective, each with a numeric target and current value
- "Share-out view": a clean one-page summary per quarter

### 6.9 Checklists
- Seed editable starter templates: Investor meeting prep, Grant submission, Mentor session prep, Demo Day rehearsal
- Attach to any session, org, or task, and tick items off

### 6.10 People
- Profile: role, avatar, ownership (orgs, key results, open tasks), CliftonStrengths, skills, contact preference, availability blocks, crunch periods
- Workload grid: open tasks, upcoming meetings, and overdue items per person. Flag anyone well above the team average
- Wins feed from `activity_log` (completed tasks, stage advances, ratings ≥ 4)
- Recruiting tracker (candidates). Moving to "Joined" creates a profile and an onboarding checklist
- "Ask for help" on any item → appears on This Week for everyone

### 6.11 Grok bot integration
- **REST API** at `/api/v1` for every main object: list (with filters + pagination), get, create, update. JSON, stable UUIDs, ISO 8601 dates
- **OpenAPI 3.1 spec** generated from the Zod schemas, served at `/api/v1/openapi.json`, usable directly as Grok function-calling tool definitions
- **Summary endpoints** returning compact JSON for one-call bot reads: `/api/v1/summary/this-week`, `/summary/person/{id}`, `/summary/investors`, `/summary/overdue`, `/summary/meeting-prep`
- **Auth:** bearer API keys, one per bot, created and revoked in Settings (shown once, stored hashed). Scope read or read_write
- **Audit:** bot changes are logged as `actor_type = bot`, shown with a "via Grok" tag, and can be undone by a person
- **Webhooks:** signed (HMAC) POSTs for: org.created, org.stage_changed, org_meeting.logged, task.overdue, help_request.created, debrief.due. Retries with backoff and a delivery log in Settings
- **Quick capture:** `POST /api/v1/capture` takes plain text (plus optional structured fields the bot parsed). It's saved as a **draft** that a person must confirm in the app before it becomes a real record
- **Google mirror:** scheduled one-way export (e.g., every 15 minutes, via Vercel Cron) of investors, customers, tasks, and people to a Google Sheet, one tab each. Push Synthe6 sessions, Sunday meetings, and org meetings to a shared Google Calendar. The app is the source of truth
- Rate limiting and Zod validation on every API route
- `docs/BOT_INTEGRATION.md`: auth, endpoints, webhook payloads, and 3 example Grok tool definitions

---

## 7. Non-functional requirements

- **Access:** only the six team emails (allowlist in env/config) can sign in. RLS on every table; the service role key is never exposed to the client
- **Mobile-first:** every page works at 390 px with no horizontal scroll. Tap targets ≥ 44 px
- **Accessibility:** WCAG 2.1 AA contrast, keyboard navigation, visible focus, labels on all inputs
- **Performance:** home page interactive in under 2 s on a mid-range phone over 4G
- **Live updates:** changes by one teammate appear for others without a reload (Supabase Realtime)
- **Design:** clean, calm ops tool. Not a marketing site. Consistent spacing, a single accent color, semantic colors only for status (overdue = red, stale = amber, strong rating = green)
- **Empty states:** every list explains what goes there and has a button to add the first item
- **Feedback loop for post-launch UX work:** a "Send feedback" button on every page (saves the page path), plus lightweight first-party usage analytics (page and feature views per section; no third-party ad trackers)
- **No fake data in production.** Seed only the Synthe6 schedule, the six people, and the checklist templates. A separate `seed:demo` script may create clearly labeled example data for local development only

---

## 8. Build plan

Work through these stages in order. **At the end of every stage:** run typecheck, lint, and tests; fix failures; update `PROGRESS.md`; commit with a clear message; then give me a short summary of what was built, what to try, and anything I need to do. **Wait for my "go" before starting the next stage.**

- **Stage 0 — Plan (no code).** Read this spec. Reply with: (a) any questions that would change the build, (b) the final data model, (c) the folder structure, (d) the accounts and keys I need to create, with step-by-step instructions. Create `CLAUDE.md` (project conventions, commands, and rules from §9) and `PROGRESS.md`.
- **Stage 1 — Foundation.** Next.js app, Supabase schema + migrations + RLS, magic-link auth with the email allowlist, app shell with navigation (sidebar on desktop, bottom nav on mobile), light/dark mode, seed script (people, Synthe6 schedule, checklist templates), activity_log plumbing.
- **Stage 2 — This Week + Tasks + People basics** (profiles, availability, crunch periods).
- **Stage 3 — Investor Tracker** (all of 6.2), then **Customer Pipeline** and the hypothesis roll-up (6.3).
- **Stage 4 — Meetings, Debriefs, Synthe6 timeline** (6.5–6.7).
- **Stage 5 — OKRs, Checklists, Workload grid, Wins feed, Recruiting, Help requests.**
- **Stage 6 — Bot integration** (all of 6.11).
- **Stage 7 — Polish and launch.** Accessibility pass, mobile pass, empty states, error states, feedback button + analytics, Playwright smoke tests for the core flows, Vercel deploy, and a README with setup, deploy, inviting teammates, and a one-paragraph "how we use this" guide.

---

## 9. Working rules for Claude Code

1. **Plan before coding.** For each stage, outline the files you'll create or change before writing them.
2. **Ask, don't guess,** when a decision would be expensive to undo (schema shape, auth, external services). For small UI choices, decide and note it in `PROGRESS.md`.
3. **Verify your own work.** Run the dev server and the tests. For UI work, check both desktop and 390 px mobile. Don't report a stage done with failing checks.
4. **Keep context durable.** `PROGRESS.md` lists finished stages, decisions made, known issues, and next steps, so a fresh session can pick up where you left off. Keep `CLAUDE.md` short and current.
5. **Secrets:** use `.env.local` and `.env.example`; never commit keys; never put the Supabase service role key or Google credentials in client code.
6. **Reuse components.** The investor and customer views share one set of components configured by `kind`.
7. **Small, reviewable commits,** one per logical change.
8. **Don't invent business data.** No made-up investors, customers, tasks, or numbers outside the dev-only demo seed.
9. **Explain setup steps for a non-specialist.** I'm comfortable following instructions, but spell out exactly where to click and what to paste.

---

## 10. Out of scope for this build (document as future options)

Two-way Google Sheets sync, native mobile apps, email/SMS notifications (beyond webhooks), file uploads and a data room, and multi-company support.

---

## 11. Seed data — Synthe6 Cohort 2 schedule (all Wednesdays unless noted)

| Week | Date | Format | Type | Topic |
|---|---|---|---|---|
| W1 | 2026-10-07 | In-person | Workshop | Kickoff + Readiness Levels + Cohort Introductions (PIC overview) |
| W2 | 2026-10-14 | Virtual | Workshop | Goal Setting & OKRs + CliftonStrengths |
| W3 | 2026-10-19 to 2026-10-23 | Virtual / individually scheduled | Startup 360 Reviews | Startup 360 Assessments |
| W4 | 2026-10-28 | Mentor Coaching | Lead Mentor Coaching | — |
| W5 | 2026-11-04 | In-person | Workshop | OKR Share-out + Time & Team Management & Coachability + Running Mentor Meeting |
| — | 2026-11-11 | No meeting | Veterans Day / off week | — |
| W6 | 2026-11-18 | Virtual | Workshop | Quantified Value Proposition, Competitive Analysis & Pilot Targets |
| — | 2026-11-25 | No meeting | Thanksgiving break | — |
| W7 | 2026-12-02 | Virtual | Workshop | Grant Strategy, Funding Fit, Application Narrative Basics |
| W8 | 2026-12-09 | Mentor Coaching | Lead Mentor Coaching | — |
| W9 | 2026-12-16 | In-person | Workshop | Branding Basics + One Page Summaries + Pitch Decks |
| — | 2026-12-23 | No meeting | Holiday break | — |
| — | 2026-12-30 | No meeting | Holiday break | — |
| — | 2027-01-06 | No meeting | Holiday break | — |
| W10 | 2027-01-13 | Virtual | Workshop | Q1 OKR Share-out + Prioritization & Pivoting |
| W11 | 2027-01-20 | Virtual | Workshop | Sales, Outreach, Pipelines & Pilot Advancement |
| W12 | 2027-01-27 | Mentor Coaching | Lead Mentor Coaching | — |
| W13 | 2027-02-03 | In-person | Workshop | Business Model, Pricing & Financial Model |
| W14 | 2027-02-10 | Virtual | Workshop + Panel | Intellectual Property Strategy + IP Panel |
| W15 | 2027-02-17 | Virtual | Workshop | Grant Application Development |
| W16 | 2027-02-24 | Mentor Coaching | Lead Mentor Coaching | — |
| W17 | 2027-03-03 | In-person | Workshop | Capital Strategy + Boards, Advisors & Investors |
| W18 | 2027-03-10 | Virtual | Workshop | Investor Research & Outreach + Pitch Deck Clean |
| W19 | 2027-03-17 | Virtual | Workshop + Panel | Corporate Pilots & Partnerships Panel + Negotiation |
| W20 | 2027-03-24 | Mentor Coaching | Lead Mentor Coaching | — |
| W21 | 2027-03-31 | In-person | Workshop | Manufacturing Scale-Up Planning, Regulatory Considerations & Technical Validation |
| W22 | 2027-04-07 | Virtual | Workshop | Q2 OKR Share-out + One Page Summary Refresh (evidence, traction, milestones) |
| W23 | 2027-04-14 | Virtual | Workshop | Grant Submission, Reviewer Feedback, Future Opportunities & Financial Planning |
| W24 | 2027-04-21 | Mentor Coaching | Lead Mentor Coaching | — |
| W25 | 2027-04-28 | In-person | Workshop | Pilot Conversion, Contracts, & Strategic Partnerships |
| W26 | 2027-05-05 | Virtual | Workshop | Qualifying Vendors, Supply Chain & Scale-Up |
| W27 | 2027-05-12 | Virtual | Workshop + Panel | Manufacturing & Supply Chain Panel + Problem Solving |
| W28 | 2027-05-19 | Mentor Coaching | Lead Mentor Coaching | — |
| W29 | 2027-05-26 | In-person | Workshop | Investment: Due Diligence + Data Room |
| W30 | 2027-06-02 | Virtual | Workshop | Pitch Deck clean up + Executive Presence |
| W31 | 2027-06-09 | Virtual | Workshop | Customer Economics, Segmentation, & GTM and Growth Strategy |
| W32 | 2027-06-16 | Mentor Coaching | Lead Mentor Coaching | — |
| W33 | 2027-06-23 | In-person | Workshop | Company Culture + Emotional Intelligence |
| W34 | 2027-06-30 | Virtual | Workshop | Hiring, Contractors & Building the Team |
| W35 | 2027-07-07 | Virtual | Workshop | Q3 OKR Share-out + Exit Strategies |
| W36 | 2027-07-14 | Mentor Coaching | Lead Mentor Coaching | — |
| W37 | 2027-07-21 | In-person | Workshop | Boilerplate and Media Training + LinkedIn Operations |
| W38 | 2027-07-28 | Virtual | Workshop | Investor Q&A + Demo Day Pitch Practice |
| W39 | 2027-08-04 | Virtual | Workshop + Panel | Investor / Diligence Panel + Website Feedback |
| W40 | 2027-08-11 | Mentor Coaching | Lead Mentor Coaching | — |
| W41 | 2027-08-18 | In-person | Workshop | Full Demo Day Pitch Rehearsal |
| W42 | 2027-08-25 | Virtual | Workshop | Demo Day Pitch/Q&A Practice |
| W43 | 2027-09-01 | Virtual | Workshop | Demo Day Strategy & Follow-up |
| W44 | 2027-09-08 | Mentor Coaching | Lead Mentor Coaching | — |
| W45 | 2027-09-15 | Virtual | Workshop | Demo Day Debrief + Final Readiness Assessment |
| W46 | 2027-09-22 | Virtual | Workshop | Demo Day Follow-up: Investors, Customers & Pilots |
| W47 | 2027-09-29 | In-person | Workshop | Post-Synthe6 Roadmap, Graduation |
| W48 | 2027-10-06 | Mentor Coaching | Lead Mentor Coaching | — |
