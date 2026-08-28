# Ash — backend setup

The backend is Supabase (Auth + Postgres) with all server code as Next.js Route
Handlers in this same project. There is no separate service to deploy.

## 1. Install the packages

```bash
npm install @supabase/supabase-js @supabase/ssr
```

Nothing else is needed — request validation is hand-rolled in
`src/lib/api/validate.ts` rather than pulling in a schema library.

## 2. Environment variables

`.env` already has the two required values:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon / publishable key>
```

Add one more, so confirmation and password-reset emails link back correctly:

```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Both `NEXT_PUBLIC_*` values are inlined into the browser bundle at build time.
That is expected and safe **only because RLS is enabled on every table** — the
policies in `supabase/migrations/*_rls.sql` are the actual security boundary.

No service-role key is used anywhere. Every request runs as the signed-in user.

## 3. Run the migrations

Three files in `supabase/migrations/`, applied in filename order:

| File | Contents |
| --- | --- |
| `…_init.sql` | enums, `profiles`, `user_settings`, `cigarette_logs`, `purchases`, indexes |
| `…_rls.sql` | RLS enabled + per-user policies on all four tables |
| `…_triggers.sql` | `handle_new_user()` provisioning, `updated_at` triggers |

**Option A — Supabase CLI** (repeatable, what you want long-term):

```bash
npx supabase link --project-ref <project-ref>
npx supabase db push
```

**Option B — dashboard**: open the SQL Editor and paste each file's contents in
order (init → rls → triggers), running each one.

### Verify

- Table Editor shows all four tables with the **RLS enabled** badge.
- Database → Advisors → Security reports no errors.
- Sign up a throwaway user; `profiles` and `user_settings` each gain one row.

## 4. Supabase dashboard settings

1. **Auth → Providers → Email** — enabled. Decide on **Confirm email**:
   - *Off*: signup returns a session immediately, straight to the dashboard.
   - *On*: signup shows "check your inbox", and the emailed link lands on
     `/auth/confirm`, which is already implemented.
2. **Auth → URL Configuration**
   - Site URL: `http://localhost:3000`
   - Redirect URLs: `http://localhost:3000/**`
3. **Auth → Sign In / Providers** — set minimum password length to **8**, to
   match `PASSWORD_MIN` in `src/lib/api/auth-errors.ts`.

At deploy time, add the production URL to both fields above and set
`NEXT_PUBLIC_SITE_URL` in the host's environment.

## 5. Run it

```bash
npm run dev
```

`next dev` generates the `RouteContext` types the dynamic route handlers use, so
the first run also clears the two type errors you'd see before installing.

---

## What was built

### Database (`supabase/migrations/`)

`profiles` and `user_settings` hold one row per user; `cigarette_logs` and
`purchases` hold the data. Every table has RLS with `(select auth.uid())`
policies. A `handle_new_user()` trigger provisions the profile and settings rows
on signup, so the app never sees a "signed in but no rows" state.

### Server (`src/app/api/`, `src/proxy.ts`)

| Route | Purpose |
| --- | --- |
| `POST /api/auth/signup` `login` `logout` | email/password, cookie sessions |
| `GET /api/auth/me` | cheap "am I signed in?" probe |
| `POST /api/auth/forgot-password` `reset-password` | password recovery |
| `GET /auth/confirm` | landing point for emailed links (`verifyOtp`) |
| `GET /api/bootstrap` | profile + settings + logs + purchases in one trip |
| `/api/logs`, `/api/logs/[id]` | list, create, edit, delete |
| `/api/purchases`, `/api/purchases/[id]` | list, create, edit, delete |
| `GET`/`PATCH` `/api/settings` | read and partial-update preferences |
| `/api/data/export` `import` `reset` | Settings page data tools |

`src/proxy.ts` refreshes the Supabase session on every request and optimistically
redirects signed-out visitors. **In Next.js 16 the `middleware.ts` convention is
deprecated and renamed to `proxy.ts`** — every Supabase guide online still says
`middleware.ts`, and a file by that name here would silently never run.

Each handler runs `requireUser()` (`src/lib/api/session.ts`) before touching
data. The proxy redirect is a UX shortcut; this check plus RLS is what holds.

### Client

`useStore()` kept its shape, so no page or component needed rewriting beyond
copy changes. What changed underneath:

- `src/lib/auth.ts` — the PBKDF2/localStorage account code is gone; these are
  now thin wrappers over `/api/auth/*`.
- `src/lib/persistence.ts` — the server is the source of truth. localStorage is
  a cache in front of it (instant first paint) and an outbox behind it.
- `src/lib/outbox.ts` — mutations made offline queue up and replay on reconnect.
  Entry ids are client-generated UUIDs and the POST handlers upsert, so retries
  are idempotent. The queue collapses a create+delete pair to nothing, which is
  what makes the "Undo" toast work with no signal.
- `public/sw.js` — **fixed a real bug**: the catch-all stale-while-revalidate
  branch cached every same-origin GET, which would have included `/api/bootstrap`
  and served one account's data to the next person signing in on that device.
  `/api/*` and `/auth/*` now bypass the cache; version bumped to evict the old one.

### Guest mode

Still entirely local — no Supabase user, no rows. On signup or sign-in, a guest's
data is handed over via `POST /api/data/import` with `mode: "merge"`, so signing
in on a device that happens to have preview data can't wipe the account. The
`ash-guest` cookie exists only so `src/proxy.ts` doesn't bounce guests off
`/dashboard`; trusting it costs nothing, since every API route still demands a
real Supabase session.

## Not built

- **Account deletion.** Needs `auth.admin.deleteUser` and therefore a
  service-role key in the environment. Say the word and I'll add it.
- **Password-reset UI.** The two endpoints and `/auth/confirm` exist; there is no
  "forgot password?" link or `/reset-password` page yet.
- **Generated database types.** Run `npx supabase gen types typescript --linked >
  src/lib/supabase/database.types.ts` once linked; the row shapes are currently
  hand-written in `src/lib/api/mappers.ts`.
