create table if not exists public.navopath_cloud_assistant_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  timezone text not null default 'Asia/Shanghai' check (timezone = 'Asia/Shanghai'),
  morning_time time not null default '08:30',
  evening_time time not null default '20:30',
  quiet_after time not null default '19:00',
  quiet_until time not null default '08:30',
  email_enabled boolean not null default false,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.navopath_cloud_assistant_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  event_cursor bigint not null default 0,
  last_snapshot jsonb not null default '{}'::jsonb,
  last_scan_summary text not null default '',
  last_morning_run_date date,
  last_evening_run_date date,
  last_model_call_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.navopath_workspace_events (
  id uuid primary key default gen_random_uuid(),
  event_cursor bigint generated always as identity unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  dedupe_key text not null check (char_length(dedupe_key) between 1 and 200),
  changed_files jsonb not null default '[]'::jsonb,
  fragments jsonb not null default '[]'::jsonb,
  summary text not null default '' check (char_length(summary) <= 4000),
  schedule_impact text not null default '' check (char_length(schedule_impact) <= 2000),
  source_timestamp timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'processed', 'failed')),
  processing_started_at timestamptz,
  processed_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

create index if not exists navopath_workspace_events_pending_idx
  on public.navopath_workspace_events(user_id, status, created_at);

create table if not exists public.navopath_assistant_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null check (char_length(idempotency_key) between 1 and 240),
  trigger text not null check (trigger in ('morning', 'evening', 'workspace_event')),
  event_ids jsonb not null default '[]'::jsonb,
  status text not null default 'processing' check (status in ('processing', 'completed', 'failed')),
  model_called boolean not null default false,
  result jsonb not null default '{}'::jsonb,
  failure_reason text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (user_id, idempotency_key)
);

create table if not exists public.navopath_cloud_change_sets (
  id uuid primary key default gen_random_uuid(),
  change_cursor bigint generated always as identity unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null check (char_length(idempotency_key) between 1 and 240),
  source text not null check (source in ('cloud_assistant', 'mcp', 'workspace_event', 'manual')),
  status text not null check (status in ('applied', 'pending_confirmation', 'undone', 'failed')),
  summary text not null default '' check (char_length(summary) <= 2000),
  reason text not null default '' check (char_length(reason) <= 2000),
  changes jsonb not null default '[]'::jsonb,
  inverse_operations jsonb not null default '[]'::jsonb,
  base_revision bigint not null,
  applied_revision bigint,
  undo_expires_at timestamptz,
  undone_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create index if not exists navopath_cloud_change_sets_user_cursor_idx
  on public.navopath_cloud_change_sets(user_id, change_cursor desc);

create table if not exists public.navopath_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null check (char_length(idempotency_key) between 1 and 240),
  kind text not null check (kind in ('summary', 'material_change', 'deadline_risk', 'weather', 'needs_input')),
  title text not null check (char_length(title) between 1 and 160),
  body text not null check (char_length(body) between 1 and 2000),
  urgency text not null default 'normal' check (urgency in ('normal', 'urgent')),
  channels text[] not null default array['in_app']::text[],
  status text not null default 'queued' check (status in ('queued', 'sent', 'deferred', 'failed')),
  deliver_after timestamptz not null default now(),
  sent_at timestamptz,
  read_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create index if not exists navopath_notifications_user_created_idx
  on public.navopath_notifications(user_id, created_at desc);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'navopath_notifications'
    ) then
    alter publication supabase_realtime add table public.navopath_notifications;
  end if;
end;
$$;

alter table public.navopath_cloud_assistant_settings enable row level security;
alter table public.navopath_cloud_assistant_state enable row level security;
alter table public.navopath_workspace_events enable row level security;
alter table public.navopath_assistant_jobs enable row level security;
alter table public.navopath_cloud_change_sets enable row level security;
alter table public.navopath_notifications enable row level security;

grant select, insert, update on public.navopath_cloud_assistant_settings to authenticated;
grant select on public.navopath_cloud_assistant_state, public.navopath_workspace_events, public.navopath_cloud_change_sets, public.navopath_notifications to authenticated;
grant update (read_at) on public.navopath_notifications to authenticated;
grant all on public.navopath_cloud_assistant_settings, public.navopath_cloud_assistant_state, public.navopath_workspace_events,
  public.navopath_assistant_jobs, public.navopath_cloud_change_sets, public.navopath_notifications to service_role;

