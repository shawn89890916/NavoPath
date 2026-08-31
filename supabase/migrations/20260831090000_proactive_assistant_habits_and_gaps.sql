-- Proactive assistant v2: default-enabled account settings, learned behavior,
-- and deterministic gap-check jobs. Existing explicit opt-outs remain intact.
alter table public.navopath_cloud_assistant_settings
  add column if not exists intro_seen boolean not null default false;

alter table public.navopath_cloud_assistant_state
  add column if not exists behavior_profile jsonb not null default '{}'::jsonb,
  add column if not exists last_gap_check_at timestamptz;

alter table public.navopath_assistant_jobs
  drop constraint if exists navopath_assistant_jobs_trigger_check;
alter table public.navopath_assistant_jobs
  add constraint navopath_assistant_jobs_trigger_check
  check (trigger in ('morning', 'evening', 'workspace_event', 'gap_check'));

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
  if next_trigger not in ('morning', 'evening', 'workspace_event', 'gap_check') then
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

alter table public.navopath_notifications
  drop constraint if exists navopath_notifications_kind_check;
alter table public.navopath_notifications
  add constraint navopath_notifications_kind_check
  check (kind in ('summary', 'material_change', 'deadline_risk', 'weather', 'needs_input', 'gap_check'));

-- The planner profile is created by the authenticated client after signup. This
-- trigger ensures every new account receives the standard assistant policy.
create or replace function public.seed_navopath_cloud_assistant_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.navopath_cloud_assistant_settings (
    user_id, enabled, intro_seen, timezone, morning_time, evening_time,
    quiet_after, quiet_until, preferences
  ) values (
    new.user_id, true, false, 'Asia/Shanghai', '08:30', '20:30',
    '19:00', '08:30', jsonb_build_object('policyVersion', 'proactive-v2')
  ) on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists seed_navopath_cloud_assistant_settings_on_profile on public.dayflow_profiles;
create trigger seed_navopath_cloud_assistant_settings_on_profile
  after insert on public.dayflow_profiles
  for each row execute function public.seed_navopath_cloud_assistant_settings();

-- Backfill only missing rows. Rows already set to disabled are intentional and
-- must not be silently re-enabled.
insert into public.navopath_cloud_assistant_settings (
  user_id, enabled, intro_seen, timezone, morning_time, evening_time,
  quiet_after, quiet_until, preferences
)
select user_id, true, false, 'Asia/Shanghai', '08:30', '20:30',
  '19:00', '08:30', jsonb_build_object('policyVersion', 'proactive-v2')
from public.dayflow_profiles
on conflict (user_id) do nothing;
