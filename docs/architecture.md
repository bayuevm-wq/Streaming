# Streaming — Arsitektur MVP

**Status:** Draft v1 · **Tanggal:** 2026-11-05 · **Sumber:** [`docs/spec.md`](./spec.md) · **Stack:** Next.js (App Router) + Tailwind + Supabase (Postgres, Auth, Storage, Edge Functions) + Zustand

> **Yang sudah dan belum diverifikasi.** SQL migrasi 0001–0004 dan modul `mp3.ts` sudah dijalankan: **82 uji SQL lulus** di PostgreSQL 18 lokal dengan **tiruan** minimal skema `auth`/`storage` Supabase, uji konkurensi untuk tiga batas (kuota lagu, 20 playlist, penyimpanan global) lulus dan terbukti sensitif lewat kontrol tanpa kunci (§7), dan unit test `mp3.ts` lulus. Semua uji kini ada di repo: `supabase/tests/` dan `lib/audio/`. **Belum diuji:** Supabase sungguhan (Auth anonim, Storage/TUS, pembacaan Range), `pg_cron`/`pg_net`/Vault (0005), Edge Function `cleanup`, workflow keep-alive, kode Next.js, dan render diagram Mermaid. **Di Fase 1 seluruh uji SQL wajib dijalankan ulang di Supabase CLI lokal (`supabase start`), bukan Postgres tiruan** (spike S6, §14.1).

---

## 1. Ringkasan dan jawaban atas empat pertanyaan kunci

Arsitektur ini menaruh **semua aturan penting di database dan Storage (RLS, trigger, policy)** supaya tetap berlaku walau klien dipanggil langsung lewat API. Next.js hanya merender, mengelola sesi, dan menjalankan dua Route Handler yang memerlukan *service role*.

| # | Pertanyaan | Jawaban singkat | Detail |
|---|---|---|---|
| **a** | Bagaimana header MP3 divalidasi di server bila upload langsung dari browser ke Storage? | Server tidak perlu melihat isi **saat** upload; ia memeriksanya **sebelum lagu dipublikasikan**. Browser mengunggah ke path yang sudah dipesan (`pending`); file itu tidak terbaca siapa pun. Browser lalu memanggil `finalize`; Route Handler membaca **64 KiB pertama** lewat HTTP Range dengan service role, memeriksa ukuran, MIME, tag ID3, dan **3 frame MP3 beruntun**. Hanya bila lolos baris menjadi `ready`. | §6 |
| **b** | Bagaimana batas 3 lagu aktif tidak jebol oleh upload paralel? | Trigger `BEFORE INSERT` pada `songs` mengambil `SELECT … FOR UPDATE` pada baris `profiles` milik user, baru menghitung. Transaksi paralel milik user yang sama antre. Terverifikasi: 10 sesi paralel → tepat 3 berhasil; tanpa kunci → 10. | §7 |
| **c** | Urutan penghapusan di job F18? | **Tombstone → file Storage (lewat Storage API) → baris/user.** File selalu dihapus lebih dulu; baris dan user (beserta cascade-nya) terakhir. Kegagalan di langkah mana pun meninggalkan baris sebagai "daftar tugas" yang dicoba ulang. | §8 |
| **d** | Trigger pembuatan `profiles` saat sign-in anonim? | `AFTER INSERT` pada `auth.users` → `INSERT INTO profiles … ON CONFLICT DO NOTHING`. Sign-in anonim memasukkan baris ke `auth.users` (`is_anonymous = true`), jadi trigger menangkapnya. Ditambah *self-heal* di `touch_last_seen()` dan trigger kuota. | §9 |

**Prinsip desain**
1. **Tegakkan di lapisan terdekat dengan data.** UI hanya UX; batas keamanan ada di RLS, trigger, dan policy Storage.
2. **Baris dulu, file kemudian.** Setiap objek di bucket pribadi selalu punya baris `songs` sejak sebelum file ada, sehingga tidak ada file yatim akibat upload yang terputus.
3. **Tidak ada yang bisa membaca file yang belum divalidasi.** Policy baca mensyaratkan baris `ready`.
4. **Service role hanya di server** dan hanya untuk tiga hal: `finalize`, penghapusan lagu, dan job/seed.
5. **Satu sumber kebenaran waktu:** `now()` di database, bukan jam klien.

---

## 2. Konteks dan pendorong desain

| Pendorong (dari spec) | Konsekuensi arsitektur |
|---|---|
| Demo ≤ 3 klik / ≤ 15 dtk, tanpa daftar (F1) | Sign-in anonim + Turnstile mode tak terlihat; tidak ada layar form |
| Audio tidak putus saat pindah halaman (F2) | Pemutar di layout `(app)`; satu `HTMLAudioElement` singleton di luar siklus render; state di Zustand |
| Data tiap pengunjung terisolasi (F1, F7, F8) | RLS per `auth.uid()`; user anonim berperan `authenticated` |
| Katalog read-only untuk klien, diisi lewat seed (F9) | Tidak ada policy tulis katalog; seed memakai service role |
| Upload pribadi: MP3, ≤ 10 MB, ≤ 3 lagu, 24 jam (F5) | Alur *reserve → upload → verify → publish*; trigger kuota; `expires_at`; job pembersih |
| File ≤ 10 MB tidak boleh lewat fungsi serverless Vercel (batas body ±4,5 MB) | Upload **langsung** ke Storage (TUS), validasi dengan membaca sebagian file |
| Free tier Supabase (F18, F20): DB 500 MB, Storage 1 GB, egress 5 GB; **di-pause bila aktivitas database rendah 7 hari** | Batas ketat (3 lagu/user, 500 MB pribadi global, 20 playlist, 200 lagu/playlist), pembersihan otomatis, CAPTCHA, dan keep-alive harian (§13.2) |
| Hourly job | Vercel Cron paket Hobby hanya harian → **pg_cron + Edge Function** di Supabase |

---

## 3. Arsitektur tingkat tinggi

```mermaid
flowchart LR
  subgraph BR["Browser"]
    UI["Client components"]
    PL["Zustand store + satu Audio singleton"]
    UI --> PL
  end
  subgraph VC["Vercel (Next.js)"]
    MW["Middleware: refresh sesi, gerbang login"]
    RSC["Server Components (query dengan JWT user)"]
    API["Route Handlers: finalize upload, hapus lagu"]
  end
  subgraph SB["Supabase"]
    AUTH["Auth: sign-in anonim + CAPTCHA"]
    PG[("Postgres: RLS, trigger, RPC")]
    ST[("Storage: audio, covers, user-audio, user-covers")]
    EF["Edge Function: cleanup"]
    CR["pg_cron + pg_net"]
  end
  CF["Cloudflare Turnstile"]
  SEED["scripts/seed.ts (lokal atau CI)"]
  GH["GitHub Actions: keep-alive harian"]
  GH -- "POST rpc/ping (anon key)" --> PG
  UI -- "token CAPTCHA" --> CF
  UI -- "signInAnonymously" --> AUTH
  AUTH -- "INSERT auth.users" --> PG
  UI -- "RPC dan query (RLS)" --> PG
  UI -- "TUS upload, signed URL, audio" --> ST
  UI --> MW --> RSC --> PG
  UI -- "finalize, hapus lagu" --> API
  API -- "service role" --> ST
  API -- "service role" --> PG
  CR -- "HTTP + secret" --> EF
  EF -- "service role: file lalu baris" --> ST
  EF --> PG
  SEED -- "service role" --> ST
  SEED --> PG
```

### 3.1 Komponen

| Komponen | Tanggung jawab | Kunci yang dipakai |
|---|---|---|
| Client components | UI, pemutar, optimistic like, upload TUS | anon/publishable key + JWT user |
| Middleware | Refresh sesi (`@supabase/ssr`), redirect ke `/masuk`, 401 untuk `/api/*` | JWT dari cookie |
| Server Components | Render halaman dengan query ber-RLS | JWT user |
| Route Handler `finalize` | Validasi isi file, menerbitkan `ready` | JWT user (autentikasi) + service role (baca file, RPC) |
| Route Handler hapus lagu | Kedaluwarsakan baris, hapus file lalu baris | idem |
| Edge Function `cleanup` | Tiga tugas F18 | service role (bawaan runtime) + `CLEANUP_SECRET` |
| `scripts/seed.ts` | Mengisi katalog publik, idempoten | service role (lokal/CI) |
| GitHub Actions `keepalive` | Memanggil RPC `ping()` tiap hari agar proyek Free tidak di-pause (§13.2) | anon key |

### 3.2 Struktur repositori

```
app/
  (auth)/masuk/page.tsx            # tombol "Coba tanpa daftar" + Turnstile
  (app)/layout.tsx                 # Sidebar, Header, <PlayerBar/>, <PlayerBoot/>  <- pemutar hidup di sini
  (app)/page.tsx                   # beranda
  (app)/album/[id]  artis/[id]  cari  library  disukai  playlist/[id]  unggah
  api/uploads/[id]/finalize/route.ts
  api/songs/[id]/route.ts          # DELETE
lib/
  player/{audio.ts, store.ts}
  supabase/{client.ts, server.ts, middleware.ts, admin.ts}   # admin.ts: import 'server-only'
  audio/mp3.test.ts                # sudah ada di repo
  audio/mp3.ts                     # validator murni (Lampiran B) — dipakai handler, seed, unit test
supabase/
  migrations/0001..0005_*.sql      # Lampiran A
  functions/cleanup/index.ts
  tests/sql/helpers.sql            # sudah ada di repo
  tests/sql/rls_and_limits.test.sql  # 82 uji; dijalankan ulang di `supabase start` (spike S6)
  tests/concurrency.sh             # balapan: kuota lagu, 20 playlist, batas global
  tests/mock/{stub.sql,run-mock.sh}  # hanya untuk lingkungan tanpa Docker
scripts/seed.ts  scripts/seed/catalog.json
.github/workflows/keepalive.yml    # §13.2 (disalin saat Fase 1)
e2e/                               # Playwright
```

**Aturan penting:** `PlayerBar` dan `PlayerBoot` ada di `app/(app)/layout.tsx`, **bukan** di `template.tsx` (template di-*remount* tiap navigasi) dan tidak diberi `key` yang berubah.

```mermaid
flowchart TD
  ROOT["app/layout.tsx"] --> APPL["app/(app)/layout.tsx: Sidebar, Header, PlayerBar, PlayerBoot"]
  APPL --> PAGES["children: halaman yang berganti saat navigasi"]
  APPL --> PB["PlayerBar (client) membaca Zustand"]
  PB -.-> ZS["Zustand store"]
  ZS -.-> AU["globalThis.__streamingAudio: satu HTMLAudioElement"]
```

---

## 4. Model data

```mermaid
erDiagram
  USERS ||--|| PROFILES : "trigger"
  USERS ||--o{ SONGS : "pemilik lagu pribadi"
  ARTISTS ||--o{ ALBUMS : memiliki
  ARTISTS ||--o{ SONGS : "lagu publik"
  ALBUMS ||--o{ SONGS : "lagu publik"
  USERS ||--o{ LIKES : ""
  SONGS ||--o{ LIKES : ""
  USERS ||--o{ PLAYLISTS : ""
  PLAYLISTS ||--o{ PLAYLIST_SONGS : ""
  SONGS ||--o{ PLAYLIST_SONGS : ""
  SONGS {
    uuid id PK
    text visibility "public atau private"
    text status "pending atau ready"
    uuid owner_id FK "null untuk lagu publik"
    text audio_path
    timestamptz expires_at "null untuk lagu publik"
  }
  PROFILES {
    uuid user_id PK
    text status "active atau deleting"
    timestamptz last_seen_at
  }
```

Skema lengkap ada di **Lampiran A (0001)**. Keputusan modelnya:

- **Satu tabel `songs`** untuk publik dan pribadi, dibedakan `visibility`, dengan `CHECK songs_shape` yang membuat kombinasi tak sah mustahil (mis. lagu publik berpemilik, lagu pribadi berkaitan ke `artists`). Lagu pribadi menyimpan artis/album sebagai **teks** (`artist_name`, `album_name`) sehingga nama ketikan pengunjung tidak bocor ke katalog (spec F5).
- **`status`** (`pending`/`ready`) dan **`expires_at`** menjadi mesin keadaan upload sekaligus kedaluwarsa:

```mermaid
stateDiagram-v2
  [*] --> pending: reserve_upload (TTL 15 menit)
  pending --> ready: finalize_upload setelah validasi lolos (expires_at = +24 jam)
  pending --> kedaluwarsa: TTL habis, dibatalkan, atau validasi gagal
  ready --> kedaluwarsa: expires_at tercapai atau dihapus pemilik
  kedaluwarsa --> terhapus: job per jam (file dulu, baris kemudian)
  terhapus --> [*]
```

"Kedaluwarsa" bukan kolom; ia **diturunkan** dari `expires_at <= now()`. Itu sebabnya lagu langsung tak terbaca (RLS) dan slotnya langsung bebas (kuota) walau job belum jalan.

