create table if not exists public.dayflow_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  settings jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.dayflow_profiles enable row level security;

grant select, insert, update, delete on public.dayflow_profiles to authenticated;

drop policy if exists "dayflow_profiles_select_own" on public.dayflow_profiles;
drop policy if exists "dayflow_profiles_insert_own" on public.dayflow_profiles;
drop policy if exists "dayflow_profiles_update_own" on public.dayflow_profiles;
drop policy if exists "dayflow_profiles_delete_own" on public.dayflow_profiles;

create policy "dayflow_profiles_select_own"
  on public.dayflow_profiles
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "dayflow_profiles_insert_own"
  on public.dayflow_profiles
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "dayflow_profiles_update_own"
  on public.dayflow_profiles
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "dayflow_profiles_delete_own"
  on public.dayflow_profiles
  for delete
  to authenticated
  using (auth.uid() = user_id);
