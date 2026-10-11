# PROGRESS — StratoCrest Ops

_Last updated: 2026-10-11 (Stage 2)_

## Stages

| Stage | Status |
|---|---|
| 0 — Plan | ✅ Done. Defaults accepted ("looks good continue", 2026-10-09). |
| 1 — Foundation | ✅ Done ("go", 2026-10-11) |
| 2 — This Week + Tasks + People basics | ✅ Done. Waiting for your "go" for Stage 3. |
| 3 — Investor Tracker → Customer Pipeline + hypothesis roll-up | ⏭ Next (file outline below) |
| 4 — Meetings, Debriefs, Synthe6 timeline | — |
| 5 — OKRs, Checklists, Workload, Wins, Recruiting, Help | — |
| 6 — Bot integration | — |
| 7 — Polish and launch | — |

## What Stage 2 built

- **This Week** (the home page). It answers "what do I need to do?" before project status:
  - **My work:** my open tasks, my investor/customer follow-ups due by Sunday, debriefs I owe.
  - **Needs attention** (whole team): overdue tasks and follow-ups, investors and customers with no
    contact in 14+ days, debriefs due, open help requests.
  - Next Synthe6 session with a countdown; next Sunday meeting with its facilitator and who has
    posted updates; org meetings in the next 7 days; OKR progress for the current or next quarter.
  - Each card loads, and fails, on its own; the page updates live.
- **Tasks** (`/tasks`, `/tasks/new`, `/tasks/[id]`):
  - Owner, a concrete next action and a due date are required, with inline messages.
  - Views: My tasks, By owner, By status, Due this week (through this Sunday).
  - One-tap Done and a status menu on every row, with Undo; archive with Undo, and Restore.
  - Optional links to an org, Synthe6 session, key result, Sunday meeting or org meeting.
  - A gentle warning (never a block) when the due date falls in the owner's crunch period.
- **People** (`/people`, `/people/[id]`): role, how to reach them, CliftonStrengths top 5, skills,
  what they own (tasks, investors and customers, key results), weekly busy times (ET) and crunch
  periods. Anyone on the team can edit any profile (spec §2).
- **Live updates** on every Stage 2 page, including busy times, crunch periods and meeting
  attendees (migration `20261011000300`). Pages catch up after a dropped connection or Back.
- **Tests:**
  - 602 unit tests.
  - 132 database tests.
  - 88 Playwright tests at desktop and 390 px (81 run, 7 apply to one screen size only).
  - Two full runs in a row: 0 failed, 0 flaky.
- **Adversarial review:**
  - Four reviewers (security, Next.js/React, data and dates, spec/UX/accessibility), each with a
    skeptic trying to refute every finding.
  - Security found nothing. 11 findings were confirmed (10 distinct); all are fixed with tests, and
    a skeptic then checked each fix.
  - The fixes: failed requests no longer replace the page; focus and toasts behave after Back;
    status Undo keeps the original completion time; the Sunday meeting card no longer goes blank
    for an hour on Sundays; one key-result progress rule; amber only for "stale"; the e2e tests no
    longer depend on the weekday.

## What Stage 1 built

- **Database:** 11 migrations implementing `docs/DATA_MODEL.md`. Covers:
  - every table, with Row Level Security and privileges reset to nothing, then granted exactly;
  - common-columns and audit triggers, plus `undo_activity()` (undoes a whole change, safely);
  - business rules (last contact date, automatic debriefs, events, immutable org kind);
  - the scheduled checks on `pg_cron` every 15 minutes (next Sunday meeting with a rotating
    facilitator, held meetings, due debriefs, de-duplicated events);
  - three views (`org_overview`, `person_workload`, `wins_feed`);
  - Realtime publication.
- **Sign-in:**
  - Email, then a 6-digit code, or the emailed link. The link page signs in only when the button is
    pressed, so email scanners can't use it up.
  - Only active teammates: the `people` table is the allowlist, and Supabase sign-ups are off.
  - A deactivated teammate is locked out on their next page load and told why.
- **App shell:**
  - Desktop sidebar; on phones, a top bar plus a bottom nav (This Week, Investors, Customers, Tasks,
    More).
  - Skip link; user menu with Light / Dark / System theme and sign-out.
  - A placeholder page for every section, each with an explanatory empty state.
- **Seeds:**
  - `pnpm seed` (safe to re-run, safe for production): the six people with confirmed logins, all 53
    Synthe6 rows, quarters, and the four starter checklist templates.
  - `pnpm seed:demo`: dev-only `[DEMO]` data.
