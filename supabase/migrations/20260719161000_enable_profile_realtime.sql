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
