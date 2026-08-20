create table if not exists public.navopath_agent_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id text,
  trigger text not null default 'manual' check (trigger in ('manual', 'start_brief', 'end_review')),
  status text not null check (status in ('planned', 'applied', 'pending_confirmation', 'rejected', 'undone', 'failed')),
  summary text not null default '',
  command_log jsonb not null default '[]'::jsonb,
  pending_commands jsonb not null default '[]'::jsonb,
  inverse_commands jsonb not null default '[]'::jsonb,
  base_revision bigint not null,
  applied_revision bigint,
  undo_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists navopath_agent_runs_user_created_idx
  on public.navopath_agent_runs(user_id, created_at desc);

alter table public.navopath_agent_runs enable row level security;
grant select on public.navopath_agent_runs to authenticated;
grant select, insert, update, delete on public.navopath_agent_runs to service_role;

drop policy if exists "navopath_agent_runs_select_own" on public.navopath_agent_runs;
create policy "navopath_agent_runs_select_own"
  on public.navopath_agent_runs for select to authenticated
  using (auth.uid() = user_id);

create table if not exists public.navopath_calendar_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  url_ciphertext text not null,
  url_iv text not null,
  url_hash text not null,
  display_url text not null,
  color text,
  enabled boolean not null default true,
  etag text,
  last_modified text,
  last_synced_at timestamptz,
  next_sync_at timestamptz,
  sync_status text not null default 'pending' check (sync_status in ('pending', 'ready', 'error')),
  sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, url_hash)
);

create index if not exists navopath_calendar_sources_user_idx
  on public.navopath_calendar_sources(user_id, created_at);

alter table public.navopath_calendar_sources enable row level security;
-- Calendar URLs can contain bearer-like secrets. Only authenticated Edge
-- Functions using the service role may access this table directly.
revoke all on public.navopath_calendar_sources from public, anon, authenticated;
grant all on public.navopath_calendar_sources to service_role;

create table if not exists public.navopath_calendar_occurrences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_id uuid not null references public.navopath_calendar_sources(id) on delete cascade,
  external_uid text not null,
  recurrence_id text not null default '',
  title text not null default 'Busy',
  description text not null default '',
  location text not null default '',
  start_at timestamptz not null,
  end_at timestamptz not null,
  start_date date not null,
  end_date date not null,
  all_day boolean not null default false,
  status text not null default 'confirmed',
  updated_at timestamptz not null default now(),
  unique (source_id, external_uid, recurrence_id, start_at)
);

create index if not exists navopath_calendar_occurrences_user_range_idx
  on public.navopath_calendar_occurrences(user_id, start_at, end_at);

alter table public.navopath_calendar_occurrences enable row level security;
revoke all on public.navopath_calendar_occurrences from public, anon, authenticated;
grant all on public.navopath_calendar_occurrences to service_role;

create or replace function public.apply_navopath_agent_run(
  expected_revision bigint,
  next_data jsonb,
  next_settings jsonb,
  target_run_id uuid,
  next_status text,
  next_command_log jsonb,
  next_inverse_commands jsonb,
  next_undo_expires_at timestamptz
)
returns table(data jsonb, settings jsonb, revision bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if next_status not in ('applied', 'pending_confirmation', 'undone') then
    raise exception 'Invalid agent run status';
  end if;

  update public.dayflow_profiles
  set data = next_data,
      settings = next_settings,
      revision = dayflow_profiles.revision + 1,
      updated_at = now()
  where user_id = current_user_id
    and dayflow_profiles.revision = expected_revision
  returning dayflow_profiles.data, dayflow_profiles.settings, dayflow_profiles.revision
  into data, settings, revision;

  if not found then
    raise exception 'PROFILE_REVISION_CONFLICT';
  end if;

  update public.navopath_agent_runs
  set status = next_status,
      command_log = coalesce(next_command_log, '[]'::jsonb),
      pending_commands = case when next_status = 'pending_confirmation' then pending_commands else '[]'::jsonb end,
      inverse_commands = coalesce(next_inverse_commands, '[]'::jsonb),
      applied_revision = revision,
      undo_expires_at = next_undo_expires_at,
      updated_at = now()
  where id = target_run_id and user_id = current_user_id;

  if not found then
    raise exception 'Agent run not found';
  end if;

  return next;
end;
$$;

revoke all on function public.apply_navopath_agent_run(bigint, jsonb, jsonb, uuid, text, jsonb, jsonb, timestamptz) from public, anon;
grant execute on function public.apply_navopath_agent_run(bigint, jsonb, jsonb, uuid, text, jsonb, jsonb, timestamptz) to authenticated;
