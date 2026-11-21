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

## Status deploy (2026-11-21)

Produksi: <https://streaming-neon-delta.vercel.app/> (Supabase region Tokyo, `ap-northeast-1`).

| Tahap | Hasil |
|---|---|
| 0–2 | selesai (Turnstile mode *Managed*) |
| 3 | selesai: 7 migrasi diterapkan, Edge Function `cleanup` ter-deploy, `200 {"songs":0}` dengan secret benar dan `403` tanpa/dengan token salah |
| 4 | selesai: build hijau 48 detik; bundel klien terverifikasi memuat URL Supabase utuh, Site key asli, kunci anon, dan **tanpa** `service_role` |
| 5 | selesai: `SELESAI baru: 4 artis, 4 album, 17 lagu | berkas diunggah: 25` |
| 6 | selesai: run manual `keepalive` mencetak `ping: {"ok": true, ...}` |
| 7 | uji asap desktop lolos (masuk anonim, putar lagu katalog, unggah, Kredit, konsol bersih) |

**Belum terbukti:** Safari iOS asli; eksekusi pertama `pg_cron` (menit :07) dan kecocokan secret Vault dengan secret fungsi; hasil pemeriksaan bucket dan `cron.job` (tahap 3) tidak dilaporkan tertulis. Rahasia yang pernah tampil di percakapan dan belum dirotasi: `service_role`, Secret key Turnstile, `CLEANUP_SECRET`.

### Temuan saat deploy (koreksi untuk panduan di bawah)

- **Supabase CLI**: `npx supabase` tanpa versi mengunduh 3.2.0, bukan 3.0.0 yang dikunci di CI. Pakai `npx supabase@3.0.0 ...`.
- **`db push` di CLI 3.x menargetkan database lokal secara bawaan** dan gagal bila Docker mati (`ECONNREFUSED 127.0.0.1:54322`). Untuk produksi tambahkan `--remote`: `npx supabase@3.0.0 db push --remote`, lalu pastikan baris `Target:` menyebut proyek, bukan `local stack`. `link` tidak meminta password database.
- **`functions deploy`** menampilkan "Docker is not running" tetapi tetap berhasil (jalur API).
- **Jangan mengetik `<` `>`** dari contoh. `CLEANUP_SECRET=<nilai>` dan `'<nilai>'` di Vault menyimpan kurung sudut ikut sebagai bagian nilai, sehingga fungsi dan Vault berbeda. Perbaiki dengan `select vault.update_secret((select id from vault.secrets where name = 'cleanup_secret'), '<nilai tanpa kurung>');` dan periksa `select length(decrypted_secret) from vault.decrypted_secrets where name = 'cleanup_secret';` (harus 64).
- **Cetakan terminal membocorkan rahasia**: `node -e "console.log(...)"` mencetak secret. Untuk berikutnya: `node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))" | Set-Clipboard`. Uji fungsi lewat variabel (`$s = "..."`, lalu `Bearer $s`), bukan menempel di baris perintah.
- **Cloudflare**: hostname Turnstile ada di **Edit Widget**, bukan menu "Hostname Management". Hostname diisi tanpa `https://`; Anda perlu menambahkan alamat Vercel final.
- **Vercel**: di tampilan terbaru tombol *Create Project* hanya membuat proyek (variabel lingkungan tersimpan), build baru berjalan saat *Deploy*. Lewati kartu *Optional Integrations → Supabase*, karena menambah/menimpa variabel otomatis. Titik sisa di ujung `NEXT_PUBLIC_SUPABASE_URL` (`...supabase.co.`) merusak semua panggilan; periksa sebelum deploy.
- **`keepalive` hijau bukan bukti**: tanpa secret, langkahnya lewat dan tetap hijau. Periksa log "Panggil ping()".

### Rotasi rahasia (opsional, belum dilakukan)

- `service_role` dan kunci anon: Supabase → Project Settings → JWT Keys/JWT Secret → rotasi (mengganti keduanya). Lalu perbarui `NEXT_PUBLIC_SUPABASE_ANON_KEY` dan `SUPABASE_SERVICE_ROLE_KEY` di Vercel, secret GitHub `SUPABASE_ANON_KEY`, dan `.env.production.local`; redeploy.
- Turnstile: Cloudflare → widget → *Rotate secret key*, lalu tempel di Supabase → Authentication → Attack Protection.
- `CLEANUP_SECRET`: buat nilai baru, `vault.update_secret(...)` dan `supabase secrets set` dengan nilai yang sama.

