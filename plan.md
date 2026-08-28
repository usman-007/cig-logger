# Ash — Supabase Backend Migration Plan

Moving Ash from a **local-first, localStorage-only** app to a **Supabase Auth + Supabase Postgres**
backend, with all server code living in this same Next.js project as Route Handlers under
`src/app/api/`. No separate backend service.

> **Next.js 16.3.3 caveats that override most Supabase tutorials you'll find online:**
> - `middleware.ts` is **deprecated and renamed to `proxy.ts`** (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`).
>   Every Supabase SSR guide says `middleware.ts` — we use `src/proxy.ts` exporting `proxy()`.
> - `cookies()` from `next/headers` is **async** — `await cookies()`.
> - Route Handler `context.params` is a **Promise**; use the global `RouteContext<'/api/logs/[id]'>` helper.
> - `GET` Route Handlers are **dynamic by default** (since 15.0), so no `force-dynamic` needed.

---

## 1. Current state (what we're replacing)

| Concern | Today | After |
| --- | --- | --- |
| Accounts | [auth.ts](src/lib/auth.ts) — PBKDF2 hashes in `localStorage`, per-browser | Supabase Auth (`email` + `password`), cookie session |
| Session | `ash:session` localStorage key | `sb-*` httpOnly cookies, refreshed in `src/proxy.ts` |
| Data | `ash:data:<userId>` JSON blob | Postgres tables with RLS |
| Reads/writes | [persistence.ts](src/lib/persistence.ts) `AshStore` → localStorage | `AshStore` → `fetch('/api/…')`, localStorage demoted to offline cache |
| Server | none | Next.js Route Handlers in `src/app/api/` |

**Core strategy: the `useStore()` contract in [store.tsx](src/lib/store.tsx) does not change.**
All 13 consumer components (`dashboard`, `history`, `analytics`, `purchases`, `settings`,
`log-controller`, `log-fab`, `app-shell`, `timeline-card`, `since-last-card`, `purchase-modal`, …)
keep working untouched. We swap only what sits *behind* `ashStore`. That is the single biggest
lever for keeping this migration small.

**Types stay epoch-ms.** [types.ts](src/lib/types.ts) (`ts: number`, `createdAt: number`) is
consumed by [stats.ts](src/lib/stats.ts), [cost.ts](src/lib/cost.ts), [date.ts](src/lib/date.ts) and
every chart. Postgres stores `timestamptz`. One mapper module converts at the API boundary —
nothing else in the app learns about ISO strings.

---

## 2. Environment variables — what I need from you

Create `.env.local` in the project root. `.gitignore` already covers `.env*`, so it will not be committed.

### 2.1 Required — app runtime

```bash
# Supabase Dashboard → Project Settings → Data API → Project URL
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co

# Supabase Dashboard → Project Settings → API Keys
# New projects show a "publishable" key (sb_publishable_...).
# Older projects show a legacy "anon public" key (a JWT starting eyJ...).
# Either works — set the one your dashboard actually shows.
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxxxxx
# ...or, on a legacy project:
# NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...

# Used for emailRedirectTo on confirmation / password-reset emails.
# Must exactly match an entry in Auth → URL Configuration → Redirect URLs.
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Both `NEXT_PUBLIC_*` values are **inlined into the browser bundle at build time** — that is correct
and expected here. They are safe to expose *only because* Row Level Security is enabled on every
table (Section 5). RLS is not optional in this design; it is the actual security boundary.

### 2.2 Optional — server-only, privileged

```bash
# Supabase Dashboard → Project Settings → API Keys → "secret" / "service_role"
# NEVER prefix with NEXT_PUBLIC_. Bypasses RLS entirely.
SUPABASE_SECRET_KEY=sb_secret_xxxxxxxxxxxx
# ...or, on a legacy project:
# SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
```

Not needed for any normal read/write — every user request runs through the user's own session with
RLS applied. Only add it if we build:
- **Delete my account** (needs `auth.admin.deleteUser`)
- admin/analytics endpoints or scheduled jobs

I'd rather leave this out of `.env.local` until we actually implement account deletion.

### 2.3 Required — Supabase CLI only (shell / CI, not `.env.local`)

```bash
# Generated at https://supabase.com/dashboard/account/tokens
export SUPABASE_ACCESS_TOKEN=sbp_xxxxxxxxxxxx

# Your project ref — the subdomain in the project URL
export SUPABASE_PROJECT_REF=<project-ref>

# Database password chosen at project creation (Settings → Database → reset if lost)
export SUPABASE_DB_PASSWORD='...'
```

These authenticate `supabase link` and `supabase db push`. If you'd rather not export
`SUPABASE_ACCESS_TOKEN`, run `npx supabase login` once and skip it — the CLI prompts interactively.

### 2.4 Also needed from you (not env vars)

1. **Project region** — pick one near you; it's fixed after creation.
2. **Decision: email confirmation on or off?**
   Supabase requires confirmation by default. Off (Auth → Providers → Email → "Confirm email") gives
   instant signup and is fine for development. On is correct for production and needs the
   `/auth/confirm` route in Phase 5.
3. **Deployment URL** (when you deploy) — has to be added to Auth → URL Configuration → Site URL and
   Redirect URLs, and set as `NEXT_PUBLIC_SITE_URL` in the host's env.
4. **Confirmation that dropping / keeping guest mode** matches what you want — see Section 9.

---

## 3. Dependencies

```bash
npm install @supabase/supabase-js@^2.112.4 @supabase/ssr@^0.12.5 zod@^4.4.3
npm install -D supabase@^2.116.0
```

- `@supabase/ssr` — the cookie-aware client factories. **Do not** use the archived
  `@supabase/auth-helpers-nextjs`.
- `zod` v4 — request body validation on every Route Handler. Note v4 syntax: `z.email()` is
  top-level, and the option key is `error`, not `message`.
- `supabase` CLI as a devDependency so migrations are reproducible and version-pinned.

Add to `package.json` scripts:

```json
"db:new":   "supabase migration new",
"db:push":  "supabase db push",
"db:reset": "supabase db reset",
"db:types": "supabase gen types typescript --linked > src/lib/supabase/database.types.ts"
```

---

## 4. Supabase project setup (one-time, mostly dashboard)

1. Create the project at supabase.com; note the ref, URL, keys, DB password.
2. **Auth → Providers → Email**: enabled (default). Decide on "Confirm email" per §2.4.
3. **Auth → URL Configuration**:
   - Site URL: `http://localhost:3000` (swap for the real domain at deploy time)
   - Redirect URLs: `http://localhost:3000/**`
4. **Auth → Sign In / Providers**: set minimum password length to 8 to match our zod schema (the app
   currently allows 6 — we're raising it; see §8.2).
5. Local scaffolding:
   ```bash
   npx supabase init                       # creates supabase/config.toml + supabase/migrations/
   npx supabase link --project-ref $SUPABASE_PROJECT_REF
   ```
   `supabase init` also writes `supabase/.gitignore`. `supabase/config.toml` and everything under
   `supabase/migrations/` **should be committed**.

---

## 5. Database schema

Field-name mapping (TS ⇄ Postgres) — the only place this matters is the mapper module:

| TS (`types.ts`) | Column | Notes |
| --- | --- | --- |
| `CigaretteLog.ts` | `smoked_at timestamptz` | epoch ms ⇄ ISO |
| `Purchase.ts` | `purchased_at timestamptz` | epoch ms ⇄ ISO |
| `createdAt` | `created_at timestamptz` | epoch ms ⇄ ISO |
| `unitsPerItem` | `units_per_item int` | camel ⇄ snake |
| `AppData.startedAt` | `profiles.started_at` | |
| `Settings.*` | `user_settings.*` | camel ⇄ snake, one row per user |

### 5.1 Migration `0001_init.sql`

```bash
npx supabase migration new init
```

```sql
-- ── Enums ──────────────────────────────────────────────────────────────────
-- Enums (over text + CHECK) so `supabase gen types typescript` emits real
-- union types that line up with SmokeType / TriggerId / PurchaseCategory.
-- Adding a value later: alter type public.smoke_trigger add value 'new_one';
create type public.smoke_type        as enum ('factory', 'rolled');
create type public.smoke_trigger     as enum ('stress','boredom','social','coffee',
                                              'alcohol','after_meal','work_break','other');
create type public.purchase_category as enum ('pack','carton','tobacco','papers','filters','other');

-- ── profiles ───────────────────────────────────────────────────────────────
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  name       text not null default '',
  started_at timestamptz not null default now(),   -- AppData.startedAt
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── user_settings (mirrors DEFAULT_SETTINGS in constants.ts) ────────────────
create table public.user_settings (
  user_id                     uuid primary key references auth.users(id) on delete cascade,
  daily_limit                 int     not null default 10  check (daily_limit >= 0),
  pacing_minutes              int     not null default 60  check (pacing_minutes >= 0),
  currency                    text    not null default '$' check (char_length(currency) between 1 and 4),
  cigarettes_per_pack         int     not null default 20  check (cigarettes_per_pack > 0),
  packs_per_carton            int     not null default 10  check (packs_per_carton > 0),
  grams_per_roll              numeric(6,3) not null default 0.7 check (grams_per_roll > 0),
  default_type                public.smoke_type not null default 'factory',
  fallback_pack_price         numeric(10,2) not null default 9 check (fallback_pack_price >= 0),
  ask_trigger_after_quick_log boolean not null default true,
  pacing_warnings             boolean not null default true,
  updated_at                  timestamptz not null default now()
);

-- ── cigarette_logs ─────────────────────────────────────────────────────────
-- id is supplied by the client (crypto.randomUUID) so one-tap logging can be
-- optimistic and the offline outbox can retry idempotently. See §7.3.
create table public.cigarette_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  smoked_at  timestamptz not null,
  type       public.smoke_type not null,
  trigger    public.smoke_trigger,
  note       text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now()
);
create index cigarette_logs_user_smoked_at_idx
  on public.cigarette_logs (user_id, smoked_at desc);

-- ── purchases ──────────────────────────────────────────────────────────────
create table public.purchases (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  purchased_at  timestamptz not null,
  category      public.purchase_category not null,
  name          text not null default '' check (char_length(name) <= 120),
  cost          numeric(12,2) not null check (cost >= 0),
  quantity      numeric(12,3) not null check (quantity > 0),
  units_per_item int check (units_per_item is null or units_per_item > 0),
  note          text check (note is null or char_length(note) <= 500),
  created_at    timestamptz not null default now()
);
create index purchases_user_purchased_at_idx
  on public.purchases (user_id, purchased_at desc);
```

Notes on choices:
- `trigger` is a non-reserved keyword in Postgres, so it works unquoted as a column name and maps
  1:1 onto `CigaretteLog.trigger`.
- `numeric` (not `float`) for money and grams — PostgREST serialises it as a JSON number, so the
  client keeps getting plain `number`s and `cost.ts` needs no change.
- Composite `(user_id, <date> desc)` indexes match how [stats.ts](src/lib/stats.ts) and the history
  page read — newest-first, always scoped to one user.

### 5.2 Migration `0002_rls.sql`

```bash
npx supabase migration new rls
```

```sql
alter table public.profiles       enable row level security;
alter table public.user_settings  enable row level security;
alter table public.cigarette_logs enable row level security;
alter table public.purchases      enable row level security;

-- profiles: no insert policy — rows are created by the signup trigger only.
create policy "profiles_select_own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles
  for update to authenticated using ((select auth.uid()) = id)
                                with check ((select auth.uid()) = id);

create policy "user_settings_select_own" on public.user_settings
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "user_settings_update_own" on public.user_settings
  for update to authenticated using ((select auth.uid()) = user_id)
                                with check ((select auth.uid()) = user_id);
create policy "user_settings_insert_own" on public.user_settings
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "cigarette_logs_select_own" on public.cigarette_logs
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "cigarette_logs_insert_own" on public.cigarette_logs
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "cigarette_logs_update_own" on public.cigarette_logs
  for update to authenticated using ((select auth.uid()) = user_id)
                                with check ((select auth.uid()) = user_id);
create policy "cigarette_logs_delete_own" on public.cigarette_logs
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "purchases_select_own" on public.purchases
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "purchases_insert_own" on public.purchases
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "purchases_update_own" on public.purchases
  for update to authenticated using ((select auth.uid()) = user_id)
                                with check ((select auth.uid()) = user_id);
create policy "purchases_delete_own" on public.purchases
  for delete to authenticated using ((select auth.uid()) = user_id);
```

`(select auth.uid())` rather than bare `auth.uid()` — Postgres hoists it into an InitPlan and
evaluates it once per query instead of once per row. Meaningful on the history page.

### 5.3 Migration `0003_triggers.sql`

```bash
npx supabase migration new triggers
```

```sql
-- Provision profile + settings the moment a user signs up, so the app never
-- has to handle a "signed in but no profile row" state.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- keep updated_at honest
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

create trigger user_settings_touch_updated_at
  before update on public.user_settings
  for each row execute function public.touch_updated_at();
```

`security definer` + `set search_path = ''` + fully schema-qualified names is required here — it's
what Supabase's own database linter enforces, and without it the trigger is a privilege-escalation
surface.

### 5.4 Running the migrations

```bash
npx supabase db push          # applies pending migrations to the linked project
npm run db:types              # regenerates src/lib/supabase/database.types.ts
```

Verification checklist after push:
- Table Editor shows all 4 tables with the **RLS enabled** badge.
- Database → Advisors → Security: zero errors.
- Sign up a throwaway user; confirm `profiles` and `user_settings` each gained exactly one row.
- In the SQL editor, `select * from public.cigarette_logs;` as a non-service role returns 0 rows for
  a different user's data.

Every later schema change goes through `supabase migration new <name>` → edit SQL → `db push`.
Never edit the schema by hand in the dashboard once this is set up, or the migration history and the
live database drift apart.

---

## 6. Supabase client wiring

### 6.1 `src/lib/supabase/client.ts` — browser

```ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
```

Only needed if we ever talk to Supabase directly from the browser. In this design we generally
don't — the client talks to our own `/api/*` routes.

### 6.2 `src/lib/supabase/server.ts` — Server Components & Route Handlers

```ts
import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function createClient() {
  const cookieStore = await cookies();          // async in Next 16

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components can't write cookies. Safe to swallow *only*
            // because src/proxy.ts refreshes the session on every request.
          }
        },
      },
    },
  );
}
```

### 6.3 `src/proxy.ts` — session refresh + optimistic route guard

This is the file every Supabase tutorial calls `middleware.ts`. In Next 16 it is `proxy.ts`,
placed next to `src/app/`, exporting `proxy`.

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_PATHS = ["/login", "/offline", "/auth"];

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          supabaseResponse = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Must be getUser(), not getSession() — getUser() revalidates the JWT with
  // Supabase. And it must be called here: it is what triggers the refresh.
  const { data: { user } } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));

  if (!user && !isPublic && path !== "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // IMPORTANT: return supabaseResponse itself. Building a fresh NextResponse
  // here without copying its cookies drops the refreshed tokens and logs
  // users out at random intervals.
  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons|manifest.webmanifest|sw.js|.*\\.png$).*)"],
};
```

The redirect here is an **optimistic** check (Next's term). It is a UX shortcut, not the security
boundary — RLS and the per-route `requireUser()` check are. Note the matcher deliberately excludes
`sw.js`, `manifest.webmanifest` and `/icons` so the PWA install path keeps working when signed out.

### 6.4 `src/lib/api/session.ts` — the Data Access Layer

```ts
import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/** Cached per render pass / per request — safe to call from many handlers. */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
});

