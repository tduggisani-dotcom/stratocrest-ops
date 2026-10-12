# StratoCrest Ops — Accounts and Keys Setup

These steps are written for a non-specialist. Do each part when its heading says so, since you don't
need everything on day one. Dashboard labels change now and then; if a button is named slightly
differently, look for the closest match, or ask me.

**Three rules for every step:**

1. **Store every key, password, and secret in a password manager.** Bitwarden (free) or 1Password both
   have shared vaults, so two people can reach them.
2. **Never paste a key into a chat**, including this one. I'll tell you where each value goes.
3. **Have one owner and one backup admin.** We suggest **Ian (IT Director)** creates the accounts and
   adds **John** as a second admin everywhere, so nobody gets locked out.

---

## Part A — before Stage 1 (Foundation)

### A1. Supabase: database, login, and live updates (free)

1. Go to **https://supabase.com** → **Start your project** → **Continue with GitHub**. Use the GitHub
   account that can see the `stratocrest-ops` repository.
2. When asked to create an organization:
   - **Name:** `StratoCrest`
   - **Type:** Company
   - **Plan:** Free
   - Click **Create organization**.
3. Click **New project** and fill in:
   - **Name:** `stratocrest-ops-dev`
   - **Database password:** click **Generate a password**, then copy it into your password manager as
     *"Supabase DEV database password"*.
   - **Region:** **East US (North Virginia)**.
   - Click **Create new project** and wait about 2 minutes.
4. Repeat step 3 with **Name** `stratocrest-ops-prod`, using a *different* generated password saved as
   *"Supabase PROD database password"*. The free plan allows two projects, and we use one for testing
   and one for real data.