drop policy if exists "navopath_cloud_settings_own" on public.navopath_cloud_assistant_settings;
create policy "navopath_cloud_settings_own" on public.navopath_cloud_assistant_settings
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "navopath_cloud_state_own" on public.navopath_cloud_assistant_state;
create policy "navopath_cloud_state_own" on public.navopath_cloud_assistant_state
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "navopath_workspace_events_own" on public.navopath_workspace_events;
create policy "navopath_workspace_events_own" on public.navopath_workspace_events
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "navopath_change_sets_own" on public.navopath_cloud_change_sets;
create policy "navopath_change_sets_own" on public.navopath_cloud_change_sets
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "navopath_notifications_own" on public.navopath_notifications;
create policy "navopath_notifications_own" on public.navopath_notifications
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "navopath_notifications_mark_read_own" on public.navopath_notifications;
create policy "navopath_notifications_mark_read_own" on public.navopath_notifications
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.claim_navopath_workspace_events(
  target_user_id uuid,
  ready_before timestamptz,
  max_events integer default 50
)
returns setof public.navopath_workspace_events
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with claimed as (
    select id
    from public.navopath_workspace_events
    where user_id = target_user_id
      and status = 'pending'
      and created_at <= ready_before
    order by event_cursor
    for update skip locked
    limit greatest(1, least(max_events, 100))
  )
  update public.navopath_workspace_events event
  set status = 'processing', processing_started_at = now(), failure_reason = null
  from claimed
  where event.id = claimed.id
  returning event.*;
end;
$$;

