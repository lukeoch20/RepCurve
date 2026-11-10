-- Checks for schema.sql, run as the public role the app uses (see test.sh). Any failure raises.
\set ON_ERROR_STOP on

set role anon;

-- The tables can't be read or written with the public key.
do $$ begin
  begin
    perform 1 from public.accounts;
    raise exception 'anon could read accounts';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.feedback (message) values ('x');
    raise exception 'anon could write feedback';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.username_problem('abc');
    raise exception 'anon could call username_problem';
  exception when insufficient_privilege then null;
  end;
end $$;

do $$
declare
  a uuid := '11111111-1111-4111-8111-111111111111';
  b uuid := '22222222-2222-4222-8222-222222222222';
  sa text := repeat('a', 64);
  sb text := repeat('b', 64);
  r text;
begin
  -- Names: format and reserved words.
  assert public.username_status('lu') = 'invalid', 'too short';
  assert public.username_status('has space') = 'invalid', 'space';
  assert public.username_status(repeat('x', 21)) = 'invalid', 'too long';
  assert public.username_status('Admin') = 'reserved', 'reserved';
  assert public.username_status('Luke_O') = 'available', 'available';

  -- Claiming, and uniqueness whatever the capitals.
  assert public.claim_username(a, sa, 'Luke_O') = 'ok', 'claim';
  assert public.username_status('luke_o') = 'taken', 'taken lower';
  assert public.username_status('LUKE_O', a) = 'available', 'own name';
  assert public.claim_username(b, sb, 'luke_o') = 'taken', 'duplicate';
  assert public.claim_username(b, 'short', 'someone') = 'invalid', 'weak secret';
  assert public.claim_username(b, sb, 'Sam') = 'ok', 'second person';

  -- Renaming needs the secret; the old name is free afterwards.
  assert public.claim_username(a, sb, 'Thief') = 'forbidden', 'wrong secret';
  assert public.claim_username(a, sa, 'Sam') = 'taken', 'rename to taken';
  assert public.claim_username(a, sa, 'LukeLifts') = 'ok', 'rename';
  assert public.username_status('Luke_O') = 'available', 'old name freed';
  assert public.claim_username(a, sa, 'lukelifts') = 'ok', 'recase own name';

  -- Feedback: filed under the username with the right secret, anonymous without.
  assert public.send_feedback(a, sa, '  Love the setups  ', '{"version":"1.0"}') = 'ok', 'feedback';
  assert public.send_feedback(a, sb, 'not mine', '{}') = 'ok', 'feedback wrong secret';
  assert public.send_feedback(null, null, 'anon', '{}') = 'ok', 'anonymous feedback';
  assert public.send_feedback(a, sa, '   ', '{}') = 'invalid', 'empty';
  assert public.send_feedback(a, sa, repeat('x', 4001), '{}') = 'invalid', 'too long';
  assert public.send_feedback(a, sa, 'x', '[1]') = 'invalid', 'meta not an object';
  for i in 1..19 loop r := public.send_feedback(a, sa, 'again', '{}'); end loop;
  assert r = 'ok', 'up to 20 an hour';
  assert public.send_feedback(a, sa, 'one too many', '{}') = 'busy', 'rate limit';

  -- Deleting needs the secret and frees the name.
  assert public.delete_account(a, sb) = 'forbidden', 'delete wrong secret';
  assert public.delete_account(a, sa) = 'ok', 'delete';
  assert public.delete_account(a, sa) = 'ok', 'delete twice';
  assert public.username_status('lukelifts') = 'available', 'freed after delete';
end $$;

reset role;

-- What the owner sees: feedback kept, the deleted person's name gone from it.
do $$ begin
  assert (select count(*) from public.feedback where message = 'Love the setups' and username is null and user_id is null) = 1, 'trimmed, unlinked after delete';
  assert (select count(*) from public.feedback where message = 'not mine' and username is null) = 1, 'wrong secret files anonymously';
  assert (select count(*) from public.accounts) = 1, 'one account left';
end $$;

select 'all checks passed' as result;
