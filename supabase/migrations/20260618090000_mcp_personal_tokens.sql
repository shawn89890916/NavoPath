create extension if not exists pgcrypto;

create table if not exists public.navopath_mcp_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  token_prefix text not null check (char_length(token_prefix) between 6 and 20),
  token_hash text not null unique check (char_length(token_hash) = 64),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

alter table public.navopath_mcp_tokens enable row level security;
revoke all on public.navopath_mcp_tokens from anon, authenticated;

create or replace function public.create_mcp_token(token_name text, token_digest text, token_label_prefix text)
returns table(id uuid, name text, token_prefix text, created_at timestamptz, last_used_at timestamptz)
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  return query insert into public.navopath_mcp_tokens(user_id, name, token_hash, token_prefix)
    values (auth.uid(), trim(token_name), lower(token_digest), token_label_prefix)
    returning navopath_mcp_tokens.id, navopath_mcp_tokens.name, navopath_mcp_tokens.token_prefix,
      navopath_mcp_tokens.created_at, navopath_mcp_tokens.last_used_at;
end; $$;

create or replace function public.list_mcp_tokens()
returns table(id uuid, name text, token_prefix text, created_at timestamptz, last_used_at timestamptz)
language sql security definer set search_path = public, auth as $$
  select t.id, t.name, t.token_prefix, t.created_at, t.last_used_at from public.navopath_mcp_tokens t
  where t.user_id = auth.uid() and t.revoked_at is null order by t.created_at desc;
$$;

create or replace function public.revoke_mcp_token(token_id uuid)
returns void language sql security definer set search_path = public, auth as $$
  update public.navopath_mcp_tokens set revoked_at = now() where id = token_id and user_id = auth.uid();
$$;

grant execute on function public.create_mcp_token(text, text, text) to authenticated;
grant execute on function public.list_mcp_tokens() to authenticated;
grant execute on function public.revoke_mcp_token(uuid) to authenticated;
