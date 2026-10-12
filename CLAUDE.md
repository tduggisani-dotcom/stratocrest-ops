# CLAUDE.md — StratoCrest Ops

Private, people-first ops app for the six-person StratoCrest team (Coatl Composites), used from
phones. It is also read and written by the team's Grok "Chief of Staff" bot.

**Start every session by reading `PROGRESS.md`.** Other key docs:

- `docs/SPEC.md`: what to build
- `docs/DATA_MODEL.md`: tables, RLS, triggers
- `docs/ARCHITECTURE.md`: versions, folders, flows
- `docs/SETUP.md`: accounts and keys

## Next.js 16.4 is newer than most training data

Read the relevant guide in `node_modules/next/dist/docs/` before writing Next code (see `AGENTS.md`).
Key differences used here:

- `cacheComponents` + `partialPrefetching` are on. Reading cookies or headers, Supabase queries, and
  `new Date()` must happen inside a component wrapped in `<Suspense>`; otherwise the build fails.
  Layouts stay static (the instant "shell"), and per-user data streams in.
- Middleware is `src/proxy.ts` (Node runtime).
- Call `refresh()` from `next/cache` in a server action to re-render the page after a write.
- `typedRoutes` is on, so `<Link href>` must point at a real route.

## Stack

- Next.js 16 (App Router; `src/proxy.ts`, not `middleware.ts`)
- TypeScript **6.0.x** (strict). Not 7: typescript-eslint doesn't support it yet.
- Tailwind 4 + shadcn/ui + lucide-react; light and dark mode
- Supabase: Postgres, Auth magic link + code, RLS, Realtime, pg_cron/pg_net
- Zod 4, Vitest, Playwright, pnpm
- Hosted on Vercel (`iad1`) with Supabase (`us-east-1`)

Versions are pinned exactly. Don't add a library without writing why in `PROGRESS.md` → Decisions.

## Commands

| Command | Does |
|---|---|
| `pnpm db:start` / `pnpm db:stop` | local Supabase stack in Docker (API :54321, DB :54322, Mailpit :54324). Applies migrations on first start. |
| `pnpm db:reset` | rebuild the local database from `supabase/migrations/` (then run `pnpm seed`) |
| `pnpm seed` / `pnpm seed:demo` | production-safe seed (reads `TEAM_EMAILS`) / dev-only `[DEMO]` data |
| `pnpm dev` | dev server on http://localhost:3000 (needs the local stack and `.env.local`) |
| `pnpm typecheck` | `next typegen` + `tsc --noEmit` |
| `pnpm lint` / `pnpm format:check` | ESLint (zero warnings) / Prettier |
| `pnpm test` | Vitest unit tests |
| `pnpm test:db` | database tests against the local stack (each test rolls back) |
| `pnpm test:e2e` | Playwright, desktop + 390 px, against the local stack (builds the app on :3100) |
| `pnpm check` | typecheck + lint + format:check + unit tests |
| `pnpm db:types` | regenerate `src/types/database.ts` after a migration (CI fails if it's stale) |

**Cloud sessions (Claude Code on the web):**

- Start Docker first: `sudo dockerd` (as a background command).
- Pull Supabase images from Docker Hub, because the AWS registry (ECR) is blocked: prefix
  `SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io` to `pnpm db:start` and `pnpm db:types`.
- Run Playwright with `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium`.
- `ui.shadcn.com` is blocked: copy component sources from the shadcn GitHub repo (see
  `docs/ARCHITECTURE.md` §1).
- An e2e build bakes in `NEXT_PUBLIC_SITE_URL=http://localhost:3100`, so rebuild before `pnpm start`.

## Conventions

- **Schema:** `supabase/migrations/` is the source of truth. Never edit an existing migration; add a
  new one, then run `pnpm db:types`. (Stage 1's migrations were corrected in place once, before any
  hosted project existed.)
- **Seeds run under plain Node** (type stripping): `scripts/**` and what they import (`src/lib/dates.ts`,
  `src/lib/team-emails.ts`) use relative `.ts` imports and erasable TypeScript only.
- **RLS on every table.** Team members can view and edit everything. Infra tables (keys, webhooks)
  are server-only.
- **Business rules that must apply to both the UI and the bot** (audit, created_by, events,
  debriefs) live in Postgres triggers, not in TypeScript.
- **Dates:** `*_at` columns are `timestamptz` (moments). `*_date` columns are `date` (a calendar day
  in America/New_York). Use the helpers in `src/lib/dates.ts`; never use `new Date()` arithmetic for
  calendar days.
- **Values vs labels:** stored values are `snake_case`; labels for display come from
  `src/lib/labels.ts`.
- **Zod schemas** in `src/lib/schemas/` are the single source for forms, server actions, `/api/v1`,
  and OpenAPI.
- **Required:** every task, investor, and customer has one owner, a concrete next step, and a date.
  This is enforced in the DB (NOT NULL/CHECK) and in Zod (inline messages).
- **Investors and customers** share ONE implementation in `src/features/orgs/`, configured by `kind`
  (`kind-config.ts`). Never fork it.
- **People first:** every item shows its owner (`<PersonChip>`: avatar + name).
- **Lists:** every list has an empty state that explains what goes there and has a button to add the
  first item.
- **Server Actions from client code** go through `src/lib/action-calls.ts` (`callAction`,
  `withConnectionErrors`), so a lost connection shows an error instead of the error screen.
- **Live updates:** `<LiveRefresh tables={[…]}>` on each page; publish a new table to Realtime in a
  migration and add it to `PUBLISHED_TABLES` (a DB test checks they match).
- **Mobile:** works at 390 px with no horizontal scroll; tap targets ≥ 44 px; tables become cards
  below `md`.
- **Colour:** one accent colour. Status colours only: overdue = red, stale = amber, strong rating =
  green. Warnings that aren't status (crunch periods) are neutral with a warning icon.
- **Secrets:** use `.env.local` and `.env.example`, and never commit values. The Supabase secret key
  and Google credentials are imported only from `server-only` modules.
- **Seeds:** no invented business data. `pnpm seed` writes only people, the Synthe6 schedule,
  quarters, and checklist templates. Demo data is dev-only and prefixed `[DEMO]`.

## Working rules (spec §9)

1. Outline the files you'll create or change before writing them.
2. Ask before decisions that are expensive to undo (schema, auth, external services). Decide small UI
   choices yourself and log them in `PROGRESS.md`.
3. Verify: run the dev server and tests; check UI at desktop **and** 390 px. Never report a stage
   done with failing checks.
4. Keep `PROGRESS.md` current (done, decisions, known issues, next steps); keep this file short.
5. Secrets go in env files only.
6. Reuse components; investors and customers share one set.
7. Small commits, one per logical change.
8. Don't invent business data.
9. Explain setup steps for a non-specialist: exactly where to click and what to paste.

**End of every stage:**

1. Run typecheck, lint, and tests, and fix failures.
2. Update `PROGRESS.md`.
3. Commit and push.
4. Give a short summary: what was built, what to try, and what the user needs to do.
5. **Wait for "go"** before starting the next stage.