- **`likes`, `playlists`, `playlist_songs`** memakai `ON DELETE CASCADE` ke `auth.users` dan ke `songs`. `position` pada `playlist_songs` adalah `identity` (monoton, bebas balapan).
- **`app_limits`** adalah tabel satu baris (`id boolean` dengan `CHECK (id)`) berisi `private_storage_cap_bytes` (default 500 MB). Pemilik proyek mengubahnya lewat SQL; klien tak punya akses.
- **Batas yang ditegakkan trigger:** 3 lagu pribadi aktif per user, 500 MB lagu pribadi global, 20 playlist per user, 200 lagu per playlist (§7).
- **Pencarian** memakai indeks trigram (`pg_trgm`) dan RPC `search_all` (SECURITY INVOKER, jadi RLS ikut berlaku).
- **Perhatian saat query:** karena lagu kedaluwarsa tetap berupa baris sampai dipurge, hitungan lagu playlist/like harus dihitung lewat **join ke `songs`** (yang ter-filter RLS), bukan `count(*)` mentah pada `playlist_songs`/`likes`. Uji T7b memverifikasi ini.

---

## 5. Keamanan: RLS dan policy Storage

SQL lengkap: **Lampiran A (0003, 0004)**. Inti aturan:

### 5.1 Matriks akses

| Sumber daya | Tanpa sesi (`anon`) | Pengunjung (`authenticated`, termasuk anonim) | Service role |
|---|---|---|---|
| `artists`, `albums` | tidak ada akses | SELECT | semua |
| `songs` | tidak ada akses | SELECT lagu publik `ready` + lagu pribadi `ready`, milik sendiri, belum kedaluwarsa. Tidak ada INSERT/UPDATE/DELETE langsung | semua |
| `likes` | tidak ada akses | SELECT/INSERT/DELETE milik sendiri; INSERT hanya untuk lagu yang terlihat olehnya | semua |
| `playlists`, `playlist_songs` | tidak ada akses | CRUD milik sendiri; menambah lagu hanya yang terlihat olehnya | semua |
| `profiles`, `job_leases`, `app_limits` | tidak ada akses | tidak ada akses (RLS aktif tanpa policy, tanpa grant) | semua |
| RPC `reserve_upload`, `expire_my_song`, `touch_last_seen`, `search_all`, `get_upload_status` | ditolak | boleh | boleh |
| RPC `ping` (keep-alive, hanya-baca, mengembalikan `{ok, ts}`) | **boleh** | boleh | boleh |
| RPC `finalize_upload`, `claim_inactive_anonymous_users`, `list_orphan_objects`, lease | ditolak | **ditolak** | boleh |
| Bucket `audio`, `covers` (publik) | baca lewat URL publik | baca lewat URL publik; **tulis ditolak** | tulis |
| Bucket `user-audio`, `user-covers` (privat) | tidak ada akses | INSERT hanya ke path pesanan `pending` milik sendiri; SELECT hanya bila lagunya terlihat; **tidak ada UPDATE/DELETE** | semua |

> **Catatan:** user anonim Supabase berperan `authenticated` (JWT berklaim `is_anonymous = true`). Jangan menulis policy yang menganggap `authenticated` = "user terdaftar".

### 5.2 Policy kunci

Lagu: baris `pending` tak pernah terlihat oleh klien; lagu pribadi hanya terlihat oleh pemilik selama belum kedaluwarsa.

```sql
create policy songs_read on public.songs for select to authenticated
using (
  status = 'ready'
  and (
    visibility = 'public'
    or (owner_id = (select auth.uid()) and expires_at > now())
  )
);
```

Like hanya untuk lagu yang terlihat oleh pemanggil (subquery dalam policy tunduk pada RLS `songs`, jadi like atas lagu pribadi orang lain gagal):

```sql
create policy likes_add    on public.likes for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.songs s where s.id = song_id));
```

Storage — tulis hanya ke path yang sudah dipesan, baca hanya bila lagunya terlihat:

```sql
create policy "private_upload_reserved_path_only" on storage.objects
for insert to authenticated
with check (
  bucket_id in ('user-audio', 'user-covers')
  and public.owns_pending_object(bucket_id, name)
);
```

```sql
create policy "private_read_own_live" on storage.objects
for select to authenticated
using (
  (bucket_id = 'user-audio'  and exists (select 1 from public.songs s where s.audio_path = name))
  or
  (bucket_id = 'user-covers' and exists (select 1 from public.songs s where s.cover_path = name))
);
```

```sql
create or replace function public.owns_pending_object(p_bucket text, p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.songs s
     where s.owner_id = (select auth.uid())
       and s.visibility = 'private' and s.status = 'pending' and s.expires_at > now()
       and ((p_bucket = 'user-audio'  and s.audio_path = p_name)
         or (p_bucket = 'user-covers' and s.cover_path = p_name))
  );
$$;
```

### 5.3 Ancaman dan kontrol

| Ancaman | Kontrol |
|---|---|
| Pengunjung menulis ke katalog lewat API langsung | Tidak ada policy tulis dan tidak ada grant tulis untuk `authenticated`; uji T3g, T8d |
| Pengunjung membaca like/playlist/lagu pribadi pengunjung lain | RLS per `auth.uid()`; uji T5, T6, T8j |
| Melewati batas 3 lagu dengan memanggil Storage langsung | Storage hanya menerima path yang sudah dipesan lewat `reserve_upload`, dan reservasi dibatasi trigger kuota; jumlah baris `pending`+`ready` aktif ≤ 3 |
| Mengunggah file besar | `file_size_limit` bucket (ditegakkan Storage terhadap byte nyata) + pemeriksaan ukuran di `finalize` |
| Mengunggah bukan-MP3 yang diberi ekstensi/MIME palsu | Ekstensi dan MIME hanya klaim klien; **pemeriksaan isi** di `finalize` (§6) |
| Menimpa file setelah divalidasi | Tidak ada policy UPDATE, `upsert` ditolak, dan policy INSERT mensyaratkan `status = 'pending'` |
| Penyalahgunaan sign-in anonim (membanjiri `auth.users`) | CAPTCHA wajib + rate limit Auth + pembersihan 7 hari (F18) |
| Menghabiskan Storage gratis dengan banyak akun anonim | Batas penyimpanan pribadi global 500 MB di trigger; upload ditutup sementara bila penuh (uji T17, konkurensi no. 3) |
| Membanjiri playlist | 20 playlist/user dan 200 lagu/playlist di trigger (uji T15, T16, konkurensi no. 2) |
| Penyalahgunaan `ping()` oleh pemegang anon key | Hanya-baca, satu kueri ringan, tak membocorkan data; satu-satunya objek yang boleh dipanggil `anon` (uji T18) |
| Kebocoran service-role key | `import 'server-only'`, tidak ada `NEXT_PUBLIC_` untuk kunci itu |
| CSRF pada Route Handler | Pemeriksaan header `Origin`, cookie `SameSite=Lax`, JWT diverifikasi di server |

---

## 6. (a) Upload dan validasi header MP3 di server

### 6.1 Mengapa tidak lewat server Next.js

Fungsi serverless Vercel membatasi body permintaan (±4,5 MB), sedangkan batas pengunjung 10 MB. Meneruskan file lewat server juga menggandakan bandwidth. Maka upload **langsung** dari browser ke Storage dengan TUS (resumable, ada progres untuk F5). Konsekuensinya server tidak melihat isi file saat upload — dan itu tidak apa-apa, asalkan **tidak ada yang dipublikasikan sebelum server memeriksanya**.

### 6.2 Alur *reserve → upload → verify → publish*

```mermaid
sequenceDiagram
  autonumber
  participant B as Browser
  participant D as Postgres
  participant S as Storage
  participant H as Route Handler
  B->>D: rpc reserve_upload (judul, artis, album, ekstensi cover)
  D->>D: trigger kuota: kunci profil, hitung lagu aktif
  alt kuota penuh
    D-->>B: error quota_exceeded
  else ada slot
    D-->>B: song_id, audio_path, cover_path (status pending, TTL 15 menit)
    B->>S: TUS upload ke audio_path (policy: harus path pending milik sendiri)
    B->>S: upload cover ke cover_path (opsional)
    B->>H: POST /api/uploads/:id/finalize
    H->>S: signed URL 60 dtk, GET Range 0..64 KiB
    H->>H: checkMp3 (ukuran, MIME, ID3, 3 frame beruntun)
    alt valid
      H->>D: rpc finalize_upload (service role): ready, expires_at +24 jam
      H-->>B: 200 dan durasi
    else tidak valid
      H->>S: hapus objek
      H->>D: tandai kedaluwarsa
      H-->>B: 422 dan alasan
    end
  end
```

Langkah demi langkah:

1. **Reserve** — `rpc('reserve_upload', …)` membuat baris `songs` (`pending`, `expires_at = now() + 15 menit`) dengan path deterministik `{uid}/{song_id}.mp3` (dan `.jpg|.png|.webp` untuk cover). Trigger kuota berjalan di sini (§7). Bila kuota penuh, error `quota_exceeded` dan **tidak ada file yang boleh diunggah**.
2. **Upload** — browser mengunggah ke path itu. Policy Storage mengizinkan INSERT hanya bila `owns_pending_object(bucket, name)` benar. Bucket memaksa `file_size_limit = 10 MiB`. Selama `pending`, tidak ada policy SELECT, jadi tidak ada yang dapat membaca file itu, termasuk pemiliknya.
3. **Verify** — `POST /api/uploads/:id/finalize` (lihat kode di bawah). Handler memastikan pemanggil adalah pemilik baris `pending` yang belum kedaluwarsa, lalu memeriksa isi file.
4. **Publish** — `finalize_upload` (hanya service role) mengubah baris menjadi `ready` dan menetapkan `expires_at = now() + 24 jam`. Hanya sejak saat itu RLS dan policy Storage mengizinkan pemilik membaca.

### 6.3 Lapisan pertahanan

| Lapis | Mekanisme | Menjamin | **Tidak** menjamin |
|---|---|---|---|
| L0 | Cek klien (ekstensi, ukuran) | UX cepat | apa pun (bisa dilewati) |
| L1 | `file_size_limit` dan `allowed_mime_types` bucket | Ukuran nyata ≤ 10 MiB. MIME hanya pagar kasar | isi file (MIME adalah klaim klien) |
| L2 | Policy INSERT terikat baris reservasi, tanpa UPDATE | Hanya path pesanan; hanya sekali tulis; tidak bisa ditimpa setelah validasi | isi file |
| L3 | `finalize`: ukuran dari `Content-Range`, `Content-Type` tersimpan, ID3, **3 frame Layer III beruntun** | File benar-benar berstruktur MP3 di bagian awalnya | seluruh isi file valid |
| L4 | Baca hanya lewat signed URL ke pemilik; domain Storage berbeda dari domain app; kedaluwarsa 24 jam | Dampak file ganjil terbatas pada browser pemiliknya sendiri | — |

**Mengapa 3 frame beruntun:** satu pasangan byte `FF Fx` muncul acak di banyak file. Menghitung panjang frame dari header lalu mensyaratkan header valid di tempat yang diprediksi, tiga kali berturut-turut, membuat salah-deteksi praktis mustahil (uji: file `.exe`/byte acak/WAV/Layer II ditolak; lihat Lampiran B).

**Risiko sisa yang diterima:** validasi hanya mencakup awal file. File bisa berawalan MP3 valid lalu berisi data lain (*polyglot*). Pengunjung hanya dapat menyajikannya kepada dirinya sendiri, dari origin Storage (bukan origin app), selama ≤ 24 jam, jadi tidak ada vektor ke pengunjung lain. Bila kelak lagu pribadi bisa dibagikan, tambahkan pemeriksaan penuh/transcode.

### 6.4 Route Handler `finalize` (kerangka)

Logika murni ada di `lib/audio/mp3.ts` (**Lampiran B**, sudah diuji). Handler:

```ts
// app/api/uploads/[id]/finalize/route.ts
import 'server-only';
import { checkMp3, checkImage, LIMITS } from '@/lib/audio/mp3';
export const runtime = 'nodejs';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (req.headers.get('origin') !== new URL(req.url).origin) return fail(403, 'bad_origin'); // CSRF
  const user = await currentUser();                 // verifikasi JWT dari cookie (@supabase/ssr)
  if (!user) return fail(401, 'unauthenticated');
  const db = adminClient();                         // service role, hanya di server

  const { data: song } = await db.from('songs')
    .select('id,status,audio_path,cover_path,expires_at')
    .eq('id', id).eq('owner_id', user.id).eq('visibility', 'private').maybeSingle();
  if (!song) return fail(404, 'not_found');
  if (song.status === 'ready') return ok();                                  // idempoten
  if (new Date(song.expires_at) <= new Date()) return fail(410, 'reservation_expired');

  const audio = await readRange(db, 'user-audio', song.audio_path, 0, LIMITS.headBytes);
  if (!audio) return fail(409, 'upload_incomplete');                         // belum selesai diunggah
  if (audio.contentType !== 'audio/mpeg') return reject(db, song, 'bad_mime');

  let v = checkMp3(audio.bytes, audio.total);
  if (!v.ok && v.reason === 'need_window') {                                 // tag ID3 melewati 64 KiB
    const w = await readRange(db, 'user-audio', song.audio_path, v.needFrom, LIMITS.windowBytes);
    if (w) v = checkMp3(audio.bytes, audio.total, { offset: v.needFrom, bytes: w.bytes });
  }
  if (!v.ok) return reject(db, song, v.reason);

  if (song.cover_path) {
    const ext = song.cover_path.split('.').pop() as 'jpg' | 'png' | 'webp';
    const c = await readRange(db, 'user-covers', song.cover_path, 0, 16);
    if (!c || c.total > 2 * 1024 * 1024 || !checkImage(c.bytes, ext)) return reject(db, song, 'bad_cover');
  }

  const { error } = await db.rpc('finalize_upload', {
    p_song_id: id, p_user_id: user.id, p_duration_sec: v.durationSec, p_size_bytes: audio.total });
  return error ? fail(409, 'reservation_invalid') : ok({ durationSec: v.durationSec });
}

async function readRange(db: Admin, bucket: string, path: string, from: number, len: number) {
  const { data } = await db.storage.from(bucket).createSignedUrl(path, 60);
  if (!data) return null;                                                    // objek belum ada
  const r = await fetch(data.signedUrl, { headers: { Range: `bytes=${from}-${from + len - 1}` } });
  if (r.status !== 206 && r.status !== 200) return null;
  const buf = new Uint8Array(await r.arrayBuffer());
  const total = Number(r.headers.get('content-range')?.split('/')[1] ?? r.headers.get('content-length'));
  // bila server mengabaikan Range dan membalas 200, potong sendiri (worst case: baca ≤ 10 MiB)
  return { bytes: r.status === 200 ? buf.subarray(from, from + len) : buf, total, contentType: r.headers.get('content-type') };
}

async function reject(db: Admin, song: SongRow, reason: string) {
  await db.from('songs').update({ expires_at: new Date().toISOString() }).eq('id', song.id); // slot bebas
  await db.storage.from('user-audio').remove([song.audio_path]);
  if (song.cover_path) await db.storage.from('user-covers').remove([song.cover_path]);
  return fail(422, reason);          // sisa baris dibersihkan job per jam
}
```

### 6.5 Perilaku pada kegagalan

| Situasi | Hasil |
|---|---|
| `finalize` dipanggil sebelum upload selesai | 409 `upload_incomplete`; klien boleh mencoba lagi selama TTL |
| File bukan MP3 / terlalu besar / MIME salah | 422 + alasan; objek dihapus; slot bebas |
| Reservasi lewat 15 menit | 410; baris dan file dibersihkan job |
| `finalize` dipanggil dua kali | Idempoten (sudah `ready` → 200) |
| Tab ditutup di tengah upload | Baris `pending` kedaluwarsa sendiri dan dipurge job; tak pernah terlihat |
| Klien mengunggah lalu **tidak** memanggil `finalize` | File tak terbaca siapa pun; dipurge job |
| Percobaan overwrite objek setelah `ready` | Ditolak policy (uji T8i) |

---

## 7. (b) Batas 3 lagu aktif tanpa jebol oleh upload paralel

### 7.1 Mekanisme

Kuota ditegakkan oleh **trigger `BEFORE INSERT` pada `songs`**, bukan oleh aplikasi dan bukan oleh RPC saja, sehingga berlaku untuk jalur mana pun yang menyisipkan lagu pribadi. Kuncinya adalah **mengunci baris `profiles` milik user sebelum menghitung**:

```sql
create or replace function public.enforce_private_song_quota()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_active integer;
  v_used   bigint;
  v_cap    bigint;
begin
  insert into public.profiles (user_id) values (new.owner_id) on conflict (user_id) do nothing;

  perform 1 from public.profiles
   where user_id = new.owner_id and status = 'active'
   for update;
  if not found then
    raise exception 'account_not_active' using errcode = 'P0001';
  end if;

  select count(*) into v_active
    from public.songs
   where owner_id = new.owner_id and visibility = 'private' and expires_at > now();

  if v_active >= 3 then
    raise exception 'quota_exceeded' using errcode = 'P0001', hint = 'maks 3 lagu pribadi aktif';
  end if;

  -- Batas penyimpanan pribadi GLOBAL. Kunci kedua (baris singleton) diambil SETELAH kunci profil; urutan
  -- profil -> global selalu sama, jadi tidak ada deadlock. Semua baris lagu pribadi yang masih ada dihitung,
  -- termasuk yang sudah kedaluwarsa tetapi belum dipurge (file fisiknya masih ada). Reservasi tanpa ukuran
  -- (pending) dihitung 10 MiB, batas maksimum per file. Hanya byte audio; cover (maks 2 MiB) tidak dihitung.
  select private_storage_cap_bytes into v_cap from public.app_limits for update;
  select coalesce(sum(coalesce(size_bytes, 10485760)), 0) into v_used
    from public.songs where visibility = 'private';
  if v_used + 10485760 > v_cap then
    raise exception 'storage_full' using errcode = 'P0001', hint = 'upload pengunjung ditutup sementara';
  end if;
  return new;
end $$;
```

```sql
create trigger songs_private_quota
before insert on public.songs
for each row when (new.visibility = 'private')
execute function public.enforce_private_song_quota();
```

Mengapa ini benar di bawah `READ COMMITTED` (default PostgREST):

1. Transaksi T1 dan T2 (user yang sama) sama-sama sampai di `SELECT … FOR UPDATE`. Salah satunya (T1) memperoleh kunci; T2 **menunggu**.
2. T1 menghitung (0 lagu), melanjutkan `INSERT`, lalu commit; kunci dilepas.
3. T2 memperoleh kunci. `SELECT count(*)` berikutnya adalah **statement baru dengan snapshot baru**, sehingga melihat baris T1 yang sudah commit. Hitungannya benar.

Kunci hanya memblokir permintaan **user yang sama**; user lain tidak terpengaruh. Baris `profiles` dijamin ada karena dibuat trigger sign-in (§9) dan, sebagai cadangan, di-`INSERT … ON CONFLICT DO NOTHING` di awal fungsi ini.

**Semantik:** yang dihitung adalah semua lagu pribadi dengan `expires_at > now()`, **termasuk `pending`**. Reservasi yang ditinggalkan menahan slot paling lama 15 menit, dan `expire_my_song` melepasnya seketika. Lagu kedaluwarsa tak menahan slot walau belum dipurge.

### 7.2 Alternatif yang ditimbang (ADR-2)

| Opsi | Putusan | Alasan |
|---|---|---|
| `FOR UPDATE` pada baris profil (dipilih) | ✅ | Sederhana, terverifikasi, tidak memblokir user lain |
| `pg_advisory_xact_lock(hashtextextended(uid::text, 0))` | Alternatif setara | Tidak butuh baris profil, tetapi kunci "tak terlihat" dan sulit di-debug; hash bisa bertabrakan antar user (hanya memperlambat) |
| Hitung di aplikasi sebelum insert | ❌ | Balapan: dua permintaan membaca "2" bersamaan |
| `SERIALIZABLE` | ❌ | Butuh logika retry di klien; gagal acak (`40001`) |
| Slot bernomor 1..3 + `UNIQUE (owner_id, slot)` | ❌ | Indeks unik tak bisa memakai `now()`, jadi slot kedaluwarsa tak bebas tanpa job |

### 7.3 Bukti

Uji konkurensi: 10 sesi `psql` paralel untuk satu user yang sama memanggil `reserve_upload` pada fungsi yang sengaja diberi `pg_sleep(0,3)` antara hitung dan insert (memperlebar jendela balapan), diulang 3 ronde dengan user baru.

| Varian | Berhasil | Ditolak `quota_exceeded` | Baris di DB |
|---|---|---|---|
| Dengan `FOR UPDATE` | 3 / 3 / 3 | 7 / 7 / 7 | 3 / 3 / 3 |
| **Kontrol**: tanpa `FOR UPDATE` | 10 / 10 / 10 | 0 / 0 / 0 | 10 / 10 / 10 |

Batas tambahan (§7.4) diuji dengan skrip yang sama, sekali jalan per varian, dengan `pg_sleep(0,3)` yang sama di tiap trigger:

| Uji | Yang diharapkan | Dengan kunci | **Kontrol**: tanpa kunci |
|---|---|---|---|
| 30 insert playlist paralel, satu user | tepat 20 baris | 20 | 30 |
| 2 user paralel berebut 1 slot penyimpanan global | tepat 1 reservasi berhasil | 1 | 2 |
| Kuota 3 lagu (ulang, dengan `pg_sleep`) | tepat 3 | 3 / 3 / 3 | 10 / 10 / 10 |

Kontrol membuktikan uji itu sensitif: tanpa kunci kuota jebol sepenuhnya. Skrip kini ada di repo (`supabase/tests/concurrency.sh`) dan harus masuk CI (§12).

### 7.4 Batas lain yang disetujui: penyimpanan global, playlist, lagu per playlist

Pola yang sama (kunci baris induk, baru hitung) dipakai untuk tiga batas tambahan. Semuanya di trigger, jadi berlaku untuk jalur mana pun.

| Batas | Trigger | Kunci | Galat |
|---|---|---|---|
| 500 MB lagu pribadi global | `songs_private_quota` (bagian kedua fungsi di §7.1) | baris singleton `app_limits`, **setelah** kunci profil | `storage_full` |
| 20 playlist per user | `playlists_limit` | baris `profiles` user | `playlist_limit` |
| 200 lagu per playlist | `playlist_songs_limit` | baris `playlists` | `playlist_song_limit` |

```sql
create or replace function public.enforce_playlist_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_n integer;
begin
  if new.user_id is distinct from (select auth.uid()) then return new; end if;
  insert into public.profiles (user_id) values (new.user_id) on conflict (user_id) do nothing;
  perform 1 from public.profiles where user_id = new.user_id for update;
  select count(*) into v_n from public.playlists where user_id = new.user_id;
  if v_n >= 20 then
    raise exception 'playlist_limit' using errcode = 'P0001', hint = 'maks 20 playlist';
  end if;
  return new;
end $$;
```

```sql
create or replace function public.enforce_playlist_song_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_n integer;
begin
  perform 1 from public.playlists
   where id = new.playlist_id and user_id = (select auth.uid()) for update;
  if not found then return new; end if;
  select count(*) into v_n from public.playlist_songs where playlist_id = new.playlist_id;
  if v_n >= 200 then
    raise exception 'playlist_song_limit' using errcode = 'P0001', hint = 'maks 200 lagu per playlist';
  end if;
  return new;
end $$;
```

Catatan desain:

- **Urutan kunci tetap** (profil → global) pada semua kode yang menyentuh keduanya, sehingga tak ada deadlock. Kunci global memblokir reservasi semua user, tetapi hanya selama transaksi yang berlangsung beberapa milidetik.
- **Cara menghitung 500 MB:** jumlah `size_bytes` semua baris lagu pribadi yang **masih ada** (termasuk kedaluwarsa yang belum dipurge, karena file fisiknya masih ada), dengan reservasi `pending` dihitung 10 MiB (batas per file). Hanya byte audio; cover (≤ 2 MiB) tak dihitung. Konsekuensinya ruang baru kembali tersedia setelah job per jam menghapus baris, paling lama ±75 menit setelah kedaluwarsa. Ukuran asli disimpan saat `finalize_upload`, jadi reservasi yang selesai biasanya mengecil dari 10 MiB ke ukuran nyata.
- **UI:** `get_upload_status()` mengembalikan `{ active, max, storage_open }`. Bila `storage_open` salah, form `/unggah` dinonaktifkan dengan pesan "Upload sedang ditutup sementara karena penyimpanan penuh. Coba lagi nanti."; panggilan langsung ke `reserve_upload` tetap ditolak `storage_full`.
- **Trigger playlist tidak mengunci baris milik orang lain:** bila `user_id`/playlist bukan milik pemanggil, trigger langsung `return new` dan membiarkan RLS menolak (uji T15d, T16d). Insert service role (tanpa `auth.uid()`) dilewatkan.
- **Perhitungan 200 lagu** mencakup baris lagu pribadi kedaluwarsa yang belum dipurge (paling lama ±75 menit); disengaja agar sederhana dan tercantum di spec F8.
- **Mengubah batas global:** `update public.app_limits set private_storage_cap_bytes = …` lewat SQL editor/migrasi; tanpa deploy.

Bukti konkurensi untuk ketiganya ada di §7.3 (tabel ke-2).

---

## 8. (c) Urutan penghapusan di job F18

### 8.1 Mengapa job tidak bisa murni SQL

Menghapus baris dari `storage.objects` lewat SQL **tidak menghapus byte-nya** di penyimpanan objek. Karena itu file harus dihapus lewat **Storage API**, dan itu tidak bisa dilakukan dari `pg_cron` saja. Maka `pg_cron` hanya *memicu* HTTP ke **Edge Function `cleanup`** (lewat `pg_net`), dan fungsi itulah yang memegang service role dan memanggil Storage API. (Vercel Cron paket Hobby, pada saat dokumen ini ditulis, hanya harian sehingga tidak cocok untuk job per jam; cek ulang batasnya.)

### 8.2 Invarian

> **(1)** Baris/user tidak pernah dihapus sebelum file-nya hilang. **(2)** Sebelum file user dihapus, user ditandai `deleting` agar tak bisa menambah file baru. **(3)** Setiap langkah idempoten.

### 8.3 Tiga tugas