## 0. Prasyarat

- [ ] Akun: GitHub (sudah), Vercel, Supabase, Cloudflare.
- [x] **Katalog seed sudah terisi** di `scripts/seed/catalog.json`: 17 lagu, 4 artis, 4 album (HoliznaCC0, Komiku, Lobo Loco, Kevin MacLeod), lisensi hanya CC0 1.0 / CC BY 4.0 / CC BY-SA 4.0 yang dicek per halaman lagu (Kevin MacLeod dicek manual oleh pemilik pada 2026-11-19). Berkas audio **tidak** ada di repo: siapkan di mesinmu sebelum seed produksi (lihat tahap 5).
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
npx supabase@3.0.0 link --project-ref <ref>
```

**Perhatian migrasi `0005_cron.sql`:** berisi placeholder `<PROJECT_REF>` pada URL Edge Function. Jangan jalankan `db push` sebelum placeholder itu diganti dengan project ref asli di salinan lokal berkas itu (jangan di-commit; kembalikan dengan `git checkout -- supabase/migrations/0005_cron.sql` setelah push). Menyunting migrasi yang sudah diterapkan tidak berefek, jadi bila terlanjur, tulis migrasi baru yang menjadwalkan ulang job. Bila tidak, cron memanggil alamat yang tidak ada dan job pembersih diam-diam tidak berjalan.

Urutan:

```bash
# 1) Vault: rahasia yang dipakai cron untuk memanggil Edge Function (SQL editor Supabase)
#    select vault.create_secret('<CLEANUP_SECRET>', 'cleanup_secret');
# 2) Rahasia fungsi (nilai SAMA dengan di Vault)
npx supabase@3.0.0 secrets set CLEANUP_SECRET="<CLEANUP_SECRET>"   # tanpa kurung sudut; lihat temuan di atas
# 3) Deploy Edge Function (memakai rahasianya sendiri, bukan JWT)
npx supabase@3.0.0 functions deploy cleanup --no-verify-jwt
# 4) Migrasi (setelah <PROJECT_REF> pada 0005 diganti)
npx supabase@3.0.0 db push --remote
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

Persiapan di mesinmu (audio asli ada di folder di luar repo, mis. `E:\musik-seed`; tidak pernah di-commit):

```bash
node scripts/seed/prepare-audio.mjs --src "E:\musik-seed"   # salin/konversi ke MP3 192 kbps di scripts/seed/audio/, periksa validator MP3
node scripts/seed/make-covers.mjs                            # sampul buatan sendiri di scripts/seed/covers/
npm run seed:check                                           # harus: OK 17 lagu, 4 album, 4 artis
```

Jangan menjalankan `scripts/seed/make-preview-audio.ts --force` di mesin ini: itu menimpa audio asli dengan audio sunyi (hanya untuk CI pratinjau).

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
- [ ] Halaman **Kredit** (sidebar dan tab "Kredit" di ponsel) memuat 17 lagu dengan tautan lisensi yang membuka halaman lagu di sumbernya; halaman album menampilkan bagian Kredit.
- [ ] Konsol browser tanpa galat pada alur di atas.

## Gerbang konfirmasi

Saya menunggu pesan eksplisit darimu per tahap sebelum menjalankan perintah apa pun yang menyentuh produksi (`supabase link/db push/functions deploy/secrets`, seed `--yes`, atau perubahan di Vercel). Contoh: *"Tahap 3: lanjut, project ref = abcd…"*. Kunci dan rahasia **tidak perlu** dikirim ke saya: kamu menempelnya sendiri di dashboard atau terminalmu.

## Pemulihan dan rollback

- **Vercel:** *Deployments → Promote/Redeploy* versi sebelumnya (instan).
- **Migrasi:** tulis migrasi baru yang membalikkan (jangan menyunting migrasi yang sudah diterapkan). Cadangan: dashboard Supabase → Database → Backups (Free: tanpa PITR).
- **Cron macet:** `select cron.unschedule('cleanup-songs-hourly');` lalu jadwalkan ulang setelah memperbaiki penyebabnya.
- **Proyek Supabase di-pause:** pulihkan dari dashboard (hingga 1 tahun); keep-alive mencegahnya.
- **Batas global:** ubah tanpa deploy: `update public.app_limits set private_storage_cap_bytes = <byte>;`.
