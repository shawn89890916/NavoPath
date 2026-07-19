create table if not exists public.dayflow_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  settings jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.dayflow_profiles add column if not exists revision bigint not null default 0;

alter table public.dayflow_profiles enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'dayflow_profiles'
  ) then
    alter publication supabase_realtime add table public.dayflow_profiles;
  end if;
end;
$$;

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

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  delete from public.dayflow_profiles where user_id = current_user_id;
  delete from auth.users where id = current_user_id;
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;
