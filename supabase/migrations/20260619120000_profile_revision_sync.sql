alter table public.dayflow_profiles
  add column if not exists revision bigint not null default 0;

create or replace function public.save_dayflow_profile(
  expected_revision bigint,
  next_data jsonb,
  next_settings jsonb
)
returns table(data jsonb, settings jsonb, revision bigint)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  return query
    update public.dayflow_profiles p
      set data = next_data,
          settings = next_settings,
          revision = p.revision + 1,
          updated_at = now()
      where p.user_id = auth.uid()
        and p.revision = expected_revision
      returning p.data, p.settings, p.revision;

  if not found then
    raise exception 'PROFILE_REVISION_CONFLICT' using errcode = '40001';
  end if;
end;
$$;

revoke all on function public.save_dayflow_profile(bigint, jsonb, jsonb) from public;
grant execute on function public.save_dayflow_profile(bigint, jsonb, jsonb) to authenticated;

create or replace function public.save_dayflow_profile_as_service(
  target_user_id uuid,
  expected_revision bigint,
  next_data jsonb,
  next_settings jsonb
)
returns table(data jsonb, settings jsonb, revision bigint)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required';
  end if;
  return query
    update public.dayflow_profiles p
      set data = next_data, settings = next_settings, revision = p.revision + 1, updated_at = now()
      where p.user_id = target_user_id and p.revision = expected_revision
      returning p.data, p.settings, p.revision;
  if not found then
    raise exception 'PROFILE_REVISION_CONFLICT' using errcode = '40001';
  end if;
end;
$$;

revoke all on function public.save_dayflow_profile_as_service(uuid, bigint, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.save_dayflow_profile_as_service(uuid, bigint, jsonb, jsonb) to service_role;
