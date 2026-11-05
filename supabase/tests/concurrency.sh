#!/usr/bin/env bash
# concurrency.sh: uji balapan terhadap batas-batas yang ditegakkan trigger.
#   1) kuota 3 lagu aktif per user          -> dari 10 permintaan paralel, tepat 3 berhasil
#   2) batas 20 playlist per user           -> dari 30 insert paralel, tepat 20 baris
#   3) batas penyimpanan pribadi global     -> dua user paralel berebut 1 slot, tepat 1 berhasil
# Pakai: PGURL=postgresql://postgres:postgres@127.0.0.1:54322/postgres supabase/tests/concurrency.sh
# (54322 = port DB bawaan `supabase start`). Prasyarat: migrasi 0001-0004 terpasang. Keluar dengan kode 1 bila ada yang gagal.
set -u
PGURL="${PGURL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
Q() { psql "$PGURL" -qAt "$@"; }
fail=0
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT

new_user() { Q -c "insert into auth.users (id, is_anonymous) values (gen_random_uuid(), true) returning id" | head -1; }

# jalankan SQL sebagai user $1, $2 kali paralel; keluaran tiap proses di $tmp/out_N
par() {
  local uid="$1" n="$2" sql="$3"
  rm -f "$tmp"/out_*
  for i in $(seq 1 "$n"); do
    ( Q -c "select set_config('request.jwt.claim.sub','$uid',false), set_config('request.jwt.claims', json_build_object('sub','$uid','role','authenticated')::text, false); set role authenticated; ${sql//@I@/$i}" > "$tmp/out_$i" 2>&1 ) &
  done
  wait
}
expect() { # nama, nilai_sebenarnya, nilai_diharapkan
  if [ "$2" = "$3" ]; then echo "PASS $1 ($2)"; else echo "FAIL $1: dapat $2, diharapkan $3"; fail=1; fi
}

echo "== 1. kuota 3 lagu, 10 paralel x 3 ronde =="
for r in 1 2 3; do
  u="$(new_user)"
  par "$u" 10 "select public.reserve_upload('t@I@', 'x')"
  expect "ronde $r: berhasil" "$(grep -l song_id "$tmp"/out_* | wc -l | tr -d ' ')" 3
  expect "ronde $r: baris di DB" "$(Q -c "select count(*) from public.songs where owner_id = '$u'")" 3
done

echo "== 2. batas 20 playlist, 30 paralel =="
u="$(new_user)"
par "$u" 30 "insert into public.playlists (user_id, name) values ('$u', 'p@I@')"
expect "jumlah playlist" "$(Q -c "select count(*) from public.playlists where user_id = '$u'")" 20

echo "== 3. batas penyimpanan global, 2 user paralel berebut 1 slot =="
orig="$(Q -c "select private_storage_cap_bytes from public.app_limits")"
Q -c "update public.app_limits set private_storage_cap_bytes = (select coalesce(sum(coalesce(size_bytes, 10485760)), 0) + 10485760 from public.songs where visibility = 'private')" >/dev/null
ua="$(new_user)"; ub="$(new_user)"
for who in "$ua" "$ub"; do
  ( Q -c "select set_config('request.jwt.claim.sub','$who',false), set_config('request.jwt.claims', json_build_object('sub','$who','role','authenticated')::text, false); set role authenticated; select public.reserve_upload('g','x')" > "$tmp/g_$who" 2>&1 ) &
done
wait
expect "reservasi berhasil" "$(grep -l song_id "$tmp"/g_* | wc -l | tr -d ' ')" 1
expect "ditolak storage_full" "$(grep -l storage_full "$tmp"/g_* | wc -l | tr -d ' ')" 1
Q -c "update public.app_limits set private_storage_cap_bytes = $orig" >/dev/null

[ "$fail" = 0 ] && echo "SEMUA LULUS" || echo "ADA YANG GAGAL"
exit "$fail"
