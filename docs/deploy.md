# Checklist deploy produksi

Dokumen ini memisahkan apa yang **harus kamu lakukan sendiri** (akun, kunci, rahasia) dari apa yang **saya siapkan di repo**. Saya tidak menjalankan apa pun terhadap produksi sebelum kamu menulis konfirmasi eksplisit per tahap (lihat bagian *Gerbang konfirmasi*).

Stack produksi: **Vercel** (Next.js) + **Supabase** (Postgres, Auth, Storage, Edge Function) + **Cloudflare Turnstile** (CAPTCHA) + **GitHub Actions** (keep-alive). Semua tersedia di paket gratis. Rujukan teknis: [`architecture.md` §13](architecture.md).

## Ringkasan urutan

| # | Tahap | Siapa | Bisa dibatalkan? |
|---|---|---|---|
| 0 | Prasyarat dan isi `catalog.json` (lagu asli) | **Kamu** | ya |
| 1 | Proyek Supabase produksi + pengaturan Auth | **Kamu** | ya (hapus proyek) |
| 2 | Kunci Turnstile asli | **Kamu** | ya |
| 3 | Migrasi database, bucket, Edge Function, cron | **Kamu menjalankan, saya siapkan perintah** | sebagian |
| 4 | Proyek Vercel dan variabel lingkungan | **Kamu** | ya |
| 5 | Seed katalog produksi | **Kamu menjalankan, saya siapkan** | ya (skrip idempoten) |
| 6 | Secret GitHub untuk keep-alive | **Kamu** | ya |
| 7 | Uji asap manual dan Safari iOS | **Kamu** | — |

## 0. Prasyarat

- [ ] Akun: GitHub (sudah), Vercel, Supabase, Cloudflare.
- [ ] **Isi `scripts/seed/catalog.json` dengan lagu asli** (minimal 15 lagu, 4 album, 4 artis) dari Free Music Archive atau Incompetech/Kevin MacLeod dengan lisensi **hanya CC0 1.0, CC BY 4.0, atau CC BY-SA 4.0** (dicek di halaman lagu; NC, ND, dan FMA-Limited dilarang; Pixabay tidak dipakai karena melarang distribusi "standalone"). Setiap lagu wajib punya `license`, `source_url`, dan `credit`; kreditnya tampil di aplikasi (album/lagu dan `/kredit`). Letakkan berkas di `scripts/seed/audio/` dan `scripts/seed/covers/` (tidak masuk git). Panduan: [`scripts/seed/README.md`](../scripts/seed/README.md). Validasi lokal tanpa jaringan: `npm run seed:check`.
- [ ] Setelah valid: `node scripts/seed.ts --dry-run --readme` memperbarui tabel sumber/lisensi di README, lalu commit.
- [ ] Putuskan nama domain (cukup `*.vercel.app` untuk demo).

## 1. Proyek Supabase produksi (kamu)

1. Buat proyek di <https://supabase.com/dashboard> (region terdekat dengan pengguna). **Catat** *Project URL*, *anon key*, *service_role key*, dan *project ref* (potongan di URL, `https://<ref>.supabase.co`).
2. **Authentication → Sign In / Providers**: aktifkan **Allow anonymous sign-ins**.
3. **Authentication → Rate Limits**: pastikan *anonymous users* per jam per IP wajar (bawaan 30). Jangan dinaikkan.
4. **Authentication → URL Configuration**: *Site URL* = alamat Vercel final; tambahkan alamat yang sama ke *Redirect URLs*.
5. **Database → Extensions**: aktifkan `pg_trgm`, `pg_cron`, `pg_net` (migrasi memintanya, tetapi lebih aman memeriksa).
6. **Project Settings → API**: simpan kunci di pengelola kata sandi. **`service_role` jangan pernah** diberi awalan `NEXT_PUBLIC_` dan jangan ditempel di chat atau commit.

## 2. Turnstile asli (kamu)

1. Cloudflare → **Turnstile → Add widget**. Tipe **Invisible** (atau Managed bila lebih nyaman), tambahkan domain produksi (dan `localhost` bila perlu).
2. Simpan **Site key** (publik) dan **Secret key** (rahasia).
3. Supabase → **Authentication → Attack Protection → Enable CAPTCHA protection** → pilih **Turnstile** → tempel **Secret key**.
4. Site key dipakai di Vercel (tahap 4). **Kunci uji** (`1x000…`) hanya untuk lokal/CI; jangan dipakai di produksi karena meloloskan semua bot.

## 3. Database, bucket, fungsi, cron (kamu menjalankan)

Prasyarat lokal: Supabase CLI **3.0.0** (versi yang dikunci di CI), `supabase login`.

```bash
supabase link --project-ref <ref>
```

**Perhatian migrasi `0005_cron.sql`:** berisi placeholder `<PROJECT_REF>` pada URL Edge Function. Jangan jalankan `supabase db push` sebelum placeholder itu diganti dengan project ref asli (di salinan lokal berkas itu atau lewat migrasi baru `0007`). Bila tidak, cron memanggil alamat yang tidak ada dan job pembersih diam-diam tidak berjalan.

Urutan:

```bash
# 1) Vault: rahasia yang dipakai cron untuk memanggil Edge Function (SQL editor Supabase)
#    select vault.create_secret('<CLEANUP_SECRET>', 'cleanup_secret');
# 2) Rahasia fungsi (nilai SAMA dengan di Vault)
supabase secrets set CLEANUP_SECRET=<CLEANUP_SECRET>
# 3) Deploy Edge Function (memakai rahasianya sendiri, bukan JWT)
supabase functions deploy cleanup --no-verify-jwt
# 4) Migrasi (setelah <PROJECT_REF> pada 0005 diganti)
supabase db push
```

`<CLEANUP_SECRET>` = string acak panjang (mis. `openssl rand -hex 32`). Simpan di pengelola kata sandi.

Verifikasi (saya bisa bantu membaca hasilnya bila kamu tempel keluarannya, **tanpa kunci**):

- [ ] Dashboard → Storage: ada bucket `audio`, `covers` (publik) dan `user-audio`, `user-covers` (privat).
- [ ] SQL editor: `select jobname, schedule from cron.job;` menampilkan tiga job `cleanup-*`.
- [ ] Panggil fungsi sekali dari terminal: `curl -i -X POST "https://<ref>.supabase.co/functions/v1/cleanup?task=songs" -H "Authorization: Bearer <CLEANUP_SECRET>"` → `200` dengan `{"songs":0}`. Tanpa header → `403`.
- [ ] `select name, last_run_at, last_result from job_leases;` terisi setelah job pertama berjalan (jam :07).

## 4. Vercel (kamu)

1. **Add New → Project** → impor repo `bayuevm-wq/Streaming`. Framework: Next.js (terdeteksi). Build command bawaan.
2. **Settings → Environment Variables** (Production, dan Preview bila dipakai):

| Variabel | Nilai | Rahasia? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL | tidak |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key | tidak |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Site key **asli** | tidak |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key | **ya** (tandai *Sensitive*) |

3. Deploy. Salin alamat produksi ke Supabase *Site URL* (tahap 1.4) bila belum.
4. Jangan menambahkan `CLEANUP_SECRET` ke Vercel: hanya Edge Function dan Vault yang memakainya.

## 5. Seed katalog (kamu menjalankan)

```bash
# .env.local sementara menunjuk produksi (JANGAN commit), atau beri variabel lewat shell:
node --env-file=.env.production.local scripts/seed.ts --yes
```

Skrip idempoten (`seed_key`), menolak target non-lokal tanpa `--yes`, dan memvalidasi isi berkas sebelum mengunggah. Setelah selesai: beranda produksi menampilkan lagu, album, artis.

## 6. Keep-alive (kamu)

GitHub → repo → **Settings → Secrets and variables → Actions**: tambahkan `SUPABASE_URL` dan `SUPABASE_ANON_KEY` (anon key, **bukan** service role). Jalankan manual workflow `keepalive` sekali (`workflow_dispatch`) dan pastikan hijau tanpa pesan "dilewati".

## 7. Uji asap produksi (manual)

E2E otomatis **tidak** dijalankan ke produksi: Turnstile asli menolak otomasi. Lakukan manual:

- [ ] "Coba tanpa daftar" berhasil dan masuk ke beranda.
- [ ] Putar lagu; pindah halaman: musik tidak putus. Sukai lagu; buat playlist; cari.
- [ ] Unggah MP3 kecil: muncul di Library dengan sisa waktu; putar; hapus.
- [ ] Unggah `.exe` yang diganti nama `.mp3`: ditolak dengan pesan jelas.
- [ ] **Safari iOS asli (iPhone)**: putar lagu katalog, lalu lagu pribadi **pertama kali** dari Library, lalu dari playlist (tanpa pra-ambil). Aturan autoplay iOS lebih ketat daripada WebKit desktop yang diuji di CI ([`architecture.md` §14.1, S4](architecture.md)). Catat hasilnya.
- [ ] Konsol browser tanpa galat pada alur di atas.

## Gerbang konfirmasi

Saya menunggu pesan eksplisit darimu per tahap sebelum menjalankan perintah apa pun yang menyentuh produksi (`supabase link/db push/functions deploy/secrets`, seed `--yes`, atau perubahan di Vercel). Contoh: *"Tahap 3: lanjut, project ref = abcd…"*. Kunci dan rahasia **tidak perlu** dikirim ke saya: kamu menempelnya sendiri di dashboard atau terminalmu.

## Pemulihan dan rollback

- **Vercel:** *Deployments → Promote/Redeploy* versi sebelumnya (instan).
- **Migrasi:** tulis migrasi baru yang membalikkan (jangan menyunting migrasi yang sudah diterapkan). Cadangan: dashboard Supabase → Database → Backups (Free: tanpa PITR).
- **Cron macet:** `select cron.unschedule('cleanup-songs-hourly');` lalu jadwalkan ulang setelah memperbaiki penyebabnya.
- **Proyek Supabase di-pause:** pulihkan dari dashboard (hingga 1 tahun); keep-alive mencegahnya.
- **Batas global:** ubah tanpa deploy: `update public.app_limits set private_storage_cap_bytes = <byte>;`.