export class Unauthorized extends Error {}

export async function requireUser() {
  const user = await getUser();
  if (!user) throw new Unauthorized();
  return user;
}
```

Every mutating handler calls `requireUser()` first. This is the pattern the Next.js auth guide calls
a Data Access Layer, and it's what makes the proxy check safely optional.

---

## 7. The API surface (`src/app/api/`)

All handlers: validate with zod → `requireUser()` → query through the **user-scoped** client so RLS
applies → map to the app's epoch-ms shape → return JSON. Never the secret key for user data.

### 7.1 Routes

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/signup` | `signUp({ email, password, options: { data: { name }, emailRedirectTo } })` |
| `POST` | `/api/auth/login` | `signInWithPassword` |
| `POST` | `/api/auth/logout` | `signOut` |
| `GET` | `/api/auth/me` | current session user, or `null` |
| `POST` | `/api/auth/forgot-password` | `resetPasswordForEmail` |
| `POST` | `/api/auth/reset-password` | `updateUser({ password })` on a recovery session |
| `GET` | `/api/bootstrap` | **one round trip**: profile + settings + logs + purchases |
| `POST` | `/api/logs` | create (client-supplied `id`) |
| `PATCH`/`DELETE` | `/api/logs/[id]` | edit / delete one log |
| `POST` | `/api/purchases` | create |
| `PATCH`/`DELETE` | `/api/purchases/[id]` | edit / delete one purchase |
| `PATCH` | `/api/settings` | partial settings update |
| `GET` | `/api/data/export` | full JSON export (feeds the Settings page download) |
| `POST` | `/api/data/import` | bulk upsert — also the guest→account migration path |
| `POST` | `/api/data/reset` | delete all logs + purchases, reset settings |