create or replace function public.claim_navopath_assistant_job(
  target_user_id uuid,
  next_idempotency_key text,
  next_trigger text,
  next_event_ids jsonb
)
returns table(job_id uuid, claimed boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.navopath_assistant_jobs%rowtype;
begin
  if next_trigger not in ('morning', 'evening', 'workspace_event') then
    raise exception 'Invalid assistant trigger';
  end if;

  select * into existing
  from public.navopath_assistant_jobs
  where user_id = target_user_id and idempotency_key = next_idempotency_key
  for update;

  if found and existing.status <> 'failed' then
    job_id := existing.id;
    claimed := false;
    return next;
    return;
  end if;

  if found then
    update public.navopath_assistant_jobs
    set status = 'processing', event_ids = coalesce(next_event_ids, '[]'::jsonb),
        model_called = false, result = '{}'::jsonb, failure_reason = null,
        started_at = now(), finished_at = null
    where id = existing.id
    returning id into job_id;
  else
    insert into public.navopath_assistant_jobs(user_id, idempotency_key, trigger, event_ids)
    values (target_user_id, next_idempotency_key, next_trigger, coalesce(next_event_ids, '[]'::jsonb))
    returning id into job_id;
  end if;
  claimed := true;
  return next;
end;
$$;

create or replace function public.apply_navopath_cloud_change_set(
  target_user_id uuid,
  expected_revision bigint,
  next_data jsonb,
  next_idempotency_key text,
  next_source text,
  next_summary text,
  next_reason text,
  next_changes jsonb,
  next_inverse_operations jsonb,
  next_undo_expires_at timestamptz
)
returns table(change_set_id uuid, change_cursor bigint, status text, revision bigint, duplicate boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.navopath_cloud_change_sets%rowtype;
begin
  if next_source not in ('cloud_assistant', 'mcp', 'workspace_event', 'manual') then
    raise exception 'Invalid change source';
  end if;
  if pg_column_size(next_data) > 6000000 then
    raise exception 'Profile payload is too large';
  end if;

  select * into existing from public.navopath_cloud_change_sets
  where user_id = target_user_id and idempotency_key = next_idempotency_key;
  if found then
    change_set_id := existing.id;
    change_cursor := existing.change_cursor;
    status := existing.status;
    revision := existing.applied_revision;
    duplicate := true;
    return next;
    return;
  end if;

  update public.dayflow_profiles
  set data = next_data, revision = dayflow_profiles.revision + 1, updated_at = now()
  where user_id = target_user_id and dayflow_profiles.revision = expected_revision
  returning dayflow_profiles.revision into revision;
  if not found then
    raise exception 'PROFILE_REVISION_CONFLICT';
  end if;

  insert into public.navopath_cloud_change_sets(
    user_id, idempotency_key, source, status, summary, reason, changes,
    inverse_operations, base_revision, applied_revision, undo_expires_at
  ) values (
    target_user_id, next_idempotency_key, next_source, 'applied', left(next_summary, 2000),
    left(next_reason, 2000), coalesce(next_changes, '[]'::jsonb),
    coalesce(next_inverse_operations, '[]'::jsonb), expected_revision, revision, next_undo_expires_at
  ) returning id, navopath_cloud_change_sets.change_cursor
  into change_set_id, change_cursor;
  status := 'applied';
  duplicate := false;
  return next;
end;
$$;

create or replace function public.record_navopath_pending_change_set(
  target_user_id uuid,
  expected_revision bigint,
  next_idempotency_key text,
  next_source text,
  next_summary text,
  next_reason text,
  next_changes jsonb
)
returns table(change_set_id uuid, change_cursor bigint, status text, duplicate boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.navopath_cloud_change_sets%rowtype;
begin
  select * into existing from public.navopath_cloud_change_sets
  where user_id = target_user_id and idempotency_key = next_idempotency_key;
  if found then
    change_set_id := existing.id;
    change_cursor := existing.change_cursor;
    status := existing.status;
    duplicate := true;
    return next;
    return;
  end if;

  insert into public.navopath_cloud_change_sets(user_id, idempotency_key, source, status, summary, reason, changes, base_revision)
  values (target_user_id, next_idempotency_key, next_source, 'pending_confirmation', left(next_summary, 2000), left(next_reason, 2000), coalesce(next_changes, '[]'::jsonb), expected_revision)
  returning id, navopath_cloud_change_sets.change_cursor into change_set_id, change_cursor;
  status := 'pending_confirmation';
  duplicate := false;
  return next;
end;
$$;

create or replace function public.undo_navopath_cloud_change_set(
  target_user_id uuid,
  target_change_set_id uuid,
  expected_revision bigint,
  next_data jsonb
)
returns table(change_set_id uuid, status text, revision bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_change public.navopath_cloud_change_sets%rowtype;
begin
  select * into target_change from public.navopath_cloud_change_sets
  where id = target_change_set_id and user_id = target_user_id
  for update;
  if not found then raise exception 'Change set not found'; end if;
  if target_change.status <> 'applied' then raise exception 'Change set is not undoable'; end if;
  if target_change.undo_expires_at is null or target_change.undo_expires_at < now() then raise exception 'Undo window expired'; end if;
  if target_change.applied_revision <> expected_revision then raise exception 'Later workspace changes prevent undo'; end if;

  update public.dayflow_profiles
  set data = next_data, revision = dayflow_profiles.revision + 1, updated_at = now()
  where user_id = target_user_id and dayflow_profiles.revision = expected_revision
  returning dayflow_profiles.revision into revision;
  if not found then raise exception 'PROFILE_REVISION_CONFLICT'; end if;

  update public.navopath_cloud_change_sets
  set status = 'undone', undone_at = now()
  where id = target_change_set_id;
  change_set_id := target_change_set_id;
  status := 'undone';
  return next;
end;
$$;

create or replace function public.confirm_navopath_cloud_change_set(
  target_user_id uuid,
  target_change_set_id uuid,
  expected_revision bigint,
  next_data jsonb,
  next_changes jsonb,
  next_inverse_operations jsonb,
  next_undo_expires_at timestamptz
)
returns table(change_set_id uuid, status text, revision bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_change public.navopath_cloud_change_sets%rowtype;
begin
  select * into target_change from public.navopath_cloud_change_sets
  where id = target_change_set_id and user_id = target_user_id
  for update;
  if not found or target_change.status <> 'pending_confirmation' then
    raise exception 'Pending change set not found';
  end if;
  if target_change.base_revision <> expected_revision then
    raise exception 'PROFILE_REVISION_CONFLICT';
  end if;

  update public.dayflow_profiles
  set data = next_data, revision = dayflow_profiles.revision + 1, updated_at = now()
  where user_id = target_user_id and dayflow_profiles.revision = expected_revision
  returning dayflow_profiles.revision into revision;
  if not found then raise exception 'PROFILE_REVISION_CONFLICT'; end if;

  update public.navopath_cloud_change_sets
  set status = 'applied', changes = coalesce(next_changes, '[]'::jsonb),
      inverse_operations = coalesce(next_inverse_operations, '[]'::jsonb),
      applied_revision = revision, undo_expires_at = next_undo_expires_at
  where id = target_change_set_id;
  change_set_id := target_change_set_id;
  status := 'applied';
  return next;
end;
$$;

revoke all on function public.claim_navopath_workspace_events(uuid, timestamptz, integer) from public, anon, authenticated;
revoke all on function public.claim_navopath_assistant_job(uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.apply_navopath_cloud_change_set(uuid, bigint, jsonb, text, text, text, text, jsonb, jsonb, timestamptz) from public, anon, authenticated;
revoke all on function public.record_navopath_pending_change_set(uuid, bigint, text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.undo_navopath_cloud_change_set(uuid, uuid, bigint, jsonb) from public, anon, authenticated;
revoke all on function public.confirm_navopath_cloud_change_set(uuid, uuid, bigint, jsonb, jsonb, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.claim_navopath_workspace_events(uuid, timestamptz, integer) to service_role;
grant execute on function public.claim_navopath_assistant_job(uuid, text, text, jsonb) to service_role;
grant execute on function public.apply_navopath_cloud_change_set(uuid, bigint, jsonb, text, text, text, text, jsonb, jsonb, timestamptz) to service_role;
grant execute on function public.record_navopath_pending_change_set(uuid, bigint, text, text, text, text, jsonb) to service_role;
grant execute on function public.undo_navopath_cloud_change_set(uuid, uuid, bigint, jsonb) to service_role;
grant execute on function public.confirm_navopath_cloud_change_set(uuid, uuid, bigint, jsonb, jsonb, jsonb, timestamptz) to service_role;

notify pgrst, 'reload schema';
