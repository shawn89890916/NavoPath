alter table public.navopath_agent_runs
  add column if not exists tool_log jsonb not null default '[]'::jsonb;

drop function if exists public.apply_navopath_agent_run(bigint, jsonb, jsonb, uuid, text, jsonb, jsonb, timestamptz);

create or replace function public.apply_navopath_agent_run(
  expected_revision bigint,
  next_data jsonb,
  next_settings jsonb,
  target_run_id uuid,
  next_status text,
  next_integration_commands jsonb,
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
  integration_command jsonb;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if next_status not in ('applied', 'pending_confirmation', 'undone') then
    raise exception 'Invalid Agent status';
  end if;
  if pg_column_size(next_data) > 6000000 or pg_column_size(next_settings) > 500000 then
    raise exception 'Profile payload is too large';
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

  for integration_command in
    select value from jsonb_array_elements(coalesce(next_integration_commands, '[]'::jsonb))
  loop
    if integration_command->>'entity' <> 'integration'
      or integration_command->>'operation' <> 'update'
      or jsonb_typeof(integration_command->'values'->'enabled') <> 'boolean' then
      raise exception 'Invalid integration command';
    end if;

    update public.navopath_calendar_sources
    set enabled = (integration_command->'values'->>'enabled')::boolean,
        updated_at = now()
    where id = (integration_command->>'targetId')::uuid
      and user_id = current_user_id;

    if not found then
      raise exception 'Integration not found';
    end if;
  end loop;

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

revoke all on function public.apply_navopath_agent_run(bigint, jsonb, jsonb, uuid, text, jsonb, jsonb, jsonb, timestamptz) from public, anon;
grant execute on function public.apply_navopath_agent_run(bigint, jsonb, jsonb, uuid, text, jsonb, jsonb, jsonb, timestamptz) to authenticated;

notify pgrst, 'reload schema';