`/api/bootstrap` exists specifically so [persistence.ts](src/lib/persistence.ts) `hydrate()` stays a
single fetch, matching how it does a single `localStorage.getItem` today.

### 7.2 Handler shape (Next 16 dynamic params)

```ts
// src/app/api/logs/[id]/route.ts
import { type NextRequest, NextResponse } from "next/server";

export async function PATCH(req: NextRequest, ctx: RouteContext<'/api/logs/[id]'>) {
  const { id } = await ctx.params;          // params is a Promise in Next 15+
  // ...
}
```

`RouteContext` is a global helper generated by `next dev` / `next build` / `next typegen` — no import.

### 7.3 Client-generated IDs

[utils.ts](src/lib/utils.ts) `uid("cig")` produces `cig_<base36><hex>`, which is not a UUID. Switch
log/purchase creation to `crypto.randomUUID()` and send the id in the POST body. This buys us:
- **optimistic UI** — the one-tap FAB inserts into the store immediately with its final id
- **idempotent retries** — the offline outbox can replay a POST safely
  (`insert … on conflict (id) do nothing`)

Keep `uid()` in `utils.ts` for any non-persisted client-only ids.

### 7.4 Shared validation

`src/lib/api/schemas.ts` holds the zod schemas, imported by both handlers and (for pre-flight
validation) the client. `src/lib/api/mappers.ts` holds `rowToLog`, `logToRow`, `rowToPurchase`,
`rowToSettings`, … — the only place epoch-ms ⇄ ISO and camel ⇄ snake conversion lives.

