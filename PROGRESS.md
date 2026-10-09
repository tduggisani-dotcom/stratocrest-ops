# PROGRESS — StratoCrest Ops

_Last updated: 2026-10-09 (Stage 0)_

## Stages

| Stage | Status |
|---|---|
| 0 — Plan | ✅ Done. Waiting on answers to the open questions and "go". |
| 1 — Foundation | ⏭ Next (file outline below) |
| 2 — This Week + Tasks + People basics | — |
| 3 — Investor Tracker → Customer Pipeline + hypothesis roll-up | — |
| 4 — Meetings, Debriefs, Synthe6 timeline | — |
| 5 — OKRs, Checklists, Workload, Wins, Recruiting, Help | — |
| 6 — Bot integration | — |
| 7 — Polish and launch | — |

## Open questions (waiting on the team)

Each one has a default. Replying "go" means "use the defaults".

1. **Sign-in allowlist location (auth; needs your OK).**
   - Spec: the allowlist lives in env/config.
   - Proposal: `TEAM_EMAILS` seeds the six people once. After that, the **people table is the
     allowlist**, so a new teammate (Recruiting → Joined) can be invited from the app without a
     redeploy, and deactivating someone locks them out immediately. Public sign-ups stay off in
     Supabase.
   - *Default: the proposal.*
2. **Sign-in email.** Magic links need an email provider (see `docs/SETUP.md` Part B). Do you own a
   domain, and can someone edit its DNS?
   - *Default: Resend on a sub-domain such as `mail.<your-domain>`.*
3. **Hosting plan and preview links.**
   - Vercel's free Hobby plan is limited by Vercel's terms to non-commercial personal use. An internal
     company tool likely counts as commercial.
   - Options: **Vercel Pro**, $20/month for one seat (teammates don't need Vercel accounts), or Hobby
     at your own risk.
   - Also: do you want a **preview link from Stage 1 on**, so the team can try each stage on their
     phones? That means setting up Vercel in Stage 1 instead of Stage 7.
   - *Default: build as planned. You choose the plan before Stage 7, and there are no preview links
     until then.*
4. **How does the Grok bot run?**
   - Is it code you control that calls xAI's API with tool calling, a no-code tool (n8n, Zapier,
     Make…), or the Grok app itself?
   - Can it send HTTP requests with an `Authorization` header?
   - Does it have a public URL that can receive webhooks?
   - Who maintains it?
   - This decides the shape of Stage 6. *Default: code you control, which can call our API and
     receive webhooks.*
5. **Google.**
   - Which Google account does the bot use: Google Workspace (company domain) or personal Gmail?
   - Is it OK to create a **new** mirror Sheet and a **new** "StratoCrest Ops" calendar, rather than
     writing into the bot's existing ones?
   - *Default: new ones, shared with the bot's account.*
6. **Synthe6 session times.** What time do Wednesday sessions and mentor coaching usually start and
   end (ET)? This affects the countdown and the Calendar events.
   - *Default: shown as all-day until set; times are editable per session.*
7. **Small defaults I picked. Say if any are wrong:**
   - **Facilitator rotation:** follows the spec's team order (John → Taeyoon → Brad → Sam → Ian →
     Tanush), starting with John at the first meeting the app creates. It can be changed per meeting.
   - **A company that's both an investor and a customer** gets two linked records, one per pipeline.
   - **Investor subtypes** stay as in the spec. A corporate or strategic investor goes under "Other"
     unless you want its own subtype.
   - **Archive, not delete:** main records are archived (restorable) instead of deleted.
   - **Automatic debriefs** are only created for events from go-live onward, so there's no backlog on
     day one.
   - **Overload flag:** a person is flagged on the workload grid when their open-item total is
     ≥ 1.5× the team average **and** at least 3 above it.

## Decisions made