- **Tests:**
  - 279 unit tests.
  - 127 database tests: privileges, RLS, attribution, audit, undo, rules, scheduled checks, views.
  - 57 Playwright tests at desktop and 390 px, using the real sign-in flow.
- **CI:** `.github/workflows/ci.yml` runs checks, database and e2e jobs against a temporary local
  Supabase on every push. `db-migrate.yml` applies migrations: dev when started by hand, production
  on merge to `main`.
- **Adversarial review:** four reviewers (security, database, Next.js/React, spec) each had a skeptic
  try to refute every finding. All 11 confirmed findings are fixed, with tests that fail without
  the fix. The database fixes are in migrations `20261011000100` and `20261011000200`.

## Still needed from you (none of it blocks Stage 3)

1. **Supabase accounts:** `docs/SETUP.md` Part A, steps A1–A3 and A5. A4 is now optional. The
   migration secrets go in GitHub **environments** (`dev`, and `production` locked to `main`).
2. **Sign-in settings in each hosted Supabase project:** `docs/SETUP.md` **B2**. This turns off
   public sign-ups, sets the redirect URLs, and pastes the email template.
3. **Sign-in email domain:** Part B1. Until then, only the person who created the Supabase
   organization can receive sign-in emails from a hosted project.
4. **How the Grok bot runs** (open question 4 from Stage 0). This decides Stage 6.
5. **Google account and the new Sheet/Calendar:** open question 5, needed by Stage 6.
6. **Synthe6 session times:** sessions show as all-day until then.
7. **Hosting plan:** Vercel Hobby vs Pro, needed by Stage 7.

## Decisions made

