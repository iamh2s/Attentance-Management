# APAMS — Army Personnel Attendance Management System (Demo)

A professional, secure, responsive demonstration of an attendance management
system for ~900–1,000 personnel. Admins mark, correct and audit daily
attendance; personnel can view **only their own** records.

> **⚠ Demonstration only.** This is **not** an officially approved Indian Army
> system. It uses **no** official insignia, emblems, classified information or
> real personnel data. Do not describe this build as production-ready without
> a full security review and formal authorisation.

The build ships with **no predefined data and no demo accounts** — the app
contains zero bundled records and connects exclusively to **your** Supabase
project. Until `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are provided,
the app displays a guided connection screen.

---

## Feature summary

| Area | Highlights |
| --- | --- |
| Auth & security | Supabase Auth sign-in, role-based navigation, password change & reset flows, deactivated-account blocking, sign-in rate limiting at the identity provider, optional TOTP MFA for admins |
| Admin dashboard | Total Personnel · Present · Absent · On Leave · Not Marked · Attendance % — all computed **live from records** via SQL, trend chart (7/14/30d), recent changes, date filters, quick actions |
| Personnel directory | Server-side pagination, search by name/ID/email, add/edit via a **trusted Edge Function** (service-role key stays server-side), activate/deactivate with mandatory reason, per-row attendance history |
| Attendance marking | One record per person per date (DB unique constraint), individual + bulk marking, bulk-apply confirmation, review-before-save modal, corrections require a mandatory reason (**also enforced by a DB trigger**), last-modified-by visibility, `Not Marked` is explicit — never auto-absent |
| Reports | Daily (counts + personnel breakdown) and monthly (per-person scheduled/present/absent/leave/unmarked + %) reports, date & personnel filters, audited CSV export |
| Audit logs | Attendance creation/correction (with previous & new values), bulk saves, personnel lifecycle, privileged ops, denied RPC calls, report exports — actor + timestamp + reason. No secrets ever logged |
| Personnel portal | Own dashboard, own monthly summaries, present/absent/leave counts, calendar heatmap, read-only profile, password change, secure logout |

## Architecture

```
┌──────────────────────────┐         ┌────────────────────────────────┐
│  React 19 + Vite + TS    │  HTTPS  │  Supabase                      │
│  Tailwind v4 · Recharts  │ ──────► │  Auth (GoTrue)                 │
│  React Router · Lucide   │         │  PostgreSQL + RLS policies     │
│                          │         │  SECURITY DEFINER RPCs         │
│  src/lib/backend.ts      │         │  audit triggers                │
│  (env-gated facade)      │         │  Edge Function: create users   │
└──────────────────────────┘         └────────────────────────────────┘
```

The frontend talks only to the `BackendFacade` interface
(`src/lib/supabaseBackend.ts`). All privileged writes go through
`SECURITY DEFINER` RPCs that re-verify the caller's role **in SQL**. React
route guards are UX conveniences — **RLS is the real enforcement**.

### Why RLS + RPCs (defence in depth)

1. Every private table has RLS enabled; `anon` reads nothing.
2. `user_roles` has **no** client write policies — users can never change roles.
3. Attendance writes require the admin role (checked with `auth.uid()` via a
   `SECURITY DEFINER` helper; browser-supplied roles are never trusted).
4. A trigger makes `correction_reason` mandatory on every status change, so
   records can't be silently overwritten even by a compromised admin session.
5. Triggers append audit rows for attendance writes and activations.
6. `audit_logs` has **no** update/delete policies — immutable for clients.
7. The **service-role key never** ships in frontend code; personnel creation
   runs through the `admin-create-personnel` Edge Function.

## Project structure

```
src/
  lib/
    types.ts            Domain types (statuses, roles, reports)
    utils.ts            Dates, CSV export, status metadata
    options.ts          Demo designation/unit label lists for forms
    backend.ts          Env-gated facade + getBackend()
    supabaseBackend.ts  Supabase implementation (auth, RPCs, RLS queries)
    errors.ts           Shared error type
  context/AuthContext.tsx
  components/           Layout, UI primitives, charts, history view
  pages/                Setup screen, Login, Forgot PW, Admin (6 pages),
                        Personnel (3), Settings
