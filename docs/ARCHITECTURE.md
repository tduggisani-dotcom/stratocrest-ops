# StratoCrest Ops — Architecture (Stage 0 plan)

Companion to `docs/SPEC.md` (what to build) and `docs/DATA_MODEL.md` (the tables).

---

## 1. Stack, versions, and where the spec's stack needed adjusting

Versions were checked on npm on 2026-10-09. They are pinned exactly in `package.json` at install
time (Stage 1). If a release turns out to be broken, we drop to the newest earlier patch and record
it in `PROGRESS.md`.

| Package | Version | Why it's here |
|---|---|---|
| next | 16.4.0 | Framework (App Router). Released 2026-10-06; fallback is 16.3.8. |
| react, react-dom | 19.3.0 | |
| typescript | **6.0.3** | ⚠️ Not the newest (7.0.2). `typescript-eslint` 8.71 only supports TS < 6.1, so TS 7 would break linting. Move to 7 when typescript-eslint supports it. |
| tailwindcss | 4.3.3 | Styling (v4: config in CSS, no `tailwind.config.js`) |
| shadcn (CLI) | 4.21.4 | Copies accessible UI components into `src/components/ui` |
| lucide-react | 1.54.0 | Icons |
| @supabase/supabase-js, @supabase/ssr | 2.117.3, 0.12.7 | Database and auth client; `ssr` stores the session in cookies for server components |
| supabase (CLI, dev only) | 2.120.0 | Migrations, type generation |
| zod | 4.6.5 | Validation shared by forms, server actions, API, and OpenAPI |
| vitest, @playwright/test | 5.0.3, 1.64.0 | Unit/DB tests, end-to-end tests |
| eslint, eslint-config-next | **9.39.5**, 16.4.0 | Linting (Next 16 removed `next lint`; we call ESLint directly). ⚠️ ESLint 10 is newer, but the React/a11y/import plugins inside eslint-config-next don't support it yet. |
| prettier | 3.x (pinned) | Formatting, including the generated database types |

Small libraries I plan to add, each for a reason the spec's stack doesn't cover:

| Package | Stage | Reason |
|---|---|---|
| @date-fns/tz | 1 | Converting an ET wall-clock time to a moment, across daylight-saving changes. Formatting uses the built-in `Intl` API. |
| server-only | 1 | Build error if a server-only module (secret keys) is ever imported into browser code |
| radix-ui, class-variance-authority, clsx, tailwind-merge, tw-animate-css | 1 | What the shadcn components are built on |
| sonner | 1 | Toast messages; this is shadcn's toast component |
| pg (dev) | 1 | Database tests talk to Postgres directly to simulate each role |
| react-hook-form + @hookform/resolvers | 2 | Inline errors as you type, using the same Zod schema the server uses |
| @tanstack/react-table (v8) | 3 | Sorting and filtering logic for the tracker table (shadcn's data-table pattern) |
| @dnd-kit/core | 3 | Kanban drag and drop that also works by keyboard (accessibility) |
| @asteasolutions/zod-to-openapi | 6 | Generates the OpenAPI 3.1 spec from our Zod schemas |
| @googleapis/sheets + @googleapis/calendar | 6 | Official Google clients; much smaller than the full `googleapis` package |

Package manager: **pnpm** (fast, strict, supported by Vercel).

Changes made while building Stage 1:

- **No next-themes.** The Next 16 docs recommend a tiny inline script that applies the theme before
  first paint (`src/components/theme/`).
- **No date-fns.** `Intl.DateTimeFormat` with `timeZone: "America/New_York"` covers formatting.
- **shadcn components were copied from the shadcn GitHub repo** (new-york-v4, Radix) because this
  environment blocks `ui.shadcn.com`. `components.json` is in place, so the shadcn CLI works
  wherever that site is reachable.

### Stack adjustments (pushback, as allowed in spec §4)

1. **Scheduled jobs run in Supabase, not Vercel Cron.** Vercel's free Hobby plan only allows cron
   jobs that run **once a day**. A 15-minute Google mirror, webhook retries, and overdue checks would
   fail to deploy. Supabase includes `pg_cron` (scheduler) and `pg_net` (outbound HTTP) on the free
   plan. Database-only jobs run as SQL. Jobs that need Node (Google APIs, sending webhooks) call
   private app routes protected by `CRON_SECRET`.
2. **Vercel Hobby is for non-commercial personal use only** (Vercel's fair-use terms). An internal
   tool for a company likely counts as commercial. This is a decision for you (see `PROGRESS.md` →
   Open questions). Nothing in the code depends on it.
3. **Supabase's built-in email can't serve the team.** It sends only a couple of emails per hour, and
   only to addresses on the Supabase org. Magic links need a real email provider (custom SMTP). The
   plan is Resend's free tier; see `docs/SETUP.md`.
4. **Next.js 16 renamed `middleware.ts` to `proxy.ts`.** The folder structure below uses the new name.
5. **Supabase free tier:** a project pauses after 7 days with no activity (daily team use prevents
   this; resuming is one click with no data lost), and there are no automatic backups. The Google
   Sheet mirror is a partial copy. A weekly backup job is a Stage 7 decision.

## 2. Folder structure

```
stratocrest-ops/
├── CLAUDE.md                       # conventions and commands for Claude Code (short)
├── PROGRESS.md                     # stages done, decisions, known issues, next steps
├── README.md                       # setup, deploy, inviting teammates, how we use this (Stage 7)
├── .env.example                    # every variable name, no values (Stage 1)
├── docs/
│   ├── SPEC.md  DATA_MODEL.md  ARCHITECTURE.md  SETUP.md
│   └── BOT_INTEGRATION.md          # Stage 6
├── .github/workflows/ci.yml        # typecheck, lint, unit + DB tests on every push
├── supabase/
│   ├── config.toml
│   └── migrations/                 # SOURCE OF TRUTH: tables, RLS, triggers, views, pg_cron jobs
├── scripts/
│   ├── seed.ts                     # people, Synthe6 schedule, quarters, checklist templates (idempotent)
│   └── seed-demo.ts                # dev-only "[DEMO]" data; refuses to run against production
├── tests/
│   ├── db/                         # migrations + RLS + triggers against a throwaway local Postgres
│   └── e2e/                        # Playwright: desktop and 390 px mobile projects
└── src/
    ├── proxy.ts                    # refreshes the session cookie; sends signed-out visitors to /sign-in
    ├── app/
    │   ├── layout.tsx  globals.css  # theme tokens: one accent color + status colors
    │   ├── (auth)/sign-in/  auth/confirm/
    │   ├── (app)/                  # signed-in area: app shell (desktop sidebar, mobile bottom nav)
    │   │   ├── page.tsx            # This Week (home)
    │   │   ├── investors/          # table · board · [id] — thin pages that render features/orgs with kind="investor"
    │   │   ├── customers/          # same components, kind="customer"
    │   │   ├── hypotheses/         # roll-up across both
    │   │   ├── tasks/
    │   │   ├── program/            # Synthe6 timeline · [id]
    │   │   ├── meetings/           # Sunday meetings · [id] · decisions/
    │   │   ├── debriefs/
    │   │   ├── okrs/               # · [quarter]/share-out
    │   │   ├── checklists/
    │   │   ├── people/             # · [id] · workload/ · wins/ · recruiting/
    │   │   ├── inbox/              # bot capture drafts waiting for a person to confirm
    │   │   └── settings/           # API keys · webhooks + delivery log · integrations · activity log
    │   └── api/
    │       ├── v1/                 # bot REST API, openapi.json, summary/*, capture (Stage 6)
    │       └── internal/           # called only by pg_cron with CRON_SECRET: webhook dispatch, Google sync
    ├── features/                   # one folder per feature: queries.ts, actions.ts, components/
    │   ├── orgs/                   # ONE implementation for investors + customers; kind-config.ts holds the differences
    │   ├── this-week/  tasks/  people/  program/  meetings/  debriefs/
    │   └── okrs/  checklists/  recruiting/  help/  activity/  capture/
    ├── components/
    │   ├── ui/                     # shadcn components (generated, lightly edited)
    │   ├── shell/                  # sidebar, bottom nav, theme toggle, "Send feedback" button
    │   └── common/                 # PersonChip (avatar + name), EmptyState, RatingBadge, DateText, OwnerPicker
    ├── lib/
    │   ├── supabase/               # server.ts, browser.ts, admin.ts (server-only, secret key)
    │   ├── schemas/                # Zod schemas, the single source for forms, actions, API, OpenAPI
    │   ├── auth.ts                 # requireTeamMember(), allowlist checks
    │   ├── dates.ts                # ET helpers: todayET(), formatting, parsing form input
    │   ├── labels.ts               # snake_case value → display label
    │   ├── api/                    # bearer auth, rate limit, errors, pagination, OpenAPI registry (Stage 6)
    │   ├── webhooks/  google/      # Stage 6
    │   └── analytics.ts            # first-party page/feature events (Stage 7)
    └── types/database.ts           # generated from the database (`pnpm db:types`)
```

Unit tests sit next to the code they test (`*.test.ts`).

## 3. Sign-in and access

- **Magic link with a code.** Supabase Auth emails both a link and a 6-digit code. The code matters
  on phones: a home-screen app often opens email links in a different browser, and typing the code
  avoids that problem.
- **Link scanners.** The link goes to `/auth/confirm`, which shows a "Sign in" button rather than
  signing in on page load. Corporate and school email scanners that open links automatically can't
  use up the link.
- **Who can sign in.** Public sign-ups are **turned off** in Supabase. `pnpm seed` creates the six
  logins from `TEAM_EMAILS`. The sign-in form only sends a code to an active person's email.
  - **Proposed change from the spec (needs your OK):** after the first seed, the `people` table *is*
    the allowlist. Adding a teammate (People → Add, or Recruiting → "Joined") creates their profile
    and login without a redeploy. Deactivating someone blocks them immediately.
- **Defense in depth:** `proxy.ts` redirects signed-out visitors. Every server page calls
  `requireTeamMember()`. Row Level Security is the final guard (`docs/DATA_MODEL.md` §6).
- **Secret key:** the Supabase secret key and Google credentials are only imported from
  `server-only` modules.

## 4. How writes flow (one set of rules for people and the bot)

```
Person → form (Zod) → server action (Zod again) → Supabase as the person (RLS) ─┐
                                                                                ├─► tables → triggers:
Grok → /api/v1 (key, scope, rate limit, Zod) → Supabase with the server key    ─┘   who did it · audit log ·
         + the bot's actor id in a header                                             webhooks · debriefs
```

- Business rules that must hold no matter who writes live in Postgres triggers. See the list in
  `docs/DATA_MODEL.md` §5.
- **Undo:** each activity-log entry can be reversed by a person. An insert is archived, an update has
  its `before` values restored, and an archive is restored. The undo is logged with `undo_of`. If the
  record has changed since, the app shows what changed and asks before overwriting.
- **Steps that must happen together** run as single Postgres functions, for example "create an
  objective with its 2–4 key results" and "convert an action item into a task".

## 5. Scheduled jobs

Supabase `pg_cron` jobs, created by a migration:

| Job | Schedule | Runs |
|---|---|---|
| `run_scheduled_checks` | every 15 min | SQL: next Sunday meeting with the rotating facilitator, due debriefs, `task.overdue`, `debrief.due`, cleanup |
| webhook dispatch | every minute (only if deliveries are waiting) | `pg_net` → `POST /api/internal/webhooks/dispatch` |
| Google sync | every 15 min | `pg_net` → `POST /api/internal/google/sync` (Sheets mirror and Calendar push) |

The app URL and `CRON_SECRET` are stored in Supabase Vault, not in migration files. Server actions
also trigger a dispatch right away (Next.js `after()`), so webhooks usually go out within seconds;
the 1-minute job is the safety net that handles retries.

## 6. Bot API (Stage 6 detail)

- `/api/v1/{organizations, org-meetings, hypotheses, tasks, people, synthe6-sessions, team-meetings,
  meeting-updates, decisions, debriefs, objectives, key-results, checklists, candidates,
  help-requests}`.
- Each resource supports `GET` (list with filters and `limit` + `cursor` pagination), `GET /{id}`,
  `POST`, and `PATCH`. There is no `DELETE`; send `PATCH {"archived": true}` instead.
- Responses are JSON with UUIDs and ISO 8601 dates. Errors use the shape
  `{ "error": { "code", "message", "fields" } }`.
- Each request goes through: rate limit (per key, Postgres counter) → key lookup by SHA-256 → scope
  check → Zod validation → database.
- `GET /api/v1/openapi.json` is generated from the same Zod schemas, so the docs and the validation
  can't drift apart.
- Summary endpoints are built on the same views the UI uses (`org_overview`, `person_workload`, …).
- Webhooks are signed: `X-StratoCrest-Signature: t=<unix>,v1=<HMAC-SHA256(secret, t + "." + body)>`,
  plus an `X-StratoCrest-Event-Id` header for de-duplication.

## 7. Live updates

Each page has a small client component that subscribes to Supabase Realtime changes on the tables it
shows and calls `router.refresh()` (debounced). Server components stay the only way pages are
rendered. Realtime respects RLS, so it can't leak data.

## 8. Testing and environments

| Layer | Tool | What it covers | Where it runs |
|---|---|---|---|
| Unit | Vitest | Zod schemas, ET date helpers (including daylight-saving changes), facilitator rotation, OKR progress, workload flag, CSV, webhook signing | anywhere |
| Database | Vitest + `pg`, against the **local Supabase stack** (`pnpm db:start`, Docker). Each test runs in a rolled-back transaction and switches roles (signed out, teammate, inactive person, bot via the server key) | every migration applies cleanly; RLS and privileges; triggers; undo; scheduled checks; views | local, cloud sessions, CI |
| End-to-end | Playwright, two projects: desktop Chrome and 390 × 844 mobile, against the local stack | the acceptance flows in spec §6; sign-in uses the real flow, reading the code from the local test mailbox (Mailpit) | local, cloud sessions, CI |

Environments:

| Where | Supabase project |
|---|---|
| Local / Claude sessions / CI tests | the local Supabase stack in Docker (`pnpm db:start`); nothing leaves the machine |
| Manual testing by the team before launch | `stratocrest-ops-dev` |
| Vercel Preview deployments | `stratocrest-ops-dev` |
| Vercel Production | `stratocrest-ops-prod` |

Real team data never touches dev, and `seed:demo` refuses to run against prod.

## 9. Performance on phones

- This Week is a server component that loads its data in parallel queries and streams sections as
  they're ready.
- Client JavaScript is limited to forms, the Kanban, and the theme toggle. There is no chart library;
  OKR bars are plain CSS.
- Vercel functions run in `iad1` (Washington, D.C.), next to Supabase `us-east-1`.
- System font stack, no web-font download.
- Tap targets are at least 44 px. Tables become cards below the `md` breakpoint.
