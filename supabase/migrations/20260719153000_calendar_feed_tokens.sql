create extension if not exists pgcrypto;

create table if not exists public.navopath_calendar_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_prefix text not null check (char_length(token_prefix) between 6 and 20),
  token_hash text not null unique check (char_length(token_hash) = 64),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create unique index if not exists navopath_calendar_tokens_one_active_per_user
  on public.navopath_calendar_tokens(user_id) where revoked_at is null;

alter table public.navopath_calendar_tokens enable row level security;
revoke all on public.navopath_calendar_tokens from anon, authenticated;

create or replace function public.create_calendar_feed_token(token_digest text, token_label_prefix text)
returns table(id uuid, token_prefix text, created_at timestamptz, last_used_at timestamptz)
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if token_digest !~ '^[0-9a-f]{64}$' then raise exception 'Invalid token digest'; end if;
  update public.navopath_calendar_tokens set revoked_at = now()
    where user_id = auth.uid() and revoked_at is null;
  return query insert into public.navopath_calendar_tokens(user_id, token_hash, token_prefix)
    values (auth.uid(), token_digest, token_label_prefix)
    returning navopath_calendar_tokens.id, navopath_calendar_tokens.token_prefix,
      navopath_calendar_tokens.created_at, navopath_calendar_tokens.last_used_at;
end; $$;

create or replace function public.list_calendar_feed_tokens()
returns table(id uuid, token_prefix text, created_at timestamptz, last_used_at timestamptz)
language sql security definer set search_path = public, auth as $$
  select t.id, t.token_prefix, t.created_at, t.last_used_at
  from public.navopath_calendar_tokens t
  where t.user_id = auth.uid() and t.revoked_at is null
  order by t.created_at desc;
$$;

create or replace function public.revoke_calendar_feed_token(token_id uuid)
returns void language sql security definer set search_path = public, auth as $$
  update public.navopath_calendar_tokens set revoked_at = now()
  where id = token_id and user_id = auth.uid();
$$;

revoke all on function public.create_calendar_feed_token(text, text) from public;
revoke all on function public.list_calendar_feed_tokens() from public;
revoke all on function public.revoke_calendar_feed_token(uuid) from public;
grant execute on function public.create_calendar_feed_token(text, text) to authenticated;
grant execute on function public.list_calendar_feed_tokens() to authenticated;
grant execute on function public.revoke_calendar_feed_token(uuid) to authenticated;