| Tugas | Jadwal | Urutan |
|---|---|---|
| `songs` | tiap jam | pilih lagu pribadi dengan `expires_at <= now() - 15 menit` → **hapus file (audio, cover)** → **hapus baris** (cascade ke `likes` dan `playlist_songs`) |
| `users` | harian | **tombstone** (`claim_inactive_anonymous_users`) → **hapus semua objek di prefix `{uid}/`** → `auth.admin.deleteUser(uid)` (**cascade** ke `profiles`, `songs`, `likes`, `playlists`, `playlist_songs`) |
| `orphans` | harian | `list_orphan_objects` (baca `storage.objects` lewat SQL) → hapus lewat **Storage API** |

```mermaid
flowchart TD
  C["pg_cron per jam"] --> L{"acquire_job_lease"}
  L -- "ditolak" --> X["selesai: job lain sedang berjalan"]
  L -- "didapat" --> S1["SELECT lagu pribadi expires_at lewat 15 menit"]
  S1 --> S2["Storage API remove: audio dan cover"]
  S2 -- "gagal" --> F["lempar error, baris TIDAK dihapus, ulang jam depan"]
  S2 -- "sukses atau file sudah tiada" --> S3["DELETE songs, cascade likes dan playlist_songs"]
  S3 --> R["release_job_lease dan catat hasil"]
```

```mermaid
flowchart TD
  U1["Harian: claim_inactive_anonymous_users"] --> U2["Tombstone: profiles.status = deleting dan hapus auth.sessions"]
  U2 --> U3["Per user: list dan remove semua objek di prefix uid pada user-audio dan user-covers"]
  U3 -- "gagal" --> UF["tombstone tetap, diulang besok"]
  U3 -- "prefix kosong" --> U4["auth.admin.deleteUser"]
  U4 --> U5["CASCADE: profiles, songs, likes, playlists, playlist_songs"]
```

**Mengapa "list prefix" untuk user:** mendaftar langsung objek di Storage (bukan dari baris `songs`) mencakup juga file yang barisnya sudah hilang atau tak pernah `ready`. Karena semua path berbentuk `{uid}/{file}`, satu `list` per bucket cukup.

**Mengapa tombstone:** tanpa penanda, user yang kebetulan aktif tepat saat job berjalan bisa mengunggah file baru *setelah* file-nya dihapus tetapi *sebelum* user dihapus (→ yatim). Status `deleting` membuat `reserve_upload` ditolak (`account_not_active`, uji T11f), dan `claim_inactive_anonymous_users` juga **mencabut `auth.sessions`** sehingga refresh token tak berlaku. Hanya JWT yang masih hidup (≤ 1 jam) yang tersisa — risiko diterima karena user itu tak aktif ≥ 7 hari.

**Mengapa jeda 15 menit untuk lagu:** keputusan spec #8 — lagu yang sedang diputar saat kedaluwarsa dibiarkan selesai. Satu lagu (≤ 10 MB) tak mungkin diputar lebih dari beberapa menit, jadi menunda penghapusan fisik 15 menit menjamin stream tak terputus. RLS tetap membuat lagu **tak terbaca** sejak `expires_at`, dan signed URL baru tak diterbitkan.

### 8.4 Edge Function `cleanup` (kerangka)

```ts
// supabase/functions/cleanup/index.ts (Deno)
import { createClient } from 'npm:@supabase/supabase-js@2';
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } });
const GRACE_MIN = 15;

Deno.serve(async (req) => {
  if (!safeEqual(req.headers.get('authorization') ?? '', `Bearer ${Deno.env.get('CLEANUP_SECRET')}`))
    return new Response('forbidden', { status: 403 });
  const task = new URL(req.url).searchParams.get('task') ?? '';
  const { data: got } = await db.rpc('acquire_job_lease', { p_name: task, p_ttl: '10 minutes' });
  if (!got) return Response.json({ skipped: 'lease_held' });
  try {
    const result = task === 'songs' ? await purgeExpiredSongs()
                 : task === 'users' ? await purgeInactiveUsers()
                 : task === 'orphans' ? await purgeOrphans()
                 : (() => { throw new Error('task tidak dikenal'); })();
    await db.rpc('release_job_lease', { p_name: task, p_result: result });
    return Response.json(result);
  } catch (e) {
    await db.rpc('release_job_lease', { p_name: task, p_result: { error: String(e) } });
    return Response.json({ error: String(e) }, { status: 500 });
  }
});

async function purgeExpiredSongs() {
  const cutoff = new Date(Date.now() - GRACE_MIN * 60_000).toISOString();
  const { data: rows, error } = await db.from('songs').select('id,audio_path,cover_path')
    .eq('visibility', 'private').lte('expires_at', cutoff).order('expires_at').limit(200);
  if (error) throw error;
  if (!rows?.length) return { songs: 0 };
  // 1) FILE DULU
  await removeAll('user-audio', rows.map((r) => r.audio_path));
  await removeAll('user-covers', rows.flatMap((r) => (r.cover_path ? [r.cover_path] : [])));
  // 2) BARIS KEMUDIAN (cascade ke likes dan playlist_songs)
  const { error: delErr } = await db.from('songs').delete().in('id', rows.map((r) => r.id));
  if (delErr) throw delErr;
  return { songs: rows.length };
}

async function purgeInactiveUsers() {
  const { data: ids, error } = await db.rpc('claim_inactive_anonymous_users', { p_inactive: '7 days', p_limit: 50 });
  if (error) throw error;
  let deleted = 0; const failed: string[] = [];
  for (const uid of ids ?? []) {
    try {
      for (const bucket of ['user-audio', 'user-covers']) await purgePrefix(bucket, uid);   // 1) FILE DULU
      const { error: e } = await db.auth.admin.deleteUser(uid);                              // 2) USER + CASCADE
      if (e) throw e;
      deleted++;
    } catch (e) { failed.push(uid); console.error('purge user gagal', uid, e); }             // tombstone tetap
  }
  return { claimed: ids?.length ?? 0, deleted, failed: failed.length };
}

async function purgePrefix(bucket: string, uid: string) {
  for (let i = 0; i < 20; i++) {                         // batas aman agar tak berputar tanpa akhir
    const { data, error } = await db.storage.from(bucket).list(uid, { limit: 1000 });
    if (error) throw error;
    if (!data?.length) return;
    const { error: rmErr } = await db.storage.from(bucket).remove(data.map((o) => `${uid}/${o.name}`));
    if (rmErr) throw rmErr;
  }
  throw new Error(`prefix ${uid} tidak kosong setelah 20 putaran`);
}

async function purgeOrphans() {
  const { data, error } = await db.rpc('list_orphan_objects', { p_min_age: '1 day', p_limit: 500 });
  if (error) throw error;
  for (const bucket of ['user-audio', 'user-covers'])
    await removeAll(bucket, (data ?? []).filter((o: any) => o.bucket === bucket).map((o: any) => o.object_name));
  return { orphans: data?.length ?? 0 };
}

async function removeAll(bucket: string, paths: string[]) {
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await db.storage.from(bucket).remove(paths.slice(i, i + 100));
    if (error) throw error;                              // JANGAN lanjut ke penghapusan baris
  }
}
```

### 8.5 Pemulihan: jika proses mati di tengah jalan

| Mati setelah… | Keadaan | Pemulihan |
|---|---|---|
| Lease diambil, belum apa-apa | Lease kedaluwarsa sendiri (TTL 10 menit) | Jalankan berikutnya |
| File dihapus, baris belum | Baris tersisa tanpa file; sudah tak terbaca (kedaluwarsa) | Jalankan berikutnya: `remove` pada file yang tak ada tidak error → baris dihapus |
| Sebagian batch file dihapus lalu error | Baris batch **tidak** dihapus | Dicoba lagi; baris tetap berfungsi sebagai daftar tugas |
| Tombstone dipasang, file dihapus, `deleteUser` gagal | `profiles.status = 'deleting'` | `claim_…` mengembalikan lagi user berstatus `deleting` → coba lagi besok |
| `deleteUser` sukses | Cascade atomik dalam satu transaksi DB | Selesai |

Hasil terakhir tiap tugas tersimpan di `job_leases.last_result`. Pantau kolom `failed` pada tugas `users`; nilai > 0 berhari-hari artinya ada user yang macet di `deleting`.

### 8.6 Penjadwalan

`0005_cron.sql` (Lampiran A) menjadwalkan tiga job dan memanggil fungsi dengan `Authorization: Bearer <cleanup_secret>` yang diambil dari Vault. Fungsi dideploy dengan `--no-verify-jwt` karena memakai rahasia sendiri.

---

## 9. (d) Trigger pembuatan `profiles` saat sign-in anonim

```mermaid
sequenceDiagram
  autonumber
  participant B as Browser
  participant T as Turnstile
  participant A as Supabase Auth
  participant D as Postgres
  B->>T: render widget tak terlihat
  T-->>B: captchaToken
  B->>A: signInAnonymously dengan captchaToken
  A->>A: verifikasi token ke Turnstile
  A->>D: INSERT auth.users (is_anonymous = true)
  D->>D: trigger on_auth_user_created: INSERT profiles
  A-->>B: sesi (JWT + refresh token) disimpan di cookie
  B->>B: redirect ke beranda
```

```sql
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end $$;
```

```sql
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
```

Catatan desain:

- **Mengapa `auth.users`:** sign-in anonim Supabase membuat baris `auth.users` biasa dengan `is_anonymous = true`; trigger `AFTER INSERT` di tabel itu otomatis berlaku untuk anonim, e-mail, dan admin.
- **Harus sangat sederhana.** Kegagalan trigger ini menggagalkan sign-in. Karena itu hanya satu `INSERT … ON CONFLICT DO NOTHING`; semua nilai lain dari `DEFAULT` (`status = 'active'`, `last_seen_at = now()`), sehingga **user baru langsung punya `last_seen_at`** (F18).
- **Self-heal:** `touch_last_seen()` meng-upsert profil, dan trigger kuota membuat profil bila belum ada. Jadi user yang dibuat sebelum trigger ada (atau bila trigger pernah dinonaktifkan) tidak macet. Untuk migrasi pada proyek yang sudah berjalan, jalankan satu kali `insert into profiles select id from auth.users on conflict do nothing`.
- **Upgrade ke e-mail (F17):** `updateUser({ email })` mempertahankan `id`, jadi profil, like, dan playlist tetap utuh; `claim_inactive_anonymous_users` menyaring `auth.users.is_anonymous`, sehingga akun yang sudah di-upgrade tak pernah terpilih.

### 9.1 `last_seen_at` maksimal 1× per jam

```sql
create or replace function public.touch_last_seen()
returns void language sql security definer set search_path = '' as $$
  insert into public.profiles as p (user_id) values ((select auth.uid()))
  on conflict (user_id) do update set last_seen_at = now()
  where p.status = 'active' and p.last_seen_at < now() - interval '1 hour';
$$;
```

Pembatasan 1 jam ada **di SQL** (klausa `WHERE` pada `DO UPDATE`); bila belum lewat 1 jam, tidak ada baris yang ditulis sama sekali. Klien memanggilnya dari efek di layout `(app)` saat mount dan saat tab kembali terlihat, dengan penjaga `localStorage` tambahan agar tak memanggil RPC tanpa perlu. Setelah status `deleting`, pembaruan diabaikan.

---

## 10. Pemutar global

```mermaid
sequenceDiagram
  autonumber
  participant U as Pengguna
  participant PB as PlayerBar
  participant Z as Zustand store
  participant S as Supabase Storage
  participant A as Audio singleton
  U->>Z: playList(daftar, indeks)
  Z->>Z: token++ lalu status loading
  alt lagu publik
    Z->>S: getPublicUrl (sinkron, tanpa jaringan)
  else lagu pribadi
    Z->>S: createSignedUrl 3600 dtk (RLS menolak bila kedaluwarsa)
  end
  S-->>Z: url
  Z->>Z: token masih sama? bila tidak, buang
  Z->>A: src = url lalu play()
  A-->>Z: event ended lalu next()
  Note over A,PB: pindah halaman hanya mengganti children, A dan Z tidak tersentuh
```

```ts
// lib/player/audio.ts — satu elemen audio, DI LUAR siklus render React
const g = globalThis as unknown as { __streamingAudio?: HTMLAudioElement };
export function getAudio(): HTMLAudioElement {
  if (!g.__streamingAudio) {
    const a = new Audio();          // tidak pernah masuk JSX/DOM, jadi tak ikut unmount
    a.preload = 'metadata';
    g.__streamingAudio = a;         // bertahan lewat Fast Refresh saat dev
  }
  return g.__streamingAudio;
}
```

```ts
// lib/player/store.ts
export const usePlayer = create<PlayerState>()((set, get) => ({
  queue: [], index: -1, status: 'idle', token: 0,
  async playList(tracks, start) { set({ queue: tracks }); await load(start); },
  async next() { const { index, queue } = get(); index + 1 < queue.length ? await load(index + 1) : stopAtEnd(); },
  async prev() { const a = getAudio(); a.currentTime > 3 ? (a.currentTime = 0) : await load(Math.max(0, get().index - 1)); },
  enqueue(t) { set((s) => ({ queue: [...s.queue, t] })); },
  toggle() { const a = getAudio(); a.paused ? void a.play().catch(() => set({ status: 'paused' })) : a.pause(); },
  reset() { getAudio().pause(); getAudio().removeAttribute('src'); set({ queue: [], index: -1, status: 'idle' }); }, // dipakai saat Keluar
}));

async function load(i: number) {
  const { queue, token } = usePlayer.getState();
  const t = queue[i]; if (!t) return;
  const mine = token + 1;
  usePlayer.setState({ token: mine, index: i, status: 'loading' });
  const url = await resolveUrl(t).catch(() => null);
  if (usePlayer.getState().token !== mine) return;   // klik lain mendahului: cegah balapan "Berikutnya" cepat
  if (!url) return skipBroken(i);                    // toast lalu lompat (F2: file gagal dimuat atau lagu kedaluwarsa)
  const a = getAudio(); a.src = url;
  try { await a.play(); usePlayer.setState({ status: 'playing' }); }
  catch { usePlayer.setState({ status: 'paused' }); } // autoplay ditolak: kembali ke jeda tanpa error
}
```