---

## 8. Client rewiring

### 8.1 `src/lib/persistence.ts`

`AshStore` keeps its `useSyncExternalStore` shape and its public methods (`subscribe`, `getSnapshot`,
`getServerSnapshot`, `enterSession`, `clearSession`, `update`, `replace`). Changes inside:

- `hydrate()`: read the localStorage cache for an instant first paint, then `fetch('/api/bootstrap')`
  and commit the authoritative snapshot. Add `syncing: boolean` to `Snapshot` for a subtle
  "syncing…" affordance.
- `update(mutate, sync?)`: commit optimistically, write the localStorage cache, fire `sync()`. On
  failure, roll back and surface a toast (the [toast provider](src/components/ui/toast.tsx) is
  already mounted in the root layout).
- `persist()`: unchanged in spirit — localStorage becomes a **cache**, not the source of truth.
- The existing cross-tab `storage` listener still works and is worth keeping.

### 8.2 `src/lib/auth.ts`

Delete the PBKDF2 block (`derive`, `readAccounts`, `writeAccounts`, `accountExists`, `hasAnyAccount`,
`StoredAccount`). `signUp` / `signIn` / `signOut` become thin `fetch` wrappers over `/api/auth/*`.
Keep `normalizeEmail`, `validateEmail`, `continueAsGuest`, `claimGuestData`, `guestHasData` —
guest mode stays local (§9).