supabase/
  migrations/0001_init.sql              Schema + indexes + RLS + triggers + RPCs
  functions/admin-create-personnel/     Trusted personnel provisioning
  tests/rls_tests.sql                   pgTAP automated permission tests
.env.example                            Config template (no secrets)
```

## Setup with Supabase

1. **Create a project** at [supabase.com](https://supabase.com) (free tier is
   fine) and note your **Project URL** and **anon public key**
   (Project Settings → API).
2. **Run the migration**: Supabase Dashboard → SQL Editor → paste
   `supabase/migrations/0001_init.sql` → Run (or `supabase db push` via CLI).
   It creates all tables, indexes, unique constraints, RLS policies, audit
   triggers and the trusted RPCs.
3. **Configure env**:
   ```bash
   cp .env.example .env.local   # then fill in the two VITE_ values
   ```
   For deployment, set the same variables in your host's dashboard.
4. **Start the app**:
   ```bash
   npm install
   npm run dev
   ```
5. **Create the first admin**: Supabase Dashboard → Authentication → Users →
   **Add user** (email + password, tick *Auto Confirm User*). Then grant the
   role in the SQL Editor:
   ```sql
   insert into public.user_roles (user_id, role)
   values ('PASTE-USER-UUID', 'admin');
   ```
   (Admins need no `profiles` row — the directory and attendance sheet only
   list profiles, so keeping the admin profile-free keeps it out of the
   marking pool.)
6. **Personnel creation at runtime**: deploy the trusted provisioning
   function (holds the service-role key server-side, verifies the caller's
   admin role, creates auth user + role + profile + audit entry, and returns
   a one-time temporary password):
   ```bash
   supabase functions deploy admin-create-personnel
   ```
   Without it, the Admin → *Add personnel* flow returns a clear setup error.
7. **Optional hardening**:
   - Admin MFA: Authentication → enable TOTP and require it for admins.
   - Email delivery (password reset): Authentication → Email → SMTP.
   - Password policy: Authentication → Password protection.

### Automated RLS/permission tests

```bash
supabase test db        # runs supabase/tests/rls_tests.sql (pgTAP)
```

Covers the required scenarios: anonymous users denied · personnel read only
their own rows · record-ID swapping denied · personnel cannot mark/change
attendance · self-role-grant denied · admin mark/correct-with-reason ·
duplicate person+date rejection · unauthorised RPC denial · audit capture ·
monthly report correctness. Create two throwaway users first and set the
fixture UUIDs at the top of the test file.

## Deployment (Cloudflare Pages)

1. `npm run build` → static `dist/`.
2. Cloudflare Dashboard → **Pages → Create → Connect to Git**; build command
   `npm run build`, output `dist`.
3. Add env vars `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` in
   **Pages → Settings → Environment variables** (never the service key).
4. Attach your custom domain under **Pages → Custom domains**.
5. Supabase → **Authentication → URL Configuration**: add your Pages domain to
   Site URL / redirect URLs (needed for password-reset links).

Any static host works (Netlify, Vercel, S3+CDN).

## Performance notes

- Server-side pagination everywhere personnel are listed (`range` queries
  with `count: exact`).
- Indexes on `attendance(attendance_date)` and `attendance(personnel_id)`.
- Bulk marking is a single transactional RPC — no per-row round trips.
- Dashboard aggregates come from SQL functions, not client-side table scans.

## Known limitations (by design in this demo)

- **Not production-approved.** Requires a formal security review, penetration
  test, audit and accrediting authority sign-off before any real use.
- The app contains no bundled data of any kind; an empty project shows
  honest empty states until personnel are provisioned via the trusted flow.
- Attendance rate is defined as `present ÷ (present + absent)`; approved
  leave and not-marked days are reported separately, never silently merged.
- Email delivery (reset links, invites) requires SMTP configuration.
- Failed sign-in attempts are rate-limited by Supabase Auth itself; view
  them in the Supabase auth logs dashboard.

## Tech stack

React 19 · Vite 7 · TypeScript · Tailwind CSS v4 · React Router · Recharts ·
Lucide · Supabase (Auth, Postgres, RLS, RPC, Edge Functions) · Cloudflare Pages.
