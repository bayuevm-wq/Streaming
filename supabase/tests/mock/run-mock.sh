#!/usr/bin/env bash
# run-mock.sh: jalankan uji SQL di Postgres SEMENTARA dengan tiruan minimal skema auth/storage Supabase.
# HANYA untuk lingkungan tanpa Docker. BUKAN pengganti uji di Supabase CLI lokal (`supabase start`), yang
# wajib dijalankan di Fase 1 (lihat docs/architecture.md, spike S6).
# Prasyarat: initdb, pg_ctl, psql ada di PATH. Variabel opsional:
#   MIGRATIONS_DIR (default supabase/migrations), PORT (default 54329)
set -u
here="$(cd "$(dirname "$0")" && pwd)"
tests="$here/.."
MIGRATIONS_DIR="${MIGRATIONS_DIR:-$here/../../migrations}"
PORT="${PORT:-54329}"
work="$(mktemp -d)"
trap 'pg_ctl -D "$work/data" stop -m fast >/dev/null 2>&1; rm -rf "$work"' EXIT

initdb -D "$work/data" -U postgres --auth=trust -E UTF8 --locale=C >/dev/null || exit 2
pg_ctl -D "$work/data" -o "-p $PORT -c listen_addresses=127.0.0.1" -l "$work/pg.log" -w start >/dev/null || exit 2
url="postgresql://postgres@127.0.0.1:$PORT/postgres"
P() { psql "$url" -q -v ON_ERROR_STOP=1 "$@"; }

P -f "$here/stub.sql" || exit 2
for f in $(ls "$MIGRATIONS_DIR"/*.sql | grep -vi cron | sort); do P -f "$f" || { echo "migrasi gagal: $f"; exit 2; }; done
P -f "$tests/sql/helpers.sql" || exit 2
psql "$url" -q -f "$tests/sql/rls_and_limits.test.sql" > "$work/test.out" 2>&1
echo "SQL: PASS=$(grep -c PASS "$work/test.out") FAIL=$(grep -c 'FAIL' "$work/test.out") ERROR=$(grep -c 'ERROR' "$work/test.out")"
grep -E 'FAIL|ERROR' "$work/test.out"
bad=$(( $(grep -c 'FAIL' "$work/test.out") + $(grep -c 'ERROR' "$work/test.out") ))
PGURL="$url" "$tests/concurrency.sh" || bad=1
exit "$bad"