Password minimum moves **6 → 8** to match the Supabase project setting and the zod schema. The
`minLength={6}` and `hint="6+ characters"` in [login/page.tsx](src/app/login/page.tsx) need the same
bump. `StoredAccount` can be dropped from [types.ts](src/lib/types.ts); `Session` stays as the
client-side shape.

### 8.3 `src/lib/store.tsx`

Public `StoreValue` interface is **unchanged**. Internal changes only:
- `addLog` / `addPurchase` use `crypto.randomUUID()` and pass a `sync` callback to `ashStore.update`
- `signIn` / `signUp` / `signOut` await the new fetch-based `auth.*`
- `exportData` / `importData` / `resetData` call `/api/data/*`

### 8.4 Error text

`auth.ts` today throws user-facing copy ("No account found for that email on this device.").
Supabase returns its own messages ("Invalid login credentials"). Map Supabase error codes to
Ash-voiced copy in one place so the login page's `catch` block keeps rendering good text.

### 8.5 Copy that becomes false

- [login/page.tsx](src/app/login/page.tsx): *"Your data is stored on this device only. Nothing is
  uploaded anywhere."* and *"Sets up a private profile on this device."* — both need rewriting.
- [auth.ts](src/lib/auth.ts) header comment about there being no server.
- Settings page wording around export/reset, if it mentions local-only storage.

---

## 9. Guest mode

Guest mode ([`continueAsGuest`](src/lib/auth.ts), `GUEST_USER_ID`, `claimGuestData`) is a real
feature of the current app, and the login page promises preview data carries over.

**Recommendation: keep guest mode purely local.** No Supabase user, no rows, `ash:data:guest` exactly
as today. On signup, `claimGuestData` reads the guest blob and POSTs it to `/api/data/import`
instead of copying it to another localStorage key. The user-visible promise stays true and we avoid
provisioning throwaway database rows.

