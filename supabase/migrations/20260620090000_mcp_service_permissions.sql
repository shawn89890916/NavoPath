grant select on table public.dayflow_profiles to service_role;
grant select, update on table public.navopath_mcp_tokens to service_role;

revoke execute on function public.create_mcp_token(text, text, text) from public, anon;
revoke execute on function public.list_mcp_tokens() from public, anon;
revoke execute on function public.revoke_mcp_token(uuid) from public, anon;

grant execute on function public.create_mcp_token(text, text, text) to authenticated;
grant execute on function public.list_mcp_tokens() to authenticated;
grant execute on function public.revoke_mcp_token(uuid) to authenticated;