5. For **each** project, open it and copy these values into the password manager:

   | Value | Where to find it | Looks like |
   |---|---|---|
   | Project ref | In the browser address bar: `supabase.com/dashboard/project/`**`abcdefghijklmnop`** | 20 letters |
   | Project URL | **Project Settings** (gear icon) → **Data API**, or the **Connect** button at the top | `https://abcdefghijklmnop.supabase.co` |
   | Publishable key | **Project Settings** → **API Keys** | `sb_publishable_…` |
   | Secret key ⚠️ | **Project Settings** → **API Keys** → *Secret keys* → reveal and copy (click **Create new secret key** if there isn't one) | `sb_secret_…` |

   If you only see **anon** and **service_role** keys (the older names), use **anon** as the
   publishable key and **service_role** as the secret key. The secret key bypasses all security, so
   treat it like the database password.
6. **Then do B2 below for each project** (sign-in settings). Until you do, public sign-ups are on
   and the sign-in emails won't contain the 6-digit code.

### A2. Supabase access token (lets GitHub apply database changes)

1. Click your avatar (top right) → **Account preferences** → **Access Tokens**. The direct link is
   https://supabase.com/dashboard/account/tokens.
2. Click **Generate new token**, name it `stratocrest-ops-github`, and click **Generate**.
3. Copy it right away (it's shown once) and save it as *"Supabase access token (GitHub)"*.

### A3. GitHub environment secrets (for database updates)

The secrets live in GitHub **environments**, not as repository secrets: a repository secret can be
read by a workflow on any branch, while an environment's secrets can be locked to specific branches.

1. Open https://github.com/tduggisani-dotcom/stratocrest-ops → **Settings** (top bar) → in the left
   menu **Environments** → **New environment** → name it exactly `dev` → **Configure environment**.
2. Under **Environment secrets**, click **Add environment secret** for each row below, type the
   **Name** exactly, paste the value, and click **Add secret**:

   | Name | Value |
   |---|---|
   | `SUPABASE_ACCESS_TOKEN` | the token from A2 |
   | `DEV_SUPABASE_PROJECT_REF` | dev project ref |
   | `DEV_SUPABASE_DB_PASSWORD` | dev database password |

   These let the **"Database: apply migrations"** GitHub workflow update your dev project when you run
   it (GitHub → **Actions** → **Database: apply migrations** → **Run workflow** → choose `dev`). The
   production environment comes in Stage 7 (D2). The automatic checks on every push don't need any
   secrets: they use a temporary local Supabase.

### A4. (Optional) Let Claude's cloud sessions reach the dev project

**Not needed for building.** Claude runs a complete local copy of Supabase (in Docker) inside its
cloud session and in GitHub's automatic checks, so all tests run without your projects. Do this only
if you want Claude to look at data in your *dev* project directly. This cloud environment currently
blocks `supabase.co`.

1. In the Claude app, open this session's **cloud environment menu** (in the session's title bar) →
   **Edit**.
2. Under **Network access**, find **Allowed domains** (shown under the **Limited** level). Add your dev
   host, `abcdefghijklmnop.supabase.co` (your real dev ref, **not** prod), and leave **Allow package
   managers** ticked. (In an older app version this is under **Custom**, with a box to include the
   default package-manager list.) Help page: https://code.claude.com/docs/en/cloud-environments#network-access
3. In the same settings, add these **environment variables** (or under **Network secrets** /
   **API credentials** if your app shows that section). Use **dev values only, never prod**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY`
   - `TEAM_EMAILS` (see A5)
4. Changes apply to the **next** session you start.

### A5. The team email list (`TEAM_EMAILS`)

One line, in the familiar `Name <email>` format, separated by commas. Names must match exactly:

```
TEAM_EMAILS=John LaRocco <john@…>, Taeyoon Eom <taeyoon@…>, Brad Hall <brad@…>, Sam Browning <sam@…>, Ian Zalcberg <ian@…>, Tanush <tanush@…>
```

Use the address each person actually checks on their phone. This value goes in the cloud environment
(A4) and later in Vercel. It never goes in git.

---

## Part B — before teammates sign in (end of Stage 1)

Supabase's built-in email only sends a couple of messages an hour, and only to people in your
Supabase organization. Real sign-in emails need an email provider.

### B1. Resend (free tier: about 3,000 emails a month)

**You need a domain you control**, such as `stratocrest.com` or `coatlcomposites.com`, and access to
its DNS settings at the registrar (GoDaddy, Namecheap, Squarespace, Cloudflare, …). If you don't have
one, see the option at the end of this part.

1. Go to **https://resend.com** → **Sign up**.
2. **Domains** → **Add Domain**:
   - Enter a sub-domain such as `mail.yourdomain.com`. This keeps the app's email separate from your
     normal email.
   - **Region:** North Virginia (us-east-1).
   - Click **Add**.
3. Resend shows 3–4 DNS records (types **MX** and **TXT**). In a second tab, open your domain
   registrar → **DNS settings** for the domain. Add each record exactly as shown (Type, Name/Host,
   Value; leave TTL at its default).
4. Back in Resend, click **Verify DNS Records**. This can take a few minutes up to a few hours. Wait
   until the domain shows **Verified**.
5. **API Keys** → **Create API Key**:
   - **Name:** `supabase-auth-smtp`
   - **Permission:** *Sending access*
   - **Domain:** your domain
   - Copy the key (shown once) and save it as *"Resend SMTP key"*.
6. In **each** Supabase project (dev and prod): **Authentication** → **Emails** → **SMTP Settings**
   → turn on **Enable custom SMTP**, fill in the values below, and click **Save**:
   - **Host:** `smtp.resend.com`
   - **Port:** `465`
   - **Username:** `resend`
   - **Password:** the key
   - **Sender:** `StratoCrest Ops <ops@mail.yourdomain.com>`

**No domain?** Either buy one (about $10–15 a year) and follow the steps above, or use a
company Gmail or Google Workspace account's SMTP with an **app password** (requires 2-Step
Verification). Tell me which, and I'll write those steps.

### B2. Sign-in settings in each Supabase project (do this for dev, then prod)

The local copy of Supabase gets these from `supabase/config.toml` automatically; hosted projects
need them set by hand once. Open the project at https://supabase.com/dashboard, then:

1. **Turn off public sign-ups.** **Authentication** → **Sign In / Providers** → under **User
   Signups**, turn **off** "Allow new users to sign up" → **Save**. Leave the **Email** provider
   **on**. Under **Email**, set **Email OTP Length** to `6` and **Email OTP Expiration** to `3600`
   seconds → **Save**.
   *Why:* only the six teammates should have logins (`pnpm seed` creates them). With sign-ups on,
   anyone could create accounts and use up the email allowance.
2. **Set the app's address.** **Authentication** → **URL Configuration**:
   - **Site URL:** your app's address, e.g. `https://ops.yourdomain.com`. For the dev project before
     the app is deployed, use `http://localhost:3000`.
   - **Redirect URLs** → **Add URL**: `https://ops.yourdomain.com/**`. On the dev project also add
     `http://localhost:3000/**`. Click **Save**.
   *Why:* the sign-in link must come back to the app (and keep the page you were going to).
3. **Paste the email template.** **Authentication** → **Emails** → **Templates** → **Magic Link**:
   - **Subject:** `Your StratoCrest Ops sign-in code`
   - **Body:** open `supabase/templates/magic_link.html` from this repository on GitHub, click
     **Raw**, select all, copy, and paste it over the existing body → **Save**.
   *Why:* the default email has no 6-digit code, and its link uses a format the app doesn't accept.
4. **Email sending:** do B1 step 6 (custom SMTP) for this project too.
5. **Check it:** run the sign-in once with your own email. The email should show a large 6-digit
   code and a "Sign in" button.

---

## Part C — before Stage 6 (Grok bot and Google)

### C1. Google: service account, mirror Sheet, and shared Calendar

Use the Google account the Grok bot already uses, so the bot can read the mirror.

1. Go to **https://console.cloud.google.com**. In the project picker (top left), click
   **New project**, name it `stratocrest-ops`, and click **Create**. Make sure it's selected.
2. Turn on the two APIs:
   - Left menu → **APIs & Services** → **Library** → search **Google Sheets API** → **Enable**.
   - Back to **Library** → search **Google Calendar API** → **Enable**.
3. Create the service account:
   - Left menu → **IAM & Admin** → **Service Accounts** → **Create service account**.
   - **Name:** `ops-mirror` → **Create and continue**.
   - Skip the optional role steps → **Done**.
4. Create its key:
   - Click the new service account → **Keys** tab → **Add key** → **Create new key** → **JSON** →
     **Create**.
   - A `.json` file downloads. Store it in the password manager as an attachment, then delete it from
     Downloads.
   - If Google says *key creation is disabled by an organization policy*, your Google Workspace admin
     must allow it (policy `iam.disableServiceAccountKeyCreation`). Tell me if that happens.
5. Copy the service account's email; it looks like
   `ops-mirror@stratocrest-ops.iam.gserviceaccount.com`.
6. Create the mirror Sheet:
   - In Google Sheets, create a new blank spreadsheet named **StratoCrest Ops — Mirror (read-only)**.
     Use a **new** spreadsheet: the app overwrites its tabs every 15 minutes, so it must not share
     tabs with anything people edit.
   - Click **Share**, paste the service account email, choose **Editor**, untick **Notify people**,
     and click **Share**.
   - Copy the **Sheet ID** from the address bar: the long text between `/d/` and `/edit`.
7. Create the shared Calendar:
   - In Google Calendar, next to **Other calendars**, click **+** → **Create new calendar**.
   - **Name:** `StratoCrest Ops`, **Time zone:** *(GMT-05:00) Eastern Time* → **Create calendar**.
   - Open that calendar's **Settings and sharing** → **Share with specific people or groups** →
     **Add people and groups**. Paste the service account email, set permission to
     **Make changes to events**, and click **Send**.
   - Add the six teammates the same way with **See all event details**.
   - Scroll to **Integrate calendar** and copy the **Calendar ID**.

### C2. About the Grok bot

Please send me (no keys needed) the answers to the bot questions in `PROGRESS.md` → *Open
questions*. They decide how the bot calls our API and whether it can receive webhooks. You'll create
the bot's API key yourself in the app's **Settings → API keys** in Stage 6.

---

## Part D — before Stage 7 (go live)

### D1. Vercel (hosting)

1. Go to **https://vercel.com/signup** → **Continue with GitHub** (same account as Supabase).
2. Pick the plan you decided on (see `PROGRESS.md` → Open questions: Hobby vs Pro).
3. **Add New…** → **Project** → find `stratocrest-ops` → **Import**. If the repository isn't listed,
   click **Adjust GitHub App Permissions** and give Vercel access to it.
4. The framework should show **Next.js**. Don't change the build settings.
5. Before the first deploy: **Settings** → **Environment Variables**. Add each variable from the
   table in Part E, ticking **Production** for prod values and **Preview** for dev values. I'll give
   you the exact list in Stage 7.
6. **Settings** → **Functions** → **Region:** Washington, D.C., USA (`iad1`). This should be the
   default.

### D2. Production values in GitHub (locked to `main`)

1. GitHub → **Settings** → **Environments** → **New environment** → name it exactly `production` →
   **Configure environment**.
2. Under **Deployment branches and tags**, choose **Selected branches and tags** → **Add deployment
   branch or tag rule** → type `main` → **Add rule**. Now only code that has been merged to `main`
   can reach these secrets. (Optional: tick **Required reviewers** and add John or Ian, so every
   production database change waits for a click.)
3. Under **Environment secrets**, add `SUPABASE_ACCESS_TOKEN` (the token from A2),
   `PROD_SUPABASE_PROJECT_REF` and `PROD_SUPABASE_DB_PASSWORD`, the same way as A3.

Database changes are then applied to production automatically when we merge to `main`.

---

## Part E — every environment variable

| Variable | Secret? | Comes from | Goes in |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | no | A1 Project URL | Claude env (dev), Vercel (dev for Preview, prod for Production) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | no¹ | A1 publishable key | same as above |
| `SUPABASE_SECRET_KEY` | **yes** | A1 secret key | Claude env (dev only), Vercel |
| `TEAM_EMAILS` | personal data | A5 | Claude env, Vercel, wherever `pnpm seed` runs |
| `NEXT_PUBLIC_SITE_URL` | no | your app's address, e.g. `https://ops.yourdomain.com` | Vercel |
| `APP_ENV` | no | `development` or `production` | Vercel (`production` on Production only) |
| `CRON_SECRET` | **yes** | I'll generate it; also stored in Supabase Vault | Vercel |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | **yes** | C1 step 4 (exact format given in Stage 6) | Vercel |
| `GOOGLE_SHEET_ID`, `GOOGLE_CALENDAR_ID` | no | C1 steps 6–7 | Vercel |

¹ The publishable key is designed to be visible in the browser. Row Level Security is what protects
the data.
