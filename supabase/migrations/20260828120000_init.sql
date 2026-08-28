-- Ash — initial schema.
--
-- Enums rather than text + CHECK so `supabase gen types typescript` emits real
-- union types that line up with SmokeType / TriggerId / PurchaseCategory in
-- src/lib/types.ts. To add a value later:
--   alter type public.smoke_trigger add value 'new_one';
create type public.smoke_type        as enum ('factory', 'rolled');
create type public.smoke_trigger     as enum ('stress', 'boredom', 'social', 'coffee',
                                              'alcohol', 'after_meal', 'work_break', 'other');
create type public.purchase_category as enum ('pack', 'carton', 'tobacco', 'papers',
                                              'filters', 'other');

-- ── profiles ────────────────────────────────────────────────────────────────
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  name       text not null default '',
  -- AppData.startedAt: when tracking began, used for lifetime averages.
  started_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── user_settings ───────────────────────────────────────────────────────────
-- One row per user. Defaults mirror DEFAULT_SETTINGS in src/lib/constants.ts —
-- keep the two in step.
create table public.user_settings (
  user_id                     uuid primary key references auth.users (id) on delete cascade,
  daily_limit                 int     not null default 10  check (daily_limit between 1 and 200),
  pacing_minutes              int     not null default 60  check (pacing_minutes between 1 and 1440),
  currency                    text    not null default '$' check (char_length(currency) between 1 and 4),
  cigarettes_per_pack         int     not null default 20  check (cigarettes_per_pack between 1 and 100),
  packs_per_carton            int     not null default 10  check (packs_per_carton between 1 and 100),
  grams_per_roll              numeric(6, 3)  not null default 0.7 check (grams_per_roll > 0),
  default_type                public.smoke_type not null default 'factory',
  fallback_pack_price         numeric(10, 2) not null default 9 check (fallback_pack_price >= 0),
  ask_trigger_after_quick_log boolean not null default true,
  pacing_warnings             boolean not null default true,
  updated_at                  timestamptz not null default now()
);

-- ── cigarette_logs ──────────────────────────────────────────────────────────
-- `id` is supplied by the client (crypto.randomUUID) so one-tap logging can
-- commit optimistically and the offline outbox can replay a POST idempotently.
-- The default is a fallback for rows inserted by hand.
create table public.cigarette_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  smoked_at  timestamptz not null,
  type       public.smoke_type not null,
  trigger    public.smoke_trigger,
  note       text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now()
);

-- Every read is "newest first, for one user" — see src/lib/stats.ts.
create index cigarette_logs_user_smoked_at_idx
  on public.cigarette_logs (user_id, smoked_at desc);

-- ── purchases ───────────────────────────────────────────────────────────────
-- numeric (not float) for money and grams: PostgREST serialises it as a JSON
-- number, so src/lib/cost.ts keeps receiving plain numbers.
create table public.purchases (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  purchased_at   timestamptz not null,
  category       public.purchase_category not null,
  name           text not null default '' check (char_length(name) <= 120),
  cost           numeric(12, 2) not null check (cost >= 0),
  quantity       numeric(12, 3) not null check (quantity > 0),
  units_per_item int check (units_per_item is null or units_per_item > 0),
  note           text check (note is null or char_length(note) <= 500),
  created_at     timestamptz not null default now()
);

create index purchases_user_purchased_at_idx
  on public.purchases (user_id, purchased_at desc);
