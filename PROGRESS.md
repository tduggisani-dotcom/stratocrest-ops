# PROGRESS — StratoCrest Ops

_Last updated: 2026-10-10 (Stage 1)_

## Stages

| Stage | Status |
|---|---|
| 0 — Plan | ✅ Done. Defaults accepted ("looks good continue", 2026-10-09). |
| 1 — Foundation | ✅ Done. Waiting for your "go" for Stage 2. |
| 2 — This Week + Tasks + People basics | ⏭ Next (file outline below) |
| 3 — Investor Tracker → Customer Pipeline + hypothesis roll-up | — |
| 4 — Meetings, Debriefs, Synthe6 timeline | — |
| 5 — OKRs, Checklists, Workload, Wins, Recruiting, Help | — |
| 6 — Bot integration | — |
| 7 — Polish and launch | — |

## What Stage 1 built

- **Database:** 11 migrations implementing `docs/DATA_MODEL.md`. Covers:
  - every table, with Row Level Security and privileges reset to nothing, then granted exactly;
  - common-columns and audit triggers, plus `undo_activity()`;
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
  - 273 unit tests.
  - 115 database tests: privileges, RLS, attribution, audit, undo, rules, scheduled checks, views.
  - 57 Playwright tests at desktop and 390 px, using the real sign-in flow.
- **CI:** `.github/workflows/ci.yml` runs checks, database and e2e jobs against a temporary local
  Supabase on every push. `db-migrate.yml` applies migrations: dev when started by hand, production
  on merge to `main`.

## Still needed from you (none of it blocks Stage 2)

1. **Supabase accounts:** `docs/SETUP.md` Part A, steps A1–A3 and A5. A4 is now optional.
2. **Sign-in email domain:** Part B. Until then, only the person who created the Supabase organization
   can receive sign-in emails from a hosted project.
3. **How the Grok bot runs** (open question 4 from Stage 0). This decides Stage 6.
4. **Google account and the new Sheet/Calendar:** open question 5, needed by Stage 6.
5. **Synthe6 session times:** sessions show as all-day until then.
6. **Hosting plan:** Vercel Hobby vs Pro, needed by Stage 7.

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

## Known issues

- **ESLint 9.39.5 is marked deprecated upstream.** Move to ESLint 10 when eslint-config-next's
  plugins support it.
- **Hosted Supabase allows one email per address per 60 s** (local: 1 s). Pressing "Resend code"
  quickly shows the wait message. That's correct behavior.
- **Account-menu focus ring:** after picking a theme with the mouse, the account button shows a focus
  ring. This is Radix returning focus for keyboard users; it's cosmetic.
- **Local e2e runs send ~14 sign-in emails.** Running the suite 3+ times within 5 minutes hits the
  local email limit.
- **Supabase free plan** pauses after 7 idle days and has no automatic backups. Decide on a weekly
  backup in Stage 7.
- **Vercel Hobby terms:** see "Still needed from you" item 6.

## Next steps

**You:**

1. Try the review notes in the Stage 1 summary.
2. Do `docs/SETUP.md` Part A when you can.
3. Reply "go" for Stage 2.

**Stage 2 plan (This Week + Tasks + People basics), files to create or change:**

- **Schemas:** `src/lib/schemas/{tasks,people,availability}.ts` (+ tests). Owner, due date and next
  action are required, with inline messages.
- **Tasks:**
  - `src/features/tasks/` (queries, actions, components).
  - Create/edit form with owner picker, ET due date, and next action. Optional links to a key result,
    session, org, or meeting.
  - A crunch-period warning that warns but doesn't block.
  - Views: My tasks, by owner, by status, due this week. Inline status change.
- **Tasks route:** `src/app/(app)/tasks/` (list + `[id]`), replacing the placeholder.
- **People:**
  - `src/features/people/` and `src/app/(app)/people/` (list + `[id]` profile).
  - Profile shows role, avatar, ownership, CliftonStrengths, skills, contact preference, availability
    blocks, and crunch periods. Each can be edited; profile-field edits go through RLS. Email, active
    flag and rotation order change through a server action using the admin client.
- **This Week:** `src/features/this-week/` and `src/app/(app)/page.tsx`.
  - My work (my open tasks, follow-ups, debriefs due) and Needs attention (overdue tasks and
    follow-ups, 14-day stale orgs, debriefs due, open help requests).
  - Next Synthe6 session with countdown; next Sunday meeting with facilitator and who has posted
    updates; org meetings in the next 7 days; OKR progress (empty state until Stage 5).
- **Live updates:** `src/components/common/live-refresh.tsx`, which subscribes to Supabase Realtime
  and refreshes the page (debounced).
- **Tests:** unit (schemas, crunch overlap, This Week grouping), DB (anything new), and e2e
  (create a task, inline status change, profile edit, This Week sections, live update across two
  browsers, 390 px).
