# Uji database

Uji untuk skema, RLS, policy Storage, trigger, dan fungsi job yang dirancang di [`docs/architecture.md`](../../docs/architecture.md).

| Berkas | Isi |
|---|---|
| `sql/helpers.sql` | Fungsi bantu (`t.login`, `t.err`, `t.check`, ...). Login disimulasikan lewat klaim JWT + `SET ROLE` |
| `sql/rls_and_limits.test.sql` | 82 uji: RLS, Storage, trigger, RPC, batas (3 lagu, 20 playlist, 200 lagu/playlist, 500 MB global), tombstone, orphan, lease, `ping` |
| `concurrency.sh` | Balapan paralel untuk tiga batas; keluar kode 1 bila ada yang gagal |
| `mock/` | Tiruan skema `auth`/`storage` + runner untuk lingkungan **tanpa Docker** |

## Menjalankan di Supabase CLI lokal (wajib di Fase 1, spike S6)

```bash
supabase start          # DB di port 54322
supabase db reset       # menerapkan supabase/migrations/*
URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
psql "$URL" -f supabase/tests/sql/helpers.sql
psql "$URL" -f supabase/tests/sql/rls_and_limits.test.sql 2>&1 | grep -E "PASS|FAIL|ERROR"
PGURL="$URL" supabase/tests/concurrency.sh
```

Lulus bila tidak ada baris `FAIL` atau `ERROR` dan `concurrency.sh` mencetak `SEMUA LULUS`. Uji memakai UUID tetap, jadi jalankan pada database yang baru di-reset.

Uji ditulis dan diverifikasi pada Postgres 18 dengan **tiruan** skema Supabase; belum pernah dijalankan di Supabase sungguhan. Bila ada perbedaan (kolom wajib `auth.users`, trigger bawaan `storage.objects`, cara `auth.uid()` membaca klaim), perbaiki perbedaannya, bukan uji agar lulus.

## Tanpa Docker (hanya tiruan, bukan pengganti di atas)

```bash
# butuh initdb, pg_ctl, psql di PATH; MIGRATIONS_DIR berisi 0001..0005 (0005_cron dilewati otomatis)
MIGRATIONS_DIR=supabase/migrations bash supabase/tests/mock/run-mock.sh
```

## Uji validator MP3

```bash
node lib/audio/mp3.test.ts     # Node 22.18+/24 (type stripping bawaan)
```