| Date | Decision | Why |
|---|---|---|
| 2026-10-09 | Data model refined as listed in `docs/DATA_MODEL.md` §8. **Approval = your "go".** | Real foreign keys, one rule set for UI and bot, concurrency-safe checklists, searchable decisions |
| 2026-10-09 | TypeScript **6.0.3**, not 7.0.2 | typescript-eslint 8.71 supports TS < 6.1 only |
| 2026-10-09 | Scheduled jobs on Supabase **pg_cron / pg_net**, not Vercel Cron | Vercel Hobby cron runs at most once a day |
| 2026-10-09 | `date` for calendar days and `timestamptz` for moments; ET everywhere in the UI | Avoids off-by-one-day bugs from storing days as UTC midnight |
| 2026-10-09 | Stored values in `snake_case`, labels in `src/lib/labels.ts` | Stable bot API; labels can change freely |
| 2026-10-09 | Magic link **plus a 6-digit code**; `/auth/confirm` needs a button press | Phones open links in another browser; email scanners use up links |
| 2026-10-09 | Two Supabase projects (dev, prod) in `us-east-1`; Vercel `iad1` | Keep test data away from real data; low latency from Ohio |
| 2026-10-09 | Database migrations applied by **GitHub Actions**: dev on branch pushes, prod on `main` | This cloud environment can't open Postgres connections; it's also simpler for a non-specialist |
| 2026-10-09 | pnpm; extra libraries as listed in `docs/ARCHITECTURE.md` §1 (each with a reason) | Spec §4: state why before adding |
| 2026-10-09 | DB tests run on a throwaway local Postgres with a minimal `auth` stand-in | Lets RLS and triggers be tested in CI and cloud sessions without Supabase access |

## Known issues and risks

- **This cloud environment blocks `supabase.co`** (proxy returns 403), so I can't run the app or
  end-to-end tests against the dev project from here. Fix: `docs/SETUP.md` A4. Database tests still
  run locally.
- **No Docker daemon here**, so there is no local Supabase stack. Postgres 16 is installed for DB
  tests. Supabase runs Postgres 17, so avoid features that only exist in 17.
- **Vercel Hobby terms** (open question 3).
- **Supabase free plan:** pauses after 7 idle days (daily use and the 15-minute sync keep it awake),
  and has no automatic backups. Decide on a weekly backup in Stage 7.
- **next 16.4.0 is days old.** If it misbehaves, pin 16.3.8 and note it here.

## Next steps

**You:**

1. Answer the open questions above (or reply "go" to accept the defaults).
2. Do `docs/SETUP.md` **Part A** (Supabase, access token, GitHub secrets, cloud environment access,
   `TEAM_EMAILS`).
3. Start Part B (email domain) if you can.

**Stage 1 plan (files to create):**

- **Tooling:**
  - `package.json`, `pnpm-lock.yaml`, `tsconfig.json` (strict), `next.config.ts`,
    `eslint.config.mjs`, `postcss.config.mjs`, `components.json`
  - `vitest.config.ts`, `playwright.config.ts`
  - `.gitignore`, `.env.example`
  - `.github/workflows/ci.yml` (typecheck, lint, unit, DB tests) and `.github/workflows/db-migrate.yml`
- **Database:**
  - `supabase/config.toml`
  - `supabase/migrations/`:
    1. extensions + `app` helper functions (today_et, actor resolution, is_team_member)
    2. enums + reference data (`org_stages`)
    3. people, actors, availability, crunch periods
    4. orgs, meetings, hypotheses
    5. tasks + OKRs
    6. program, Sunday meetings, decisions, action items, debriefs
    7. checklists, candidates, help, feedback, usage events, app_settings
    8. activity_log + common/audit triggers
    9. RLS policies
    10. views
    11. pg_cron `run_scheduled_checks`
  - Stage 6 tables come in a later migration.
- **Auth:**
  - `src/proxy.ts`
  - `src/lib/supabase/{server,browser,admin}.ts`, `src/lib/auth.ts`
  - `src/app/(auth)/sign-in/`, `src/app/auth/confirm/`
- **Shell:**
  - `src/app/layout.tsx`, `globals.css` (tokens, light/dark)
  - `src/app/(app)/layout.tsx`
  - `src/components/shell/` (sidebar, bottom nav, theme toggle)
  - `src/components/common/{PersonChip,EmptyState}.tsx`
  - A placeholder page with an empty state for each section
- **Libraries:**
  - `src/lib/dates.ts`, `src/lib/labels.ts`
  - `src/lib/schemas/` (people, enums)
  - `src/types/database.ts`
- **Seeds:**
  - `scripts/seed.ts` with data files for the Synthe6 schedule (53 rows), quarters, and four starter
    checklist templates
  - `scripts/seed-demo.ts` (guarded, dev only)
- **Tests:**
  - Unit: dates (DST), labels, `TEAM_EMAILS` parsing, seed data matches spec §11
  - DB: migrations apply; RLS; actor and audit triggers; required-field constraints
  - E2E: sign-in page and app shell at desktop and 390 px
