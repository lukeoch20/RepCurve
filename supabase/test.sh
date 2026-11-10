#!/usr/bin/env bash
# Runs test.sql against schema.sql in a throwaway local PostgreSQL (16 or newer), with the roles
# Supabase gives the public key. Usage: supabase/test.sh  (needs initdb/pg_ctl on PATH or in
# /usr/lib/postgresql/*/bin; as root it runs them as the postgres user).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
bin="$(dirname "$(command -v pg_ctl || ls -d /usr/lib/postgresql/*/bin/pg_ctl | tail -1)")"
dir="$(mktemp -d)"
as() { if [ "$(id -u)" = 0 ]; then su postgres -s /bin/bash -c "$*"; else bash -c "$*"; fi; }
[ "$(id -u)" = 0 ] && chown postgres "$dir" && chmod 755 "$here"
cleanup() { as "'$bin/pg_ctl' -D '$dir/data' -m immediate stop" >/dev/null 2>&1 || true; rm -rf "$dir"; }
trap cleanup EXIT
as "'$bin/initdb' -D '$dir/data' -A trust -U postgres" >/dev/null
as "'$bin/pg_ctl' -D '$dir/data' -o \"-k '$dir' -c listen_addresses=''\" -w start" >/dev/null
psql=(psql -h "$dir" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
# As on Supabase: new tables and functions in public are open to the public roles unless revoked.
"${psql[@]}" -c "create role anon nologin; create role authenticated nologin; grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;"
"${psql[@]}" -f "$here/schema.sql"
# Running it again must work too.
"${psql[@]}" -f "$here/schema.sql"
"${psql[@]}" -f "$here/test.sql"
