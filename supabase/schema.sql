-- RepCurve's backend: usernames and feedback, nothing else. Training stays on each person's device.
--
-- Run this whole file once in the Supabase SQL editor (it's safe to run again after changes).
-- The app talks to the database only through the functions at the end, with the project's public
-- key: both tables have row level security on and no policies, so that key can't read or change
-- them directly. You see everything in the Table Editor, which uses the service role.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- One row per person: a random id made on their device, the username they picked, and a hash of
-- a secret only their device (and their backups) knows, which is needed to rename or delete it.
create table if not exists public.accounts (
  user_id uuid primary key,
  username text not null,
  secret_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Usernames are unique whatever their capitals: "Luke" and "luke" can't both exist.
create unique index if not exists accounts_username_key on public.accounts (lower(username));

create table if not exists public.feedback (
  id bigint generated always as identity primary key,
  user_id uuid references public.accounts (user_id) on delete set null,
  username text,
  message text not null,
  -- App version, channel, style, screen size and browser, as the app reports them.
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists feedback_created_at on public.feedback (created_at desc);

alter table public.accounts enable row level security;
alter table public.feedback enable row level security;
revoke all on public.accounts, public.feedback from anon, authenticated;

-- Why a username can't be used, or null: 3 to 20 letters, numbers or underscores, and not one
-- that would look official.
create or replace function public.username_problem(p_name text) returns text
language sql immutable
set search_path = public
as $$
  select case
    when p_name is null or p_name !~ '^[A-Za-z0-9_]{3,20}$' then 'invalid'
    when lower(p_name) in ('admin', 'administrator', 'repcurve', 'repcurve_team', 'support', 'help',
      'moderator', 'mod', 'root', 'system', 'official', 'staff', 'team', 'coach') then 'reserved'
  end
$$;

-- 'available', 'taken', 'invalid' or 'reserved'. A name the asking person already has counts as available.
create or replace function public.username_status(p_name text, p_user uuid default null) returns text
language sql stable security definer
set search_path = public
as $$
  select coalesce(
    public.username_problem(p_name),
    case when exists (
      select 1 from public.accounts
      where lower(username) = lower(p_name) and user_id is distinct from p_user
    ) then 'taken' else 'available' end
  )
$$;

-- Claim a username, or change it: 'ok', 'taken', 'invalid', 'reserved', 'forbidden' (the id
-- belongs to someone else) or 'busy' (too many new accounts this hour, so a script can't flood it).
create or replace function public.claim_username(p_user uuid, p_secret text, p_name text) returns text
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  problem text := public.username_problem(p_name);
  hash text;
  stored text;
begin
  if problem is not null then return problem; end if;
  if p_user is null or p_secret is null or length(p_secret) not between 32 and 128 then return 'invalid'; end if;
  hash := encode(digest(p_secret, 'sha256'), 'hex');
  select secret_hash into stored from public.accounts where user_id = p_user;
  if found then
    if stored <> hash then return 'forbidden'; end if;
    update public.accounts set username = p_name, updated_at = now() where user_id = p_user;
    return 'ok';
  end if;
  if (select count(*) from public.accounts where created_at > now() - interval '1 hour') >= 300 then return 'busy'; end if;
  insert into public.accounts (user_id, username, secret_hash) values (p_user, p_name, hash);
  return 'ok';
exception when unique_violation then
  return 'taken';
end
$$;

-- Send feedback: 'ok', 'invalid' or 'busy'. With a matching id and secret it's filed under the
-- person's username; without, it's anonymous.
create or replace function public.send_feedback(p_user uuid, p_secret text, p_message text, p_meta jsonb default '{}'::jsonb) returns text
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  msg text := btrim(coalesce(p_message, ''));
  who uuid;
  name text;
begin
  if length(msg) not between 1 and 4000 then return 'invalid'; end if;
  if p_meta is null or jsonb_typeof(p_meta) <> 'object' or length(p_meta::text) > 4000 then return 'invalid'; end if;
  if p_user is not null and p_secret is not null then
    select user_id, username into who, name from public.accounts
    where user_id = p_user and secret_hash = encode(digest(p_secret, 'sha256'), 'hex');
  end if;
  -- At most 20 an hour from one person, and 500 an hour in all.
  if who is not null and (select count(*) from public.feedback where user_id = who and created_at > now() - interval '1 hour') >= 20 then return 'busy'; end if;
  if (select count(*) from public.feedback where created_at > now() - interval '1 hour') >= 500 then return 'busy'; end if;
  insert into public.feedback (user_id, username, message, meta) values (who, name, msg, p_meta);
  return 'ok';
end
$$;

-- Delete an account (Settings → Reset all data): the username is free again, and feedback the
-- person sent stays but no longer says who sent it. 'ok' (also when there was nothing to delete)
-- or 'forbidden'.
create or replace function public.delete_account(p_user uuid, p_secret text) returns text
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  stored text;
begin
  select secret_hash into stored from public.accounts where user_id = p_user;
  if not found then return 'ok'; end if;
  if p_secret is null or stored <> encode(digest(p_secret, 'sha256'), 'hex') then return 'forbidden'; end if;
  update public.feedback set username = null where user_id = p_user;
  delete from public.accounts where user_id = p_user;
  return 'ok';
end
$$;

-- Only these four are callable with the public key.
revoke execute on function public.username_problem(text) from public, anon, authenticated;
revoke execute on function public.username_status(text, uuid) from public;
revoke execute on function public.claim_username(uuid, text, text) from public;
revoke execute on function public.send_feedback(uuid, text, text, jsonb) from public;
revoke execute on function public.delete_account(uuid, text) from public;
grant execute on function public.username_status(text, uuid) to anon, authenticated;
grant execute on function public.claim_username(uuid, text, text) to anon, authenticated;
grant execute on function public.send_feedback(uuid, text, text, jsonb) to anon, authenticated;
grant execute on function public.delete_account(uuid, text) to anon, authenticated;