Catatan:

- **Progres dipisah** (`useProgress = create(() => ({ time: 0, duration: 0 }))`) dan diperbarui dari event `timeupdate`, agar daftar lagu dan antrean tidak ter-render ulang empat kali per detik.
- **Satu elemen audio** memenuhi "tidak ada dua audio berbunyi" (F2) secara struktural, dan membantu Safari/iOS: setelah elemen "dibuka" oleh gestur pertama, pergantian `src` berikutnya (auto-advance) diizinkan.
- `initPlayer()` (dipanggil sekali oleh `<PlayerBoot/>`) memasang listener `ended`, `error`, `timeupdate`, `play`, `pause`, dengan penanda agar tak terpasang ganda.
- **URL ditandatangani dibuat saat lagu akan diputar** dan di-*cache* di memori ≤ 50 menit (keputusan spec #6: berlaku 1 jam). Lagu pribadi yang kedaluwarsa gagal di `createSignedUrl` (RLS) → dilewati, sedangkan lagu yang sudah berjalan dibiarkan selesai (keputusan #8).
- **Pitfall:** navigasi memakai `next/link`/`router.push`; jangan `window.location`. Refresh penuh sengaja mereset pemutar (memulihkan posisi = F13, P1).
- **Risiko Safari:** `play()` setelah `await createSignedUrl` mungkin kehilangan *user activation* pada putar pertama lagu pribadi. Lagu publik tidak terpengaruh (URL sinkron). Diverifikasi di *spike* S4.

---

## 11. Pengambilan data, pencarian, dan rute

**Pola:** Server Components melakukan query langsung ke Supabase dengan JWT user (RLS yang menyaring), tanpa lapisan API buatan sendiri. Mutasi sederhana (like, playlist) dilakukan dari klien dengan supabase-js (RLS); mutasi yang butuh aturan server memakai RPC. Hanya dua Route Handler: `finalize` dan hapus lagu. Tanpa Realtime di MVP: setelah `finalize` klien memanggil `router.refresh()` / pindah ke `/library`.

| Rute | Render | Data |
|---|---|---|
| `/masuk` | client (Turnstile) | sign-in anonim |
| `/` | RSC | lagu publik terbaru, album, artis |
| `/album/[id]`, `/artis/[id]` | RSC | join `songs`+`albums`+`artists` (publik) |
| `/cari?q=` | RSC + input *debounce* | RPC `search_all` |
| `/library` | RSC | lagu pribadi sendiri; slot `n/3` dan sisa waktu dari `expires_at` |
| `/disukai` | RSC | `likes` join `songs` (ter-filter RLS) |
| `/playlist/[id]` | RSC | `playlists` + `playlist_songs` join `songs`; 404 bila bukan milik sendiri (RLS menghasilkan nol baris) |
| `/unggah` | client | `reserve_upload` → TUS → `finalize` |

- **Like:** `upsert(..., { onConflict: 'user_id,song_id', ignoreDuplicates: true })` untuk klik berulang; toggle *optimistic* dengan rollback. ID lagu yang disukai dimuat sekali di layout dan disimpan di Zustand agar ikon sinkron di semua baris dan di bar pemutar.
- **Playlist:** pelanggaran PK (`23505`) dipetakan menjadi "Sudah ada di playlist".
- **Cover:** publik lewat `getPublicUrl`; pribadi lewat `createSignedUrls` dalam satu panggilan per halaman.
- **Pencarian:** RPC `search_all` (Lampiran A) mengabaikan query kosong, memotong ke 100 karakter, meng-*escape* `%`, `_`, `\`, dan mengirim input sebagai parameter. Karena SECURITY INVOKER, hasil otomatis hanya lagu publik + lagu pribadi **milik sendiri** (uji T9f/T9g).
- **Sesi:** `getUser()`/`getClaims()` di middleware memverifikasi JWT; halaman pribadi tidak di-*cache* (bergantung pada cookie).

---

## 12. Pengujian

| Area | Cara | Status |
|---|---|---|
| RLS, policy Storage, trigger, RPC, tombstone, orphan, lease, cascade, batas playlist/penyimpanan, `ping` | `supabase/tests/sql/` (82 uji) via `supabase/tests/mock/run-mock.sh` di PostgreSQL 18 dengan **tiruan** skema Supabase | **Lulus** (lokal, tiruan) |
| Konkurensi: kuota lagu, 20 playlist, penyimpanan global | `supabase/tests/concurrency.sh`; kontrol tanpa kunci membuktikan sensitivitas | **Lulus** (3/3/3, 20, 1 vs kontrol 10/10/10, 30, 2) |
| Validator MP3 | `node lib/audio/mp3.test.ts`: CBR, ID3, Xing, ID3 besar (jendela kedua), WAV, byte acak, Layer II, 1 frame di tengah sampah, ukuran | **Lulus** |
| **Semua uji SQL dan konkurensi di Supabase CLI lokal** (`supabase start`, DB di port 54322) | Jalankan `psql -f helpers.sql -f rls_and_limits.test.sql` dan `PGURL=… concurrency.sh` terhadap migrasi asli, **tanpa tiruan**; lalu port ke pgTAP (`supabase test db`) untuk CI | **Wajib di Fase 1 (spike S6)** |
| `finalize` (integrasi) | Terhadap Supabase lokal: MP3 sah, `.exe` berekstensi `.mp3`, ID3 200 KB, terpotong, > 10 MB, bukan reservasi sendiri, dua kali dipanggil | Belum |
| Job pembersih | Fixture waktu dimajukan (> 15 menit, > 24 jam, > 7 hari) + simulasi kegagalan Storage di tengah | Belum |
| Navigasi tak memutus audio | Playwright: `audio.currentTime` naik monoton melintasi semua rute internal | Belum |
| Isolasi dua pengunjung | Playwright dua konteks browser: A menyukai/membuat playlist, B tidak melihatnya | Belum |
| Anonim + CAPTCHA | E2E dengan kunci uji Turnstile; permintaan tanpa token ditolak server | Belum |

---

## 13. Deploy, konfigurasi, dan operasi

### 13.1 Konfigurasi dan deploy

| Variabel | Dipakai oleh | Catatan |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | klien, middleware, RSC | boleh publik |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | klien | boleh publik |
| `SUPABASE_SERVICE_ROLE_KEY` | Route Handler, seed | **rahasia**, hanya server/CI |
| `CLEANUP_SECRET` | Edge Function + Vault | rahasia |

Daftar periksa Supabase: sign-in anonim **aktif**; CAPTCHA **aktif** (Turnstile, widget tipe *Invisible*, secret di dashboard Auth); batas laju sign-in dicek; ekstensi `pg_trgm`, `pg_cron`, `pg_net`; secret `cleanup_secret` di Vault; Edge Function `cleanup` dideploy `--no-verify-jwt`; bucket dibuat lewat migrasi 0004; migrasi lewat `supabase db push` di CI. Daftarkan secret GitHub `SUPABASE_URL` dan `SUPABASE_ANON_KEY` untuk keep-alive (§13.2). Seed dijalankan manual/CI dengan service role dan memakai `seed_key` agar idempoten.

**Seed (F9):** aturan format katalog (MP3/M4A, ≤ 15 MB, disarankan 128–192 kbps) diperiksa skrip sebelum unggah (MP3 dengan `mp3.ts`, M4A dengan pemeriksaan kotak `ftyp` dan `music-metadata` untuk durasi); `catalog.json` mewajibkan `source` dan `license`, menolak lisensi NC, dan skrip menghasilkan tabel sumber/lisensi untuk README.

### 13.2 Keep-alive: mencegah proyek Free di-pause (F20)

**Kebijakan yang berlaku (dicek 2026-11-05 di dokumentasi Supabase):** proyek Free Plan yang "menunjukkan aktivitas rendah selama 7 hari" di-pause; "beberapa permintaan ke database setiap hari" cukup untuk mencegahnya; ada email peringatan sekitar seminggu sebelumnya; proyek yang di-pause dapat dipulihkan hingga 1 tahun; paket berbayar tidak di-pause. Batas Free yang sama (halaman billing): database 500 MB, Storage 1 GB, egress 5 GB, Edge Function 500.000 invokasi. Sumber: <https://supabase.com/docs/guides/platform/free-project-pausing> dan <https://supabase.com/docs/guides/platform/billing-on-supabase>.

**Keputusan:** kebijakan itu berlaku, jadi ditambahkan keep-alive harian. Job `pg_cron` (F18) berjalan *di dalam* database dan dokumentasi menyebut "user database activity", jadi **tidak diandalkan** sebagai pencegah pause. Keep-alive berupa permintaan API dari luar yang benar-benar membaca tabel:

- Endpoint: `POST {SUPABASE_URL}/rest/v1/rpc/ping` (PostgREST) memanggil fungsi `public.ping()` (Lampiran A, 0002): hanya-baca, membaca tabel `artists`, mengembalikan `{ "ok": true, "ts": … }`. Boleh dipanggil role `anon`, dan itu **satu-satunya** objek yang boleh dipanggil `anon`.
- Pemanggil: GitHub Actions terjadwal harian; tidak memakai service role.

```yaml
# .github/workflows/keepalive.yml  (rancangan; disalin ke repo di Fase 1, belum ada di repo)
name: supabase-keepalive
on:
  schedule: [{ cron: '17 6 * * *' }]     # harian 06:17 UTC
  workflow_dispatch:
permissions: {}
jobs:
  ping:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - name: Panggil ping()
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
        run: |
          if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
            echo "::notice::Secret belum diatur, keep-alive dilewati."; exit 0
          fi
          curl -fsS --retry 3 --retry-delay 5 --retry-all-errors -X POST \
            "$SUPABASE_URL/rest/v1/rpc/ping" \
            -H "apikey: $SUPABASE_ANON_KEY" -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
            -H "Content-Type: application/json" -d '{}' | tee /dev/stderr | grep -q '"ok": *true'
```

Perilaku: non-2xx atau respons tanpa `"ok": true` membuat langkah gagal (setelah 3 percobaan), sehingga GitHub mengirim notifikasi. Bila secret belum diatur, workflow lewat tanpa error.

**Batasan yang perlu diketahui**
- GitHub dapat menonaktifkan workflow terjadwal pada repositori **publik** yang tidak aktif lama (setahu saya setelah 60 hari tanpa aktivitas repositori; **cek ulang di dokumentasi GitHub**). Mitigasi: commit berkala, atau jalankan `workflow_dispatch` manual bila ada email peringatan pause dari Supabase.
- Belum terverifikasi bahwa panggilan RPC via anon key terhitung sebagai "aktivitas database pengguna". Verifikasi di Fase 5: pantau beberapa minggu tanpa email peringatan pause (pertanyaan terbuka no. 1, §14.4).
- Anggaran Storage 1 GB: lagu pribadi ≤ 500 MB (batas global, §7.4) + katalog seed (≥ 15 lagu × ≤ 15 MB ≈ ≤ 225 MB dalam kasus terburuk, jauh lebih kecil pada 128–192 kbps) + cover, sehingga di bawah 1 GB.

---

## 14. Risiko, spike, dan perubahan terhadap spec

### 14.1 Spike yang harus dijalankan di Fase 1 (sebelum membangun di atasnya)

S6 adalah syarat keluar Fase 1: tanpa itu, klaim "terverifikasi" di dokumen ini hanya berlaku untuk Postgres tiruan.

| # | Pertanyaan | Bila ternyata tidak |
|---|---|---|
| S1 | Apakah Storage menjawab `Range` pada signed URL dengan `206` + `Content-Range`? | Fallback: baca stream dan batalkan setelah 64 KiB (kode sudah menangani `200`) |
| S2 | Apakah TUS resumable lolos policy INSERT berbasis `owns_pending_object` (pada pembuatan *dan* penyelesaian upload)? | Pakai upload standar dengan `XMLHttpRequest` untuk progres |
| S3 | Apakah `DELETE FROM auth.sessions` dari fungsi SECURITY DEFINER diizinkan, dan `auth.admin.deleteUser` men-cascade seperti diharapkan? | Cabut sesi lewat Auth Admin API; cascade dipastikan lewat uji |
| S4 | Apakah putar pertama lagu pribadi di Safari/iOS lolos setelah `await createSignedUrl`? | Pra-ambil URL saat daftar tampil/di-hover |
| S5 | Apakah trigger pada `auth.users` aktif untuk `signInAnonymously` di proyek nyata dan tidak mengganggu sign-in? | Pindah ke pembuatan profil lewat RPC saat layout pertama kali dimuat (self-heal sudah ada) |
| **S6** | **Jalankan ulang SEMUA uji SQL dan konkurensi di Supabase CLI lokal (`supabase start`), bukan Postgres tiruan.** Sasaran: migrasi 0001–0004 diterapkan tanpa error; `helpers.sql` + `rls_and_limits.test.sql` = 0 FAIL dan 0 ERROR; `PGURL=postgresql://postgres:postgres@127.0.0.1:54322/postgres supabase/tests/concurrency.sh` = SEMUA LULUS. Selesai bila hasilnya dicatat di dokumen ini menggantikan status "tiruan" di §12. | Perbaiki perbedaan, bukan menyesuaikan uji agar lulus. Perbedaan yang diperkirakan (belum dikonfirmasi): kolom wajib pada `auth.users`/`auth.sessions` untuk `INSERT` tes; trigger bawaan pada `storage.objects`; cara `auth.uid()` membaca klaim JWT (helper mengatur `request.jwt.claim.sub` dan `request.jwt.claims`); versi Postgres berbeda dari 18 |

### 14.2 Risiko

| Risiko | Mitigasi |
|---|---|
| **Proyek Free di-pause** bila aktivitas database rendah 7 hari (dokumentasi Supabase, dicek 2026-11-05) | Keep-alive harian lewat GitHub Actions (§13.2); pantau email peringatan; proyek dapat dipulihkan hingga 1 tahun |
| Workflow terjadwal GitHub dapat dinonaktifkan pada repo publik yang lama tak aktif | Commit berkala atau jalankan manual; tercatat di §13.2 |
| Kuota Free (database 500 MB, Storage 1 GB, egress 5 GB, Edge Function 500.000 invokasi): tiap putar ≈ ukuran file, jadi egress 5 GB hanya cukup untuk sekitar 1.000 putaran per bulan pada file 5 MB | Bitrate 128–192 kbps, `preload='metadata'`, `Cache-Control` panjang pada bucket publik, batas upload dan penyimpanan global 500 MB; cek ulang angka saat rilis |
| Banjir sign-in anonim menambah baris `auth.users` | CAPTCHA, rate limit Auth, pembersihan 7 hari |
| Fungsi/trigger menyentuh skema `auth`/`storage` yang dikelola Supabase | Terisolasi di migrasi; dicakup S3/S5; uji regresi saat upgrade |
| File lagu pribadi masih ada di Storage hingga ±75 menit setelah kedaluwarsa (15 menit jeda + siklus per jam) | Tak terbaca lewat RLS; hanya signed URL yang sudah terbit (≤ 1 jam) yang bisa membukanya |
| Job gagal diam-diam | `job_leases.last_result` + pantau `failed`; tambah notifikasi bila perlu |
| Polyglot MP3 | Diterima untuk MVP (§6.3) |

### 14.3 Perubahan terhadap spec (disetujui pemilik proyek; tercatat di spec §10, keputusan 12–15)

1. **Status `pending` dan TTL reservasi 15 menit** (kolom `songs.status`) — diperlukan agar validasi sisi server mungkin dan tak ada file yatim. Spec F5 tidak menyebutnya.
2. **Jeda 15 menit sebelum penghapusan fisik** lagu kedaluwarsa — dari keputusan #8; lagu tetap tak terbaca sejak `expires_at`.
3. **Hapus manual lagu:** slot bebas dan lagu tak terbaca **seketika**; file dihapus **segera** oleh Route Handler, dengan job per jam sebagai cadangan. (Spec F5 mensyaratkan file ikut terhapus; ini memenuhinya.)
4. **Penjadwal:** `pg_cron` + Edge Function di Supabase, bukan Vercel Cron. Spec F18 hanya menulis "mis. pg_cron atau scheduled function".
5. **Kolom/tabel baru:** `songs.seed_key`, `profiles.status`, `job_leases`.
6. **M4A hanya untuk katalog publik** (bucket `audio`); bucket `user-audio` hanya `audio/mpeg`.
7. **Batas tambahan, disetujui dengan angka:** penyimpanan pribadi global **500 MB** (upload ditutup sementara bila penuh), **20 playlist** per user, **200 lagu** per playlist, semuanya di trigger (§7.4).
8. **Keep-alive harian** karena kebijakan pause proyek Free berlaku (§13.2).

Item 5 dan 6 saya perlakukan sebagai konsekuensi langsung dari item 1 dan 4 serta keputusan "MP3 saja untuk pengunjung"; koreksi bila tidak demikian.

### 14.4 Pertanyaan terbuka

| # | Pertanyaan | Pemilik | Sifat |
|---|---|---|---|
| 1 | Apakah panggilan RPC `ping()` lewat anon key terhitung sebagai aktivitas database yang mencegah pause? (dokumentasi menyebut "user database activity") | Engineering | Non-blocking; diverifikasi di Fase 5 dengan memantau email peringatan |
| 2 | Apakah ada batas Free untuk `pg_cron`/`pg_net` yang relevan? (batas Edge Function 500.000 invokasi sudah dikonfirmasi) | Engineering | Non-blocking |
| 3 | Bila katalog seed membesar, apakah batas pribadi 500 MB perlu diturunkan agar total tetap di bawah 1 GB? | Pemilik proyek | Non-blocking |

Pertanyaan lama tentang batas penyimpanan global, batas playlist, dan konfirmasi batas free tier sudah dijawab (§7.4, §13.2).

---

## 15. Pemetaan ke fase spec

| Fase (spec §11) | Pekerjaan arsitektur |
|---|---|
| 1 Fondasi | Migrasi 0001–0004; konfigurasi Auth (anonim + Turnstile); trigger profiles; `mp3.ts`; skrip seed; **jalankan ulang semua uji SQL dan konkurensi di `supabase start` (S6)** lalu port ke pgTAP; workflow keep-alive (F20); **spike S1–S5** |
| 2 Inti mendengar | Layout `(app)`, middleware, halaman beranda/album/artis, pemutar Zustand + audio singleton |
| 3 Interaksi | RPC `search_all`, like, playlist |
| 4 Konten | `/unggah` (reserve → TUS → finalize), Route Handler `finalize` dan hapus lagu, Edge Function `cleanup`, `0005_cron.sql` |
| 5 Poles dan rilis | E2E Playwright, Lighthouse, README (tabel sumber/lisensi seed), deploy |

---

## Lampiran A — Migrasi SQL

Seluruh berkas 0001–0004 sudah dijalankan berurutan di PostgreSQL 18 (dengan tiruan `auth`/`storage`); 0005 belum diuji.

### `0001_schema`

<details>
<summary>Tampilkan SQL</summary>

```sql
-- 0001_schema.sql — tabel, constraint, indeks
create extension if not exists pg_trgm with schema extensions;

-- Satu baris per user (anonim maupun terdaftar). Dibuat oleh trigger (lihat 0002).
create table public.profiles (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  status       text not null default 'active' check (status in ('active', 'deleting')),
  last_seen_at timestamptz not null default now(),
  created_at   timestamptz not null default now()
);
create index profiles_inactive_idx on public.profiles (last_seen_at) where status = 'active';

create table public.artists (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(btrim(name)) between 1 and 120),
  name_key   text generated always as (lower(btrim(name))) stored,
  image_path text,
  created_at timestamptz not null default now(),
  unique (name_key)
);

create table public.albums (
  id         uuid primary key default gen_random_uuid(),
  artist_id  uuid not null references public.artists (id) on delete cascade,
  title      text not null check (char_length(btrim(title)) between 1 and 120),
  title_key  text generated always as (lower(btrim(title))) stored,
  cover_path text,
  year       smallint check (year between 1900 and 2100),
  created_at timestamptz not null default now(),
  unique (artist_id, title_key)
);

-- Satu tabel untuk lagu katalog (public) dan lagu pribadi (private).
create table public.songs (
  id          uuid primary key default gen_random_uuid(),
  visibility  text not null check (visibility in ('public', 'private')),
  status      text not null default 'ready' check (status in ('pending', 'ready')),
  owner_id    uuid references auth.users (id) on delete cascade,
  seed_key    text unique,                       -- kunci idempotensi skrip seed
  title       text not null check (char_length(btrim(title)) between 1 and 120),
  artist_id   uuid references public.artists (id) on delete restrict,
  album_id    uuid references public.albums (id) on delete set null,
  track_no    smallint,
  artist_name text check (char_length(btrim(artist_name)) between 1 and 120),
  album_name  text check (char_length(album_name) <= 120),
  audio_path  text not null,                     -- relatif terhadap bucket
  cover_path  text,
  duration_sec integer check (duration_sec between 1 and 7200),
  size_bytes  bigint check (size_bytes > 0),
  expires_at  timestamptz,
  created_at  timestamptz not null default now(),
  constraint songs_shape check (
    (visibility = 'public' and status = 'ready' and owner_id is null and expires_at is null
       and artist_id is not null and duration_sec is not null)
    or
    (visibility = 'private' and owner_id is not null and expires_at is not null
       and artist_name is not null and artist_id is null and album_id is null
       and (status = 'pending' or duration_sec is not null))
  )
);
create unique index songs_audio_path_uq     on public.songs (audio_path);
create index songs_public_recent_idx        on public.songs (created_at desc) where visibility = 'public';
create index songs_artist_idx               on public.songs (artist_id) where artist_id is not null;
create index songs_album_idx                on public.songs (album_id, track_no) where album_id is not null;
create index songs_owner_live_idx           on public.songs (owner_id, expires_at) where visibility = 'private';
create index songs_expiry_idx               on public.songs (expires_at) where visibility = 'private';
create index songs_title_trgm               on public.songs using gin (title extensions.gin_trgm_ops);
create index artists_name_trgm              on public.artists using gin (name extensions.gin_trgm_ops);
create index albums_title_trgm              on public.albums using gin (title extensions.gin_trgm_ops);

create table public.likes (
  user_id    uuid not null references auth.users (id) on delete cascade,
  song_id    uuid not null references public.songs (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, song_id)
);
create index likes_song_idx on public.likes (song_id);

create table public.playlists (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null check (name = btrim(name) and char_length(name) between 1 and 60),
  description text check (char_length(description) <= 300),
  created_at  timestamptz not null default now()
);
create index playlists_user_idx on public.playlists (user_id, created_at desc);

create table public.playlist_songs (
  playlist_id uuid not null references public.playlists (id) on delete cascade,
  song_id     uuid not null references public.songs (id) on delete cascade,
  position    bigint generated always as identity,
  added_at    timestamptz not null default now(),
  primary key (playlist_id, song_id)
);
create index playlist_songs_order_idx on public.playlist_songs (playlist_id, position);
create index playlist_songs_song_idx  on public.playlist_songs (song_id);

-- Batas global yang bisa diubah pemilik proyek lewat SQL (singleton: tepat satu baris).
create table public.app_limits (
  id                        boolean primary key default true check (id),
  private_storage_cap_bytes bigint not null default 524288000 check (private_storage_cap_bytes > 0)  -- 500 MB
);
insert into public.app_limits default values;

-- Lease agar job pembersih tidak berjalan tumpang tindih; juga log hasil terakhir.
create table public.job_leases (
  name         text primary key,
  locked_until timestamptz not null default 'epoch',
  last_run_at  timestamptz,
  last_result  jsonb
);
```

</details>

### `0002_functions`

<details>
<summary>Tampilkan SQL</summary>

```sql
-- 0002_functions.sql — trigger, RPC, fungsi pendukung job
-- Semua fungsi SECURITY DEFINER memakai search_path kosong, jadi semua objek ditulis dengan nama skema.

-- (d) Baris profiles dibuat otomatis setiap ada baris baru di auth.users.
-- Sign-in anonim Supabase juga meng-INSERT ke auth.users (is_anonymous = true), jadi trigger ini menangkapnya.
-- Dibuat sesederhana mungkin: trigger yang melempar error akan menggagalkan sign-in.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- last_seen_at: maksimal 1x per jam, dibatasi DI SQL (klien yang nakal pun tidak bisa menulis lebih sering).
-- Sekaligus "self-heal" bila baris profiles belum ada.
create or replace function public.touch_last_seen()
returns void language sql security definer set search_path = '' as $$
  insert into public.profiles as p (user_id) values ((select auth.uid()))
  on conflict (user_id) do update set last_seen_at = now()
  where p.status = 'active' and p.last_seen_at < now() - interval '1 hour';
$$;

-- (b) Kuota 3 lagu aktif per akun. Berlaku untuk SETIAP INSERT lagu pribadi, dari jalur mana pun.
-- Kunci: SELECT ... FOR UPDATE pada baris profiles milik user. Transaksi kedua untuk user yang sama
-- menunggu sampai transaksi pertama commit, lalu menghitung dengan snapshot baru (READ COMMITTED),
-- sehingga melihat baris yang baru di-insert transaksi pertama.
create or replace function public.enforce_private_song_quota()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_active integer;
  v_used   bigint;
  v_cap    bigint;
begin
  insert into public.profiles (user_id) values (new.owner_id) on conflict (user_id) do nothing;

  perform 1 from public.profiles
   where user_id = new.owner_id and status = 'active'
   for update;
  if not found then
    raise exception 'account_not_active' using errcode = 'P0001';
  end if;

  select count(*) into v_active
    from public.songs
   where owner_id = new.owner_id and visibility = 'private' and expires_at > now();

  if v_active >= 3 then
    raise exception 'quota_exceeded' using errcode = 'P0001', hint = 'maks 3 lagu pribadi aktif';
  end if;

  -- Batas penyimpanan pribadi GLOBAL. Kunci kedua (baris singleton) diambil SETELAH kunci profil; urutan
  -- profil -> global selalu sama, jadi tidak ada deadlock. Semua baris lagu pribadi yang masih ada dihitung,
  -- termasuk yang sudah kedaluwarsa tetapi belum dipurge (file fisiknya masih ada). Reservasi tanpa ukuran
  -- (pending) dihitung 10 MiB, batas maksimum per file. Hanya byte audio; cover (maks 2 MiB) tidak dihitung.
  select private_storage_cap_bytes into v_cap from public.app_limits for update;
  select coalesce(sum(coalesce(size_bytes, 10485760)), 0) into v_used
    from public.songs where visibility = 'private';
  if v_used + 10485760 > v_cap then
    raise exception 'storage_full' using errcode = 'P0001', hint = 'upload pengunjung ditutup sementara';
  end if;
  return new;
end $$;

create trigger songs_private_quota
before insert on public.songs
for each row when (new.visibility = 'private')
execute function public.enforce_private_song_quota();

-- Status untuk UI: slot terpakai dan apakah upload sedang dibuka (batas global belum penuh).
create or replace function public.get_upload_status()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'active', (select count(*) from public.songs
                where owner_id = (select auth.uid()) and visibility = 'private' and expires_at > now()),
    'max', 3,
    'storage_open', (select coalesce(sum(coalesce(size_bytes, 10485760)), 0) + 10485760
                            <= (select private_storage_cap_bytes from public.app_limits)
                       from public.songs where visibility = 'private'));
$$;

-- Batas playlist: maks 20 per user dan 200 lagu per playlist. Pola kuncinya sama dengan kuota lagu:
-- kunci baris induk (profil / playlist) sebelum menghitung. Bila baris bukan milik pemanggil, trigger
-- tidak mengunci apa pun dan membiarkan RLS yang menolak (agar user tak bisa mengunci baris orang lain).
create or replace function public.enforce_playlist_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_n integer;
begin
  if new.user_id is distinct from (select auth.uid()) then return new; end if;
  insert into public.profiles (user_id) values (new.user_id) on conflict (user_id) do nothing;
  perform 1 from public.profiles where user_id = new.user_id for update;
  select count(*) into v_n from public.playlists where user_id = new.user_id;
  if v_n >= 20 then
    raise exception 'playlist_limit' using errcode = 'P0001', hint = 'maks 20 playlist';
  end if;
  return new;
end $$;

create trigger playlists_limit
before insert on public.playlists
for each row execute function public.enforce_playlist_limit();

create or replace function public.enforce_playlist_song_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_n integer;
begin
  perform 1 from public.playlists
   where id = new.playlist_id and user_id = (select auth.uid()) for update;
  if not found then return new; end if;
  select count(*) into v_n from public.playlist_songs where playlist_id = new.playlist_id;
  if v_n >= 200 then
    raise exception 'playlist_song_limit' using errcode = 'P0001', hint = 'maks 200 lagu per playlist';
  end if;
  return new;
end $$;

create trigger playlist_songs_limit
before insert on public.playlist_songs
for each row execute function public.enforce_playlist_song_limit();

-- Keep-alive: dipanggil GitHub Actions tiap hari. Hanya-baca, tanpa data sensitif, tetapi benar-benar
-- menyentuh tabel sehingga terhitung sebagai aktivitas database (proyek Free di-pause bila aktivitas rendah 7 hari).
create or replace function public.ping()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('ok', (select count(*) >= 0 from public.artists), 'ts', now());
$$;

-- (a) Langkah 1 upload: memesan slot. Baris dibuat SEBELUM file ada (status 'pending', TTL 15 menit).
create or replace function public.reserve_upload(
  p_title text, p_artist_name text, p_album_name text default null, p_cover_ext text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := (select auth.uid());
  v_id    uuid := gen_random_uuid();
  v_audio text;
  v_cover text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_cover_ext is not null and p_cover_ext not in ('jpg', 'png', 'webp') then
    raise exception 'bad_cover_ext' using errcode = '22023';
  end if;

  v_audio := v_uid::text || '/' || v_id::text || '.mp3';
  v_cover := case when p_cover_ext is null then null
                  else v_uid::text || '/' || v_id::text || '.' || p_cover_ext end;

  insert into public.songs
    (id, visibility, status, owner_id, title, artist_name, album_name, audio_path, cover_path, expires_at)
  values
    (v_id, 'private', 'pending', v_uid, btrim(p_title), btrim(p_artist_name),
     nullif(btrim(coalesce(p_album_name, '')), ''), v_audio, v_cover, now() + interval '15 minutes');

  return jsonb_build_object('song_id', v_id, 'audio_path', v_audio, 'cover_path', v_cover);
end $$;

-- Batalkan reservasi / hapus lagu sendiri: langsung tak terlihat dan slot bebas (expires_at = now()).
-- File dan baris dibersihkan Route Handler (segera) atau job per jam (cadangan).
create or replace function public.expire_my_song(p_song_id uuid)
returns void language sql security definer set search_path = '' as $$
  update public.songs set expires_at = now()
   where id = p_song_id and owner_id = (select auth.uid()) and visibility = 'private';
$$;

-- Langkah 3 upload: hanya bisa dipanggil service role SETELAH server memverifikasi isi file.
create or replace function public.finalize_upload(
  p_song_id uuid, p_user_id uuid, p_duration_sec integer, p_size_bytes bigint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.songs
     set status = 'ready', duration_sec = p_duration_sec, size_bytes = p_size_bytes,
         expires_at = now() + interval '24 hours'
   where id = p_song_id and owner_id = p_user_id
     and visibility = 'private' and status = 'pending' and expires_at > now();
  if not found then
    if exists (select 1 from public.songs
                where id = p_song_id and owner_id = p_user_id and status = 'ready') then
      return;                                   -- idempoten
    end if;
    raise exception 'reservation_invalid' using errcode = 'P0002';
  end if;
end $$;

-- (c) Job F18, langkah 1 untuk user: "tombstone". Menandai user, mencabut sesinya, mengembalikan daftar id.
-- Kondisi tidak aktif dievaluasi ulang di dalam UPDATE yang sama (atomik); baris status 'deleting'
-- ikut dikembalikan lagi agar kegagalan hari sebelumnya dicoba ulang.
create or replace function public.claim_inactive_anonymous_users(
  p_inactive interval default interval '7 days', p_limit integer default 50)
returns setof uuid language plpgsql security definer set search_path = '' as $$
begin
  return query
  with picked as (
    select p.user_id
      from public.profiles p
      join auth.users u on u.id = p.user_id
     where u.is_anonymous
       and (p.status = 'deleting'
            or (p.status = 'active' and p.last_seen_at < now() - p_inactive))
     order by p.last_seen_at
     limit p_limit
       for update of p skip locked
  ), marked as (
    update public.profiles p set status = 'deleting'
      from picked where p.user_id = picked.user_id
    returning p.user_id
  ), revoked as (
    delete from auth.sessions s using marked where s.user_id = marked.user_id
    returning s.id
  )
  select marked.user_id from marked;
end $$;

-- Objek Storage tanpa baris songs (kasus tak terduga). Dibaca lewat SQL, TETAPI dihapus lewat Storage API.
create or replace function public.list_orphan_objects(
  p_min_age interval default interval '1 day', p_limit integer default 500)
returns table (bucket text, object_name text)
language sql stable security definer set search_path = '' as $$
  select o.bucket_id::text, o.name::text
    from storage.objects o
   where o.bucket_id in ('user-audio', 'user-covers')
     and o.created_at < now() - p_min_age
     and not exists (
       select 1 from public.songs s
        where (o.bucket_id = 'user-audio'  and s.audio_path = o.name)
           or (o.bucket_id = 'user-covers' and s.cover_path = o.name))
   limit p_limit;
$$;

create or replace function public.acquire_job_lease(p_name text, p_ttl interval)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_rows integer;
begin
  -- Bila lease masih dipegang, WHERE pada DO UPDATE bernilai false => 0 baris tersentuh.
  insert into public.job_leases as l (name, locked_until, last_run_at)
  values (p_name, now() + p_ttl, now())
  on conflict (name) do update
    set locked_until = now() + p_ttl, last_run_at = now()
    where l.locked_until < now();
  get diagnostics v_rows = row_count;
  return v_rows > 0;
end $$;

create or replace function public.release_job_lease(p_name text, p_result jsonb)
returns void language sql security definer set search_path = '' as $$
  update public.job_leases set locked_until = 'epoch', last_result = p_result where name = p_name;
$$;

-- Pencarian: SECURITY INVOKER, jadi RLS berlaku (lagu publik + lagu pribadi MILIK SENDIRI yang belum kedaluwarsa).
-- Input di-escape untuk ILIKE dan dikirim sebagai parameter, bukan digabung ke string SQL.
create or replace function public.search_all(p_q text, p_limit integer default 20)
returns jsonb language sql stable security invoker set search_path = '' as $$
  with q as (
    select '%' || replace(replace(replace(btrim(left(coalesce(p_q, ''), 100)), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pat,
           btrim(left(coalesce(p_q, ''), 100)) <> '' as ok
  )
  select jsonb_build_object(
    'songs', coalesce((
      select jsonb_agg(to_jsonb(x)) from (
        select s.id, s.title, s.visibility, s.audio_path, s.cover_path, s.duration_sec,
               coalesce(a.name, s.artist_name) as artist, coalesce(al.title, s.album_name) as album
          from public.songs s
          left join public.artists a  on a.id  = s.artist_id
          left join public.albums  al on al.id = s.album_id
          cross join q
         where q.ok and (s.title ilike q.pat or a.name ilike q.pat or al.title ilike q.pat
                         or s.artist_name ilike q.pat or s.album_name ilike q.pat)
         order by s.created_at desc limit least(p_limit, 50)) x), '[]'::jsonb),
    'albums', coalesce((
      select jsonb_agg(to_jsonb(x)) from (
        select al.id, al.title, al.cover_path, a.name as artist
          from public.albums al join public.artists a on a.id = al.artist_id
          cross join q
         where q.ok and (al.title ilike q.pat or a.name ilike q.pat)
         order by al.title limit least(p_limit, 50)) x), '[]'::jsonb),
    'artists', coalesce((
      select jsonb_agg(to_jsonb(x)) from (
        select a.id, a.name, a.image_path
          from public.artists a cross join q
         where q.ok and a.name ilike q.pat
         order by a.name limit least(p_limit, 50)) x), '[]'::jsonb)
  );
$$;

-- Hak eksekusi: default Postgres/Supabase memberi EXECUTE ke PUBLIC dan anon, jadi dicabut eksplisit.
revoke all on function public.handle_new_user()                                      from public, anon, authenticated;
revoke all on function public.enforce_private_song_quota()                           from public, anon, authenticated;
revoke all on function public.enforce_playlist_limit()                               from public, anon, authenticated;
revoke all on function public.enforce_playlist_song_limit()                          from public, anon, authenticated;
revoke all on function public.get_upload_status()                                    from public, anon;
revoke all on function public.ping()                                                 from public;
revoke all on function public.touch_last_seen()                                      from public, anon;
revoke all on function public.reserve_upload(text, text, text, text)                 from public, anon;
revoke all on function public.expire_my_song(uuid)                                   from public, anon;
revoke all on function public.search_all(text, integer)                              from public, anon;
revoke all on function public.finalize_upload(uuid, uuid, integer, bigint)           from public, anon, authenticated;
revoke all on function public.claim_inactive_anonymous_users(interval, integer)      from public, anon, authenticated;
revoke all on function public.list_orphan_objects(interval, integer)                 from public, anon, authenticated;
revoke all on function public.acquire_job_lease(text, interval)                      from public, anon, authenticated;
revoke all on function public.release_job_lease(text, jsonb)                         from public, anon, authenticated;

grant execute on function public.touch_last_seen()                              to authenticated;
grant execute on function public.get_upload_status()                            to authenticated;
grant execute on function public.ping()                                         to anon, authenticated;
grant execute on function public.reserve_upload(text, text, text, text)         to authenticated;
grant execute on function public.expire_my_song(uuid)                           to authenticated;
grant execute on function public.search_all(text, integer)                      to authenticated;
grant execute on function public.finalize_upload(uuid, uuid, integer, bigint)   to service_role;
grant execute on function public.claim_inactive_anonymous_users(interval, integer) to service_role;
grant execute on function public.list_orphan_objects(interval, integer)         to service_role;
grant execute on function public.acquire_job_lease(text, interval)              to service_role;
grant execute on function public.release_job_lease(text, jsonb)                 to service_role;
```

</details>

### `0003_rls`

<details>
<summary>Tampilkan SQL</summary>

```sql
-- 0003_rls.sql — RLS dan grant tabel
alter table public.profiles       enable row level security;
alter table public.artists        enable row level security;
alter table public.albums         enable row level security;
alter table public.songs          enable row level security;
alter table public.likes          enable row level security;
alter table public.playlists      enable row level security;
alter table public.playlist_songs enable row level security;
alter table public.job_leases     enable row level security;
alter table public.app_limits     enable row level security;

-- Default Supabase memberi hak luas ke anon/authenticated; cabut lalu beri minimum.
revoke all on all tables in schema public from anon, authenticated;
grant select                         on public.artists, public.albums, public.songs to authenticated;
grant select, insert, delete         on public.likes          to authenticated;
grant select, insert, update, delete on public.playlists      to authenticated;
grant select, insert, delete         on public.playlist_songs to authenticated;
-- profiles, job_leases, app_limits: tanpa grant dan tanpa policy untuk klien (hanya fungsi SECURITY DEFINER / service role).

-- Catatan: "authenticated" mencakup user ANONIM (JWT mereka ber-role authenticated, is_anonymous = true).
-- Role "anon" hanya untuk permintaan tanpa sesi, dan tidak diberi akses apa pun.

-- Katalog dan lagu: tidak ada policy INSERT/UPDATE/DELETE => klien tidak bisa menulis (service role melewati RLS).
create policy artists_read on public.artists for select to authenticated using (true);
create policy albums_read  on public.albums  for select to authenticated using (true);

create policy songs_read on public.songs for select to authenticated
using (
  status = 'ready'
  and (
    visibility = 'public'
    or (owner_id = (select auth.uid()) and expires_at > now())
  )
);

-- Like: hanya milik sendiri, dan hanya untuk lagu yang TERLIHAT oleh pemanggil
-- (subquery di dalam policy tunduk pada RLS tabel songs milik pemanggil).
create policy likes_read   on public.likes for select to authenticated using (user_id = (select auth.uid()));
create policy likes_add    on public.likes for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.songs s where s.id = song_id));
create policy likes_remove on public.likes for delete to authenticated using (user_id = (select auth.uid()));

create policy playlists_own on public.playlists for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy playlist_songs_read on public.playlist_songs for select to authenticated
  using (exists (select 1 from public.playlists p where p.id = playlist_id and p.user_id = (select auth.uid())));
create policy playlist_songs_add on public.playlist_songs for insert to authenticated
  with check (
    exists (select 1 from public.playlists p where p.id = playlist_id and p.user_id = (select auth.uid()))
    and exists (select 1 from public.songs s where s.id = song_id));
create policy playlist_songs_remove on public.playlist_songs for delete to authenticated
  using (exists (select 1 from public.playlists p where p.id = playlist_id and p.user_id = (select auth.uid())));
```

</details>

### `0004_storage`

<details>
<summary>Tampilkan SQL</summary>

```sql
-- 0004_storage.sql — bucket dan policy Storage
-- file_size_limit ditegakkan Storage terhadap byte yang benar-benar masuk (tidak bisa dipalsukan klien).
-- allowed_mime_types hanya memeriksa Content-Type yang DIKLAIM klien, jadi ini pagar kasar, bukan validasi isi.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('audio',       'audio',       true,  15728640, array['audio/mpeg', 'audio/mp4', 'audio/x-m4a']),
  ('covers',      'covers',      true,   2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('user-audio',  'user-audio',  false, 10485760, array['audio/mpeg']),
  ('user-covers', 'user-covers', false,  2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Bucket publik (audio, covers): tidak ada policy untuk klien => klien tidak bisa menulis/mengubah/menghapus.
-- Pembacaan lewat URL publik tidak memerlukan policy. Penulisan hanya service role (skrip seed).

-- Pemeriksa "apakah path ini milik reservasi pending saya?". SECURITY DEFINER karena baris 'pending'
-- sengaja tidak terlihat lewat RLS songs.
create or replace function public.owns_pending_object(p_bucket text, p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.songs s
     where s.owner_id = (select auth.uid())
       and s.visibility = 'private' and s.status = 'pending' and s.expires_at > now()
       and ((p_bucket = 'user-audio'  and s.audio_path = p_name)
         or (p_bucket = 'user-covers' and s.cover_path = p_name))
  );
$$;
revoke all on function public.owns_pending_object(text, text) from public, anon;
grant execute on function public.owns_pending_object(text, text) to authenticated;

-- Tulis: HANYA ke path yang sudah dipesan lewat reserve_upload dan masih 'pending'. Tidak ada policy UPDATE,
-- jadi objek tidak bisa ditimpa (upsert ditolak) dan tak bisa diganti setelah divalidasi.
-- Tidak ada policy DELETE: penghapusan hanya lewat server (service role).
create policy "private_upload_reserved_path_only" on storage.objects
for insert to authenticated
with check (
  bucket_id in ('user-audio', 'user-covers')
  and public.owns_pending_object(bucket_id, name)
);

-- Baca (dibutuhkan createSignedUrl): hanya bila ada baris songs yang TERLIHAT bagi pemanggil,
-- artinya status 'ready', milik sendiri, dan belum kedaluwarsa (RLS songs yang menegakkan).
create policy "private_read_own_live" on storage.objects
for select to authenticated
using (
  (bucket_id = 'user-audio'  and exists (select 1 from public.songs s where s.audio_path = name))
  or
  (bucket_id = 'user-covers' and exists (select 1 from public.songs s where s.cover_path = name))
);
```

</details>

### `0005_cron`

<details>
<summary>Tampilkan SQL</summary>

```sql
-- 0005_cron.sql — penjadwalan job F18 (TIDAK ikut diuji lokal: butuh pg_cron, pg_net, Vault, dan Edge Function)
-- Prasyarat: extension pg_cron dan pg_net aktif; secret 'cleanup_secret' ada di Vault dan sama dengan CLEANUP_SECRET
-- di Edge Function; <PROJECT_REF> diganti dengan ref proyek.
select cron.schedule('cleanup-songs-hourly', '7 * * * *', $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/cleanup?task=songs',
    headers := jsonb_build_object('Authorization',
                 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cleanup_secret')),
    timeout_milliseconds := 60000);
$$);

select cron.schedule('cleanup-users-daily', '23 3 * * *', $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/cleanup?task=users',
    headers := jsonb_build_object('Authorization',
                 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cleanup_secret')),
    timeout_milliseconds := 60000);
$$);

select cron.schedule('cleanup-orphans-daily', '41 3 * * *', $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/cleanup?task=orphans',
    headers := jsonb_build_object('Authorization',
                 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cleanup_secret')),
    timeout_milliseconds := 60000);
$$);
```

</details>

## Lampiran B — `lib/audio/mp3.ts`

Fungsi murni tanpa I/O; unit test (CBR, ID3, Xing, ID3 besar, WAV, byte acak, Layer II, ukuran) lulus di Node 24.

```ts
// lib/audio/mp3.ts — fungsi murni (tanpa I/O): dipakai Route Handler finalize, skrip seed, dan unit test.
// Hanya menerima MPEG Layer III (MP3 sungguhan). Layer I/II, WAV, AAC, dan file acak ditolak.

export const LIMITS = {
  maxBytes: 10 * 1024 * 1024, // batas pengunjung
  minBytes: 4 * 1024,
  maxId3Bytes: 4 * 1024 * 1024,
  headBytes: 64 * 1024, // yang dibaca dari awal file lewat HTTP Range
  windowBytes: 32 * 1024, // jendela kedua bila tag ID3 melewati headBytes
  scanBytes: 16 * 1024, // ruang minimum di depan untuk mencari 3 frame beruntun
} as const;

const BITRATE_V1_L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, -1];
const BITRATE_V2_L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, -1];
const SAMPLE_RATE: Record<number, number[]> = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

export type Frame = { len: number; bitrateKbps: number; sampleRate: number; samplesPerFrame: number };

/** Header frame 4 byte di offset o, atau null bila bukan header MP3 Layer III yang valid. */
export function parseFrameHeader(b: Uint8Array, o: number): Frame | null {
  if (o < 0 || o + 4 > b.length) return null;
  if (b[o] !== 0xff || (b[o + 1] & 0xe0) !== 0xe0) return null; // 11 bit sinkron
  const version = (b[o + 1] >> 3) & 3; // 3=MPEG1, 2=MPEG2, 0=MPEG2.5, 1=cadangan
  const layer = (b[o + 1] >> 1) & 3; // 1 = Layer III
  const brIdx = (b[o + 2] >> 4) & 15;
  const srIdx = (b[o + 2] >> 2) & 3;
  const pad = (b[o + 2] >> 1) & 1;
  if (version === 1 || layer !== 1 || srIdx === 3) return null;
  const bitrateKbps = (version === 3 ? BITRATE_V1_L3 : BITRATE_V2_L3)[brIdx];
  if (bitrateKbps <= 0) return null; // 0 = "free format", -1 = tidak valid: ditolak
  const sampleRate = SAMPLE_RATE[version][srIdx];
  const samplesPerFrame = version === 3 ? 1152 : 576;
  const len = Math.floor(((samplesPerFrame / 8) * bitrateKbps * 1000) / sampleRate) + pad;
  return { len, bitrateKbps, sampleRate, samplesPerFrame };
}

/** Total byte tag ID3v2 di awal file yang harus dilewati (0 bila tidak ada). */
export function id3v2Size(b: Uint8Array): number {
  if (b.length < 10 || b[0] !== 0x49 || b[1] !== 0x44 || b[2] !== 0x33) return 0; // "ID3"
  const size = ((b[6] & 0x7f) << 21) | ((b[7] & 0x7f) << 14) | ((b[8] & 0x7f) << 7) | (b[9] & 0x7f);
  return 10 + size + (b[5] & 0x10 ? 10 : 0);
}

/** Cari posisi pertama yang diikuti `needed` frame valid BERUNTUN (menghindari salah deteksi byte acak). */
export function findFirstFrames(b: Uint8Array, from: number, scanLimit = 8192, needed = 3): { offset: number; frame: Frame } | null {
  const end = Math.min(from + scanLimit, b.length - 4);
  for (let s = Math.max(from, 0); s < end; s++) {
    let o = s;
    let first: Frame | null = null;
    let n = 0;
    while (n < needed) {
      const f = parseFrameHeader(b, o);
      if (!f) break;
      first ??= f;
      n++;
      o += f.len;
    }
    if (n === needed && first) return { offset: s, frame: first };
  }
  return null;
}

/** Jumlah frame dari header Xing/Info (VBR/CBR modern), atau null. */
export function xingFrames(b: Uint8Array, o: number, f: Frame): number | null {
  const mono = ((b[o + 3] >> 6) & 3) === 3;
  const mpeg1 = f.samplesPerFrame === 1152;
  const side = mpeg1 ? (mono ? 17 : 32) : mono ? 9 : 17;
  const t = o + 4 + side;
  if (t + 12 > b.length) return null;
  const tag = String.fromCharCode(b[t], b[t + 1], b[t + 2], b[t + 3]);
  if ((tag !== 'Xing' && tag !== 'Info') || !(b[t + 7] & 1)) return null;
  return ((b[t + 8] << 24) | (b[t + 9] << 16) | (b[t + 10] << 8) | b[t + 11]) >>> 0;
}

export type Mp3Verdict =
  | { ok: true; durationSec: number; bitrateKbps: number; sampleRate: number }
  | { ok: false; reason: 'too_small' | 'too_large' | 'not_mp3' | 'tag_too_large' }
  | { ok: false; reason: 'need_window'; needFrom: number };

/**
 * head  : byte 0..headBytes-1 file.
 * total : ukuran file sebenarnya (dari Content-Range / Content-Length, BUKAN dari klien).
 * win   : bila hasil sebelumnya 'need_window', ambil LIMITS.windowBytes byte mulai needFrom lalu panggil ulang.
 */
export function checkMp3(head: Uint8Array, total: number, win?: { offset: number; bytes: Uint8Array }): Mp3Verdict {
  if (total > LIMITS.maxBytes) return { ok: false, reason: 'too_large' };
  if (total < LIMITS.minBytes) return { ok: false, reason: 'too_small' };
  const skip = id3v2Size(head);
  if (skip > LIMITS.maxId3Bytes) return { ok: false, reason: 'tag_too_large' };

  let bytes = head;
  let base = 0;
  const headCoversIt = skip + LIMITS.scanBytes <= head.length || head.length >= total;
  if (!headCoversIt) {
    if (!win || win.offset !== skip) return { ok: false, reason: 'need_window', needFrom: skip };
    bytes = win.bytes;
    base = win.offset;
  }
  const hit = findFirstFrames(bytes, skip - base);
  if (!hit) return { ok: false, reason: 'not_mp3' };

  const { frame } = hit;
  const xing = xingFrames(bytes, hit.offset, frame);
  const audioBytes = total - (base + hit.offset);
  const seconds = xing ? (xing * frame.samplesPerFrame) / frame.sampleRate : (audioBytes * 8) / (frame.bitrateKbps * 1000);
  return { ok: true, durationSec: Math.max(1, Math.round(seconds)), bitrateKbps: frame.bitrateKbps, sampleRate: frame.sampleRate };
}

/** Magic bytes cover: JPEG / PNG / WebP. */
export function checkImage(b: Uint8Array, ext: 'jpg' | 'png' | 'webp'): boolean {
  if (ext === 'jpg') return b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (ext === 'png') return b.length > 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v);
  const s = (o: number) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);
  return b.length > 12 && s(0) === 'RIFF' && s(8) === 'WEBP';
}
```