| Date | Decision | Why |
|---|---|---|
| 2026-10-09 | Stage 0 defaults accepted, including: the people table is the sign-in allowlist; Resend for email; facilitator rotation in team order starting with John; one linked record per kind when a company is both; archive, not delete | "looks good continue" |
| 2026-10-09 | Data model as in `docs/DATA_MODEL.md` §8, plus `event_dedupe` instead of "notified" columns | Scheduled jobs never edit business rows |
| 2026-10-09 | TypeScript 6.0.3 (not 7); **ESLint 9.39.5** (not 10) | typescript-eslint and eslint-config-next's plugins don't support the newer majors yet |
| 2026-10-09 | Keep Next 16.4's defaults: `cacheComponents`, `partialPrefetching`, plus `typedRoutes` | Instant static shell on phones; per-user data streams in behind `<Suspense>` |
| 2026-10-09 | No next-themes and no date-fns. Theme uses an inline script (Next's recommended pattern); dates use `Intl` + `@date-fns/tz` | Fewer libraries |
| 2026-10-09 | shadcn new-york-v4 (Radix) components copied from the shadcn GitHub repo | `ui.shadcn.com` is blocked here |
| 2026-10-09 | Prettier for formatting (no semicolons, printWidth 100); `*.md` excluded | Consistent style, including generated types |
| 2026-10-09 | Design tokens: one indigo accent; red/amber/green only for status. All 24 text/background pairs are ≥ 4.5:1 | WCAG AA in both themes |
| 2026-10-09 | Buttons and inputs are 44 px tall below `md` | Spec: tap targets ≥ 44 px on phones |
| 2026-10-09 | Tests and CI run against a **local Supabase stack in Docker**, not the dev project | No secrets needed; nothing leaves the machine |
| 2026-10-09 | `pg` is a dev dependency, for DB tests that switch roles | Tests simulate each role exactly |
| 2026-10-09 | Supabase sign-ups are off via `[auth] enable_signup = false`, **not** `[auth.email] enable_signup` | The latter disables email sign-in entirely |
| 2026-10-09 | Sign-in tells you when an email isn't on the team list | Helpful for a 6-person team; enumeration risk accepted |
| 2026-10-09 | Sign-out ends only this device's session. The not-on-team path signs out everywhere | Signing out on a laptop shouldn't sign you out on your phone |
| 2026-10-09 | Email links use `NEXT_PUBLIC_SITE_URL`, falling back to the request origin | Correct links per environment |
| 2026-10-09 | This Week order: My work and Needs attention first, then Synthe6, Sunday meeting, OKRs | Principle 1, people first |
| 2026-10-09 | Active nav highlighting renders inside Suspense | `usePathname()` suspends on dynamic routes under Cache Components |
| 2026-10-09 | Brand mark is the lucide `MountainSnow` icon on the accent colour; also used as `src/app/icon.svg` | Simple, no image files |
| 2026-10-09 | W40 is tagged mentor coaching, so Demo Day prep is W38, W39, W41–W43 | W40's type is Lead Mentor Coaching |
| 2026-10-09 | Checklist template items carry a phase prefix ("Before:", "After:"…) | Simple, editable as text |
| 2026-10-09 | Changing an email in `TEAM_EMAILS` links a new login; the old login is left unlinked (it can't get in) | Safe, no destructive cleanup |
| 2026-10-10 | Undo of a newly created record on tables without archive (e.g. a meeting the bot logged) deletes it through a narrow security-definer helper. People are never deleted by undo | Spec: "bot changes … can be undone by a person" |
| 2026-10-10 | `createClient()` awaits `connection()` | Stops ~700 prefetch errors per browse (supabase-js reads `Date.now()`) |
| 2026-10-10 | Stage 1 migrations were corrected in place, before any hosted project existed. From now on, only new migrations | Clean schema history before first deploy |
| 2026-10-10 | Migrations go to dev **by hand** (GitHub → Actions → Run workflow) and to production on merge to `main`; `db push --skip-vault` | Production changes only from reviewed code |
| 2026-10-11 | Undo reverses a whole **change**: everything one statement did, triggers included. It refuses when a record changed since (unless forced), never cascades, and restores completion stamps | Adversarial review: the per-row version could wipe a week's meeting updates in one click |
| 2026-10-11 | An org's **last contact is derived** in `org_overview` (latest meeting that happened, or contact entered by hand); a debrief nobody has started follows its meeting | A meeting moved or undone could otherwise hide a stale investor for 14 days |
| 2026-10-11 | `next=` redirects are resolved like a browser would before they're checked | `/.//evil.com` slipped past the raw-string check |
| 2026-10-11 | Logins link to people only once their email is confirmed; the seed refuses to adopt an unconfirmed login | Closes account pre-hijacking if sign-ups are ever left on |
| 2026-10-11 | A failed people lookup is an error (retry screen), not "not on team" | A database blip must never sign a teammate out everywhere |
| 2026-10-11 | Migration secrets live in GitHub environments, production locked to `main` | Repository secrets are readable from any branch |
| 2026-10-11 | Forms use React's `useActionState` with server-side Zod validation and native HTML checks; **react-hook-form dropped** | One validation path, one library fewer |
| 2026-10-11 | Client code calls Server Actions through `src/lib/action-calls.ts`: a lost connection or server error shows a toast or form error and keeps what was typed | Phones lose signal; the error screen used to wipe the form |
| 2026-10-11 | "Due this week" = on or before this Sunday (ET); on a Sunday, that's today | Matches the Sunday meeting rhythm |
| 2026-10-11 | A new task defaults to owner = me, due in 7 days; links can prefill it (`?owner`, `?due`, `?org`, `?session`, `?kr`, `?team_meeting`, `?org_meeting`, `?return_to`) | Fast entry from anywhere |
| 2026-10-11 | Row status is a menu that saves only on a pick (opens on a finished tap on phones), plus a one-tap Done; Undo reverses the change with `undo_activity` | No accidental saves while arrowing or scrolling; Undo keeps the original completion time |
| 2026-10-11 | After a status change moves a row, focus follows it (or the next task, or the list heading) | Keyboard and screen-reader users keep their place |
| 2026-10-11 | Archive is a two-step button plus an Undo toast; an archived task keeps its page with a banner and Restore | No dialogs on phones; nothing is deleted |
| 2026-10-11 | Amber is only for "stale". Crunch markers, warnings and hand-over notes are neutral (outline badge or muted box with a warning icon) | Spec §7 colour rule |
| 2026-10-11 | On phones the task view tabs are a 2×2 grid | All four views stay visible at 390 px |
| 2026-10-11 | This Week: each card has its own Suspense and error boundary; one clock per request; two columns from `lg` | Cards load and fail independently, all on the same "today" |
| 2026-10-11 | CliftonStrengths: the 34 themes and domains in `src/lib/clifton-strengths.ts`; blank picks close up; duplicates rejected | Gallup's public taxonomy; stored in Gallup's spelling |
| 2026-10-11 | Skills: comma- or line-separated, trimmed, repeats dropped ignoring case, ≤ 60 characters each, ≤ 30 | Simple to type on a phone |
| 2026-10-11 | Key-result progress has one rule (`src/lib/okr.ts`): 100% only when the target is reached, ≥ 1% once started | Profile and This Week used to disagree |
| 2026-10-11 | The next Sunday meeting is next week's as soon as today's is held or canceled (or at noon ET) | The card was blank 11:00–12:00 every Sunday |
| 2026-10-11 | Live updates refresh once when a channel rejoins or Back restores a page, and when the tab becomes visible; `PUBLISHED_TABLES` is checked against the database | Realtime doesn't replay missed changes |
| 2026-10-11 | Links to an investor or customer go to the list pages until Stage 3 adds detail pages | Detail pages come with the tracker |
| 2026-10-11 | E2E runs send about 15 sign-in emails; leave 5 minutes between full local runs | Local email limit |
| 2026-10-11 | `/favicon.ico` is rewritten to the app icon | Browsers request it; the 404 was a console error |

## Known issues

- **ESLint 9.39.5 is marked deprecated upstream.** Move to ESLint 10 when eslint-config-next's
  plugins support it.
- **Hosted Supabase allows one email per address per 60 s** (local: 1 s). Pressing "Resend code"
  quickly shows the wait message. That's correct behavior.
- **Account-menu focus ring:** after picking a theme with the mouse, the account button shows a focus
  ring. This is Radix returning focus for keyboard users; it's cosmetic.
- **Local e2e runs send ~15 sign-in emails.** Running the suite 3+ times within 5 minutes hits the
  local email limit.
- **Two people editing the same task or profile at once:** the last save wins.
- **Help requests on This Week** don't yet show the item they're about; Stage 5 builds help requests.
- **This Week runs about 13 small queries per load.** Fine for six people; one database function
  could replace them if phones feel slow.
- **The database doesn't check** that strengths are real theme names or that skills are ≤ 60
  characters (the forms do). Add these checks in Stage 6, before the bot writes profiles.
- **The account menu** in the header still opens on touch-down (Radix default). It's at the top of
  the page, so a scroll rarely starts there.
- **Supabase free plan** pauses after 7 idle days and has no automatic backups. Decide on a weekly
  backup in Stage 7.
- **Vercel Hobby terms:** see "Still needed from you" item 7.

## Next steps

**You:**

1. Try the review notes in the Stage 2 summary.
2. Do `docs/SETUP.md` Parts A and B when you can (still not blocking).
3. Reply "go" for Stage 3.

**Stage 3 plan (Investor Tracker, then Customer Pipeline + hypothesis roll-up), files to create or
change:**

- **Libraries** (planned in Stage 0): `@tanstack/react-table` for sorting/filtering the tracker
  table; `@dnd-kit/core` for the Kanban drag that also works by keyboard.
- **Schemas:** `src/lib/schemas/{organizations,org-meetings,hypotheses}.ts` (+ tests). Owner, next
  step and next-step date are required; a meeting rating is 1–5 with a one-line summary.
- **One implementation for both kinds:** `src/features/orgs/` configured by `kind-config.ts`
  (labels, stages from `org_stages`, subtypes, columns, empty states). Never forked.
  - `queries.ts` on `org_overview` (latest and next meeting, last contact, stale, rating);
    `actions.ts` (create/edit org, change stage, log meeting, add hypothesis/test).
  - Table view: Company | Location | First contact | Meeting date (latest and next) | Coatl point
    of contact | How it went (latest rating, colour-coded, plus a one-line summary). Sortable;
    filters for stage, owner, region, rating, stale (14+ days), kept in the URL.
  - Summary bar: total, count per stage, meetings this month, average rating, follow-ups due this
    week.
  - Kanban by stage with drag (and keyboard) to change stage.
  - Detail page: contact info, meeting log, hypothesis log, linked tasks, debriefs, activity history
    (from `activity_log`, with "via Grok" for bot changes).
  - "Log a meeting" in at most 2 screens, then one-click prompts for the debrief and a follow-up
    task (prefilled `/tasks/new`).
  - CSV export of the current filtered view (a route handler that reuses the same query and
    filters).
  - Below `md`, the table becomes cards: company, location, meeting date, point of contact,
    rating.
- **Routes:** `src/app/(app)/investors/` and `src/app/(app)/customers/` (table, board, `[id]`): thin
  pages that render `features/orgs` with a `kind`. `src/app/(app)/hypotheses/`: roll-up across both
  kinds, grouped Untested / Validated / Invalidated.
- **Links from Stage 2** (This Week, tasks, profiles) switch from the list pages to the new detail
  pages.
- **Tests:** unit (schemas, filters, summary maths, CSV), DB (anything new), and e2e (the spec's
  "done when": add an investor, log two meetings with ratings, see the latest in the table, filter by
  region, export CSV, all at 390 px; then the same for a customer, plus the hypothesis roll-up).