Alternative: Supabase **anonymous sign-ins** (a real `auth.users` row with `is_anonymous = true`,
later upgraded via `updateUser`). Cleaner conceptually — one code path — but it needs anonymous
sign-ins enabled, abuse protection (CAPTCHA), and an RLS review, since anonymous users are
`authenticated` too. Not worth it here unless you want cross-device guest sync.

---

## 10. Offline / PWA

The app is an installable PWA with a service worker. Adding a network dependency has two concrete
consequences:

1. **`public/sw.js` will cache API responses today, and must not.** The final `fetch` branch is
   `staleWhileRevalidate` for *every* same-origin GET — that includes `/api/bootstrap` and
   `/api/auth/me`, so one user's data could be served from cache after a sign-out. **Add an early
   `if (url.pathname.startsWith("/api/")) return;`** and bump `VERSION` to `ash-v2` to evict the old
   caches. This is a correctness fix, not an optimisation.
2. **Mutations must survive being offline.** One-tap logging is the core interaction; it cannot
   require connectivity. Add a `ash:outbox:<userId>` queue in localStorage: failed mutations append,
   an `online` listener replays them in order. Idempotent because IDs are client-generated (§7.3).
   Conflict policy: last-write-wins on `updated_at`, which is fine for a single-user tracker.

This is the largest piece of net-new work in the migration and it is why it gets its own phase.

---

## 11. Phased delivery

Each phase leaves the app in a working state.

| Phase | Scope | Outcome |
| --- | --- | --- |
| **0** | Deps, `.env.local`, `supabase init`, `link` | CLI talks to the project |
| **1** | Migrations 0001–0003, `db push`, `db:types` | Schema + RLS live, verified in Advisors |
| **2** | `supabase/client.ts`, `supabase/server.ts`, `src/proxy.ts`, `api/session.ts` | Sessions work end-to-end |
| **3** | `/api/auth/*`, rewrite `lib/auth.ts`, update login copy + password rules | Real signup/login, still localStorage data |
| **4** | `/api/bootstrap`, `/api/logs`, `/api/purchases`, `/api/settings`, mappers, schemas; rewire `persistence.ts` | **Data lives in Postgres** |
| **5** | `/auth/confirm` (`verifyOtp`), forgot/reset password pages | Production-ready auth |
| **6** | `/api/data/{export,import,reset}`, guest→account migration | Settings page fully wired |
| **7** | `sw.js` API-bypass fix, offline outbox, sync indicator | PWA is trustworthy again |
| **8** | Convert `src/app/page.tsx` to a server component that redirects | Removes the hydration flash on entry |

Phases 1–4 are the actual migration. 5–8 are what make it production-quality.

---

## 12. Decisions I'd like from you before Phase 1

1. **Email confirmation: on or off to start?** Off is faster to develop against; on adds Phase 5 to
   the critical path.
2. **Guest mode: keep local, or drop it?** (§9 — my recommendation is keep it local.)
3. **Password minimum 8?** Raising from the current 6 will invalidate nothing, since no real accounts
   exist yet.
4. **Settings as typed columns (planned) or a JSONB blob?** Typed columns give real constraints and
   generated types; JSONB means no migration when a setting is added. I've gone with typed columns —
   [Settings](src/lib/types.ts) looks stable and the constraints are worth having.
5. **Do you want account deletion?** If yes, I need `SUPABASE_SECRET_KEY` in `.env.local`.

---

## 13. Risks

- **The `supabaseResponse` footgun in `proxy.ts`** (§6.3) — the single most common cause of "Supabase
  randomly signs users out". Getting it right is not optional.
- **Every Supabase + Next.js guide online targets `middleware.ts`.** In Next 16 that file is
  deprecated. Copy-pasting a tutorial will silently do nothing.
- **`NEXT_PUBLIC_*` is frozen at build time.** Deploying the same build to two environments with
  different Supabase projects will not work.
- **The dashboard/analytics pages compute over the full log set in memory** ([stats.ts](src/lib/stats.ts)).
  That's fine for months of data, but past ~10k logs the bootstrap payload gets heavy. If that
  happens, move aggregation into Postgres views — a later concern, not a blocker.
- **Timezone.** [date.ts](src/lib/date.ts) does day bucketing in the browser's local timezone. Storing
  `timestamptz` and converting back to epoch ms preserves today's behaviour exactly. Don't be tempted
  to bucket by day in SQL — it would change results for anyone who travels.
