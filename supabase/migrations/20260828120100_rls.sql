-- Row Level Security.
--
-- This is the real security boundary, not the /api handlers and not the
-- redirect in src/proxy.ts. NEXT_PUBLIC_SUPABASE_ANON_KEY ships in the browser
-- bundle, so these policies are what keep one user out of another's data.
--
-- `(select auth.uid())` rather than a bare `auth.uid()`: the subquery form is
-- hoisted into an InitPlan and evaluated once per query instead of once per
-- row. Noticeable on the history page.

alter table public.profiles       enable row level security;
alter table public.user_settings  enable row level security;
alter table public.cigarette_logs enable row level security;
alter table public.purchases      enable row level security;

-- profiles: no insert policy on purpose — rows come from the signup trigger.
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- user_settings
create policy "user_settings_select_own" on public.user_settings
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "user_settings_insert_own" on public.user_settings
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "user_settings_update_own" on public.user_settings
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- cigarette_logs
create policy "cigarette_logs_select_own" on public.cigarette_logs
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "cigarette_logs_insert_own" on public.cigarette_logs
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "cigarette_logs_update_own" on public.cigarette_logs
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "cigarette_logs_delete_own" on public.cigarette_logs
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- purchases
create policy "purchases_select_own" on public.purchases
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "purchases_insert_own" on public.purchases
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "purchases_update_own" on public.purchases
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "purchases_delete_own" on public.purchases
  for delete to authenticated
  using ((select auth.uid()) = user_id);
