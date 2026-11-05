# Streaming — Spesifikasi MVP (Web)

**Status:** Draft v1.1 (keputusan auth & upload diperbarui) · **Tanggal:** 2026-11-05 · **Jenis proyek:** Portofolio
**Stack:** Next.js (App Router) + Tailwind CSS + Supabase (Postgres, Auth, Storage)

---

## 1. Ringkasan Masalah

Proyek portofolio perlu menunjukkan kemampuan membangun aplikasi full-stack yang terasa seperti produk nyata, bukan sekadar CRUD. Aplikasi streaming musik cocok karena menuntut hal-hal yang sulit dipalsukan: state global yang bertahan lintas halaman (pemutar), upload file, relasi data (lagu–album–artis–playlist), dan auth.

**Pengguna utama:** perekrut / reviewer teknis yang membuka demo selama 2–5 menit. Mereka harus bisa langsung masuk, memutar musik, dan merasakan kualitas tanpa hambatan registrasi.

**Biaya jika tidak dipecahkan:** demo yang butuh daftar akun, kosong tanpa konten, atau pemutarnya terputus saat pindah halaman akan langsung terkesan amatir.

## 2. Tujuan

1. **Demo siap pakai:** reviewer bisa masuk lewat tombol **"Coba tanpa daftar"** dan memutar lagu pertama dalam **≤ 3 klik / ≤ 15 detik** dari membuka URL (termasuk verifikasi CAPTCHA).
2. **Pemutar tidak terputus:** audio tetap berjalan tanpa jeda/reset saat berpindah antar halaman (100% skenario navigasi internal).
3. **Alur inti lengkap end-to-end:** upload → muncul di beranda/album/artis → bisa diputar, dicari, di-like, dan dimasukkan ke playlist.
4. **Data demo realistis:** minimal **15 lagu, 4 album, 4 artis** ter-seed dengan cover, agar beranda tidak kosong saat pertama dibuka.
5. **Kualitas teknis terlihat:** Lighthouse Performance ≥ 85 dan Accessibility ≥ 90 pada beranda (mobile), tanpa error console pada alur utama.

## 3. Bukan Tujuan (Non-Goals)

| Di luar MVP | Alasan |
|---|---|
| Registrasi email, lupa password, login sosial di MVP | Sign-in anonim cukup untuk portofolio dan tidak menyimpan data pribadi; upgrade ke akun email masuk fase Nanti (F17) |
| Aplikasi mobile native | Versi pertama web; desain responsif sudah cukup |
| Rekomendasi / algoritma personalisasi | Butuh data perilaku yang tidak ada; nilai portofolio kecil dibanding biayanya |
| Streaming adaptif (HLS), transcoding, normalisasi volume | Kompleksitas infrastruktur tinggi; MVP cukup memutar file audio langsung dari Storage |
| Fitur sosial (follow, komentar, bagikan, profil publik) | Bukan inti alur dengar-musik |
| Pembayaran, langganan, iklan | Tidak relevan untuk portofolio |
| Lirik tersinkron, equalizer, crossfade | Nilai tambah kecil terhadap risiko waktu |
| Moderasi konten & hak cipta otomatis | Katalog publik hanya diisi admin; upload pengunjung bersifat pribadi, dibatasi, dan otomatis terhapus dalam 24 jam |
| Upload publik oleh pengunjung / katalog kontribusi pengguna | Mencegah spam dan masalah hak cipta; sengaja dibatasi lewat role admin |
| Panel admin khusus | Admin memakai formulir upload yang sama dengan opsi tambahan "Katalog publik"; UI moderasi tidak diperlukan |

## 4. Persona

- **Pengunjung anonim / reviewer (utama)** — membuka demo, ingin cepat melihat fitur dan kualitas. Tidak mau mendaftar. Masuk lewat "Coba tanpa daftar", mendapat identitas anonim sendiri, bisa menyukai lagu, membuat playlist, dan mengunggah lagu ke library pribadi (dengan batas).
- **Admin (pemilik proyek)** — satu-satunya yang boleh mengisi katalog publik (lagu, album, artis).

> Keputusan: tiap pengunjung memakai **user anonim Supabase miliknya sendiri**. Katalog dibagi bersama dan read-only; like, playlist, dan lagu pribadi adalah milik masing-masing user dan dilindungi RLS.

## 5. Prioritas Fitur

| # | Fitur | Prioritas |
|---|---|---|
| F1 | Sign-in anonim "Coba tanpa daftar" + CAPTCHA | **Wajib (P0)** |
| F2 | Pemutar global + antrean persisten | **Wajib (P0)** |
| F3 | Beranda | **Wajib (P0)** |
| F4 | Halaman album & artis | **Wajib (P0)** |
| F5 | Upload lagu (judul, artis, album, cover): admin → katalog publik; pengunjung → library pribadi (MP3, ≤ 10 MB, ≤ 3 lagu, hapus otomatis 24 jam) | **Wajib (P0)** |
| F6 | Pencarian | **Wajib (P0)** |
| F7 | Like lagu + halaman "Lagu Disukai" | **Wajib (P0)** |
| F8 | Playlist (buat, tambah/hapus lagu, putar) | **Wajib (P0)** |
| F9 | Seed data demo | **Wajib (P0)** — pendukung |
| F10 | Antrean: reorder via drag, "putar berikutnya" | Nanti (P1) |
| F11 | Mode acak & ulang (shuffle/repeat) | Nanti (P1) — *lihat catatan di F2* |
| F12 | Edit / hapus lagu yang diunggah | Nanti (P1) |
| F13 | Ingat posisi terakhir pemutar setelah refresh | Nanti (P1) |
| F14 | Media Session API (kontrol layar kunci / tombol media) | Nanti (P1) |
| F15 | Pintasan keyboard (spasi, panah) | Nanti (P1) |
| F16 | Tema terang/gelap | Nanti (P2) |
| F17 | Upgrade akun anonim ke akun email tanpa kehilangan data | Nanti (P1) |
| F18 | Pembersihan otomatis: akun anonim tidak aktif 7 hari & upload pribadi > 24 jam | **Wajib (P0)** — pendukung |

> **Catatan F2 vs F11:** *Repeat* dan *shuffle* sangat dekat dengan inti pemutar dan murah dikerjakan bersamaan dengan antrean. Jika waktu cukup, kerjakan di fase yang sama; tidak memblokir rilis.

---

## 6. User Story & Acceptance Criteria

### F1 — Sign-in anonim "Coba tanpa daftar"

**Story:** Sebagai reviewer, saya ingin masuk dengan satu klik tanpa mendaftar agar saya bisa mencoba aplikasi dengan like dan playlist milik saya sendiri, tidak tercampur dengan pengunjung lain.

**Acceptance criteria**
- [ ] Halaman masuk menampilkan tombol **"Coba tanpa daftar"** yang memanggil sign-in anonim Supabase tanpa input apa pun dari pengguna.
- [ ] **CAPTCHA aktif** untuk sign-in anonim di pengaturan Supabase Auth; permintaan tanpa token CAPTCHA valid **ditolak oleh server** (bukan hanya disembunyikan di UI).
- [ ] Setiap browser/pengunjung mendapat user anonim berbeda (`is_anonymous = true`); sesi bertahan setelah refresh dan setelah tab ditutup selama penyimpanan browser tidak dihapus.
- [ ] Given dua pengunjung berbeda, When pengunjung A menyukai lagu dan membuat playlist, Then pengunjung B tidak dapat melihat atau mengubahnya (RLS, diuji lewat API langsung, bukan hanya UI).
- [ ] Katalog (songs publik, albums, artists) dapat dibaca semua user ter-autentikasi termasuk anonim, tetapi **INSERT/UPDATE/DELETE katalog ditolak** untuk non-admin, termasuk lewat panggilan API langsung.
- [ ] Pengguna tanpa sesi yang membuka halaman lain dialihkan ke halaman masuk.
- [ ] Ada tombol **Keluar**. Karena akun anonim tidak bisa dipulihkan, muncul dialog konfirmasi: "Like, playlist, dan lagu pribadi akan hilang." Konfirmasi → audio berhenti, antrean kosong, sesi berakhir; batal → tidak ada perubahan.
- [ ] Info singkat di UI: "Mode tamu — data dihapus otomatis setelah 7 hari tidak aktif."
- [ ] Jika sign-in gagal (jaringan, CAPTCHA gagal, rate limit), muncul pesan jelas dan tombol coba lagi; tidak ada loop otomatis.
- [ ] **Admin** adalah akun email terpisah dengan role `admin` di `app_metadata` (tidak bisa diubah user sendiri). Tidak ada tautan menuju login admin di UI publik.
- [ ] Service-role key **tidak pernah** dikirim ke klien.

### F2 — Pemutar global dengan antrean persisten

**Story:** Sebagai pendengar, saya ingin musik tetap berputar saat saya berpindah halaman agar saya bisa menjelajah tanpa terganggu.

**Acceptance criteria**
- [ ] Pemutar berada di layout root sehingga **tidak di-unmount** saat navigasi antar halaman; satu elemen audio dipakai bersama.
- [ ] Given lagu sedang diputar, When pengguna berpindah dari beranda ke halaman album/artis/pencarian/playlist, Then audio **tidak berhenti, tidak mengulang dari awal**, dan progress bar tetap berjalan.
- [ ] Bar pemutar (tetap di bawah layar) menampilkan: cover, judul, artis, play/pause, sebelumnya, berikutnya, progress bar yang bisa di-seek, waktu berjalan/total, dan volume.
- [ ] Klik "putar" pada lagu dalam daftar (album/playlist/pencarian/beranda) mengisi antrean dengan daftar tersebut, dimulai dari lagu yang diklik.
- [ ] Setelah lagu selesai, lagu berikutnya di antrean diputar otomatis; setelah lagu terakhir, pemutar berhenti dan kembali ke awal lagu terakhir (tanpa error).
- [ ] Tombol "Sebelumnya": jika posisi > 3 detik, kembali ke awal lagu; jika ≤ 3 detik, ke lagu sebelumnya.
- [ ] Panel antrean dapat dibuka dan menampilkan lagu yang sedang diputar serta lagu berikutnya; mengeklik lagu di antrean memutarnya.
- [ ] Tombol "Tambah ke antrean" tersedia di menu aksi lagu.
- [ ] Given file audio gagal dimuat (URL rusak/404), Then muncul toast error dan pemutar otomatis lompat ke lagu berikutnya; tidak macet.
- [ ] Menekan "Berikutnya" berulang cepat tidak menyebabkan dua audio berbunyi bersamaan.
- [ ] Kebijakan autoplay browser ditangani: pemutaran hanya dimulai dari aksi pengguna; jika `play()` ditolak, UI kembali ke status "jeda" tanpa error tak tertangani.
- [ ] **Tidak boleh:** audio berhenti hanya karena navigasi, atau antrean ter-reset oleh perubahan rute.

**Catatan teknis:** state pemutar disimpan di React Context/Zustand pada layout root; semua navigasi memakai `next/link`. Pastikan tidak ada `window.location` / full reload pada navigasi internal.

### F3 — Beranda

**Story:** Sebagai pendengar, saya ingin melihat daftar musik di beranda agar saya cepat menemukan sesuatu untuk diputar.

**Acceptance criteria**
- [ ] Beranda menampilkan bagian: **Lagu Terbaru**, **Album**, **Artis** (kartu dengan cover/foto, judul, subjudul).
- [ ] Mengeklik kartu album/artis membuka halamannya; tombol play pada kartu memutar isi album.
- [ ] Given tidak ada lagu sama sekali, Then tampil empty state dengan ajakan mengunggah lagu.
- [ ] Skeleton/loading ditampilkan saat data dimuat; error fetch menampilkan pesan dan tombol coba lagi.
- [ ] Layout responsif: 2 kolom kartu di mobile, ≥ 4 kolom di desktop; tidak ada scroll horizontal halaman.

### F4 — Halaman album & artis

**Story:** Sebagai pendengar, saya ingin membuka halaman album dan artis agar saya bisa mendengarkan seluruh karya mereka.

**Acceptance criteria**
- [ ] `/album/[id]`: menampilkan cover, judul, nama artis (tautan ke halaman artis), tahun (jika ada), jumlah lagu, total durasi, dan daftar lagu berurutan.
- [ ] `/artis/[id]`: menampilkan nama, foto (atau placeholder), daftar album, dan daftar lagu.
- [ ] Tombol **Putar** memutar seluruh daftar dari lagu pertama; mengeklik satu lagu memulai dari lagu itu.
- [ ] Lagu yang sedang diputar ditandai di daftar.
- [ ] ID tidak valid menampilkan halaman 404 yang rapi.
- [ ] Lagu tanpa album ("single") tetap muncul di halaman artis dan diberi label "Single".

### F5 — Upload lagu

**Story (admin):** Sebagai admin, saya ingin mengunggah lagu beserta judul, artis, album, dan cover ke katalog publik agar semua pengunjung bisa mendengarnya.

**Story (pengunjung):** Sebagai pengunjung, saya ingin mengunggah lagu ke library pribadi agar saya bisa mencoba alur upload tanpa memengaruhi katalog publik.

**Acceptance criteria — umum**
- [ ] Formulir upload berisi: file audio (wajib), judul (wajib), artis (wajib), album (opsional), cover (opsional; JPG/PNG/WebP, maks 2 MB).
- [ ] Durasi lagu dibaca dari file dan disimpan.
- [ ] Indikator progres upload tampil; tombol kirim dinonaktifkan selama proses agar tidak terkirim ganda.
- [ ] Given upload gagal di tengah jalan, Then tidak tersisa data setengah jadi (baris DB tanpa file, atau file tanpa baris); pengguna mendapat pesan error dan bisa mengulang.
- [ ] Nama file di Storage diacak (UUID); nama asli hanya disimpan sebagai metadata.
- [ ] Jika cover tidak diunggah, cover album dipakai (khusus katalog publik); jika tidak ada, tampil placeholder konsisten.

**Acceptance criteria — admin → katalog publik**
- [ ] Hanya user dengan role `admin` melihat opsi tujuan **"Katalog publik"**; di UI pengunjung opsi ini tidak ada.
- [ ] Field artis & album berupa input dengan saran dari data yang ada; nama baru membuat entri baru, nama yang sudah ada **dipakai ulang** (tanpa duplikat, tidak peka huruf besar/kecil).
- [ ] Format audio admin: MP3, M4A, OGG; maks 15 MB; tidak ada batas jumlah dan tidak kedaluwarsa. *(angka ini asumsi saya, bukan keputusan; sesuaikan bila perlu)*
- [ ] Given upload sukses, Then lagu langsung tampil di beranda dan halaman artis/album terkait tanpa refresh manual.
- [ ] Given user non-admin memanggil API langsung untuk menulis ke tabel katalog atau bucket publik, Then permintaan **ditolak** oleh RLS/policy Storage.

**Acceptance criteria — pengunjung → library pribadi**
- [ ] Tujuan unggahan pengunjung terkunci ke **Library pribadi**; ada halaman `/library` berisi lagu pribadi miliknya, dapat diputar, di-like, dan ditambahkan ke playlist.
- [ ] **Hanya MP3**: ditolak jika ekstensi bukan `.mp3`, MIME bukan `audio/mpeg`, atau header file bukan MP3 yang valid (diperiksa di sisi server, bukan hanya nama file).
- [ ] **Maks 10 MB per file**; file lebih besar ditolak sebelum diunggah dan juga ditolak oleh batas bucket/policy.
- [ ] **Maks 3 lagu aktif per akun** (lagu yang belum kedaluwarsa). Given sudah 3 lagu aktif, Then form dinonaktifkan dengan pesan jelas; penegakan di DB/RPC sehingga dua upload paralel tidak bisa melampaui 3.
- [ ] Menghapus lagu pribadi secara manual membebaskan slot dan menghapus file Storage-nya.
- [ ] UI menampilkan slot terpakai (mis. "2/3") dan waktu sisa sebelum tiap lagu terhapus.
- [ ] Setiap lagu pribadi memiliki `expires_at = waktu upload + 24 jam`. Setelah itu lagu **tidak dapat dibaca** (RLS/query memfilter `expires_at > now()`) dan signed URL-nya ditolak, walaupun job pembersih belum berjalan.
- [ ] Lagu pribadi **hanya terlihat oleh pemiliknya**: tidak muncul di beranda, halaman album/artis, atau pencarian user lain. Diuji: user B tidak bisa SELECT baris maupun mengunduh objek milik user A.
- [ ] Artis dan album lagu pribadi disimpan sebagai **teks pada lagu itu**, tidak membuat entri di tabel `artists`/`albums` publik, dan tidak punya halaman artis/album.
- [ ] Audio pribadi disajikan lewat **signed URL berumur pendek** dari bucket privat berfolder per user.
- [ ] Banner di formulir: "Lagu pribadi terhapus otomatis setelah 24 jam. Unggah hanya musik yang kamu punya haknya."
- [ ] Saat lagu pribadi kedaluwarsa, like dan entri playlist yang merujuknya ikut hilang tanpa error (lihat F8).

### F6 — Pencarian

**Story:** Sebagai pendengar, saya ingin mencari lagu, album, dan artis agar saya cepat menemukan yang saya mau.

**Acceptance criteria**
- [ ] Kolom pencarian selalu dapat diakses (header); hasil di `/cari?q=...` sehingga URL dapat dibagikan dan tombol Back berfungsi.
- [ ] Hasil dikelompokkan: **Lagu**, **Album**, **Artis**; pencarian cocok pada sebagian kata, tidak peka huruf besar/kecil, dan mencakup judul lagu serta nama artis/album.
- [ ] Input di-*debounce* (≈300 ms); permintaan lama dibatalkan agar hasil lama tidak menimpa hasil baru.
- [ ] Given tidak ada hasil, Then tampil "Tidak ada hasil untuk '…'" dengan saran.
- [ ] Query kosong tidak mengirim permintaan; karakter khusus (`%`, `_`, `'`) tidak merusak query maupun menyebabkan injeksi.
- [ ] Mengeklik hasil lagu memutarnya tanpa mengganggu navigasi; pemutar tetap berjalan saat pindah ke halaman hasil.
- [ ] Hasil mencakup lagu katalog publik **dan** lagu pribadi milik user sendiri (diberi label "Pribadi"); lagu pribadi user lain tidak pernah muncul.

### F7 — Like lagu

**Story:** Sebagai pendengar, saya ingin menyukai lagu agar saya bisa menemukannya lagi dengan mudah.

**Acceptance criteria**
- [ ] Ikon hati tersedia di baris lagu dan di bar pemutar; status sinkron di semua tempat untuk lagu yang sama.
- [ ] Toggle bersifat *optimistic*: UI berubah seketika; jika server gagal, UI dikembalikan dan toast error muncul.
- [ ] Like disimpan per pengguna, unik per (pengguna, lagu); klik cepat berulang tidak membuat duplikat.
- [ ] Halaman **Lagu Disukai** (`/disukai`) menampilkan semua lagu yang disukai, bisa diputar; empty state jika belum ada.
- [ ] Meng-unlike lagu di halaman Lagu Disukai menghapusnya dari daftar tanpa menghentikan pemutaran.
- [ ] Hanya pemilik yang dapat membaca/menulis like-nya (RLS); like milik user anonim lain tidak terlihat.
- [ ] Like hanya boleh untuk lagu publik atau lagu pribadi milik sendiri; menyukai lagu pribadi orang lain lewat API langsung ditolak.

### F8 — Playlist

**Story:** Sebagai pendengar, saya ingin membuat playlist agar saya bisa mengelompokkan lagu sesuai selera.

**Acceptance criteria**
- [ ] Pengguna dapat **membuat** playlist dengan nama (wajib, 1–60 karakter, spasi di ujung dipangkas); deskripsi opsional.
- [ ] Sidebar/daftar menampilkan semua playlist milik pengguna.
- [ ] Menu aksi lagu "Tambah ke playlist" menampilkan daftar playlist (+ opsi "Playlist baru").
- [ ] Menambahkan lagu yang sudah ada di playlist ditolak dengan pesan ("Sudah ada di playlist"), tanpa duplikat.
- [ ] Halaman `/playlist/[id]`: menampilkan nama, jumlah lagu, daftar lagu berurutan sesuai waktu ditambahkan, dan tombol Putar.
- [ ] Pengguna dapat **menghapus lagu** dari playlist, **mengganti nama**, dan **menghapus playlist** (dengan dialog konfirmasi).
- [ ] Menghapus playlist yang sedang diputar tidak menghentikan lagu yang sedang berjalan, namun antrean tetap utuh.
- [ ] Playlist kosong menampilkan empty state; playlist hanya dapat diakses pemiliknya (RLS); ID milik pengguna lain/tidak ada menghasilkan 404.
- [ ] Playlist boleh berisi lagu publik dan lagu pribadi milik sendiri. Saat lagu pribadi kedaluwarsa, ia otomatis hilang dari playlist dan Lagu Disukai, jumlah lagu diperbarui, dan lagu itu dilewati di antrean tanpa error.

### F9 — Seed data demo

**Story:** Sebagai reviewer, saya ingin aplikasi sudah berisi musik agar saya tidak perlu mengunggah apa pun sebelum bisa menilai.

**Acceptance criteria**
- [ ] Skrip seed idempoten (dijalankan ulang tidak membuat duplikat) menghasilkan ≥ 15 lagu, ≥ 4 album, ≥ 4 artis, lengkap dengan cover.
- [ ] Semua audio seed berlisensi bebas (CC0 / royalty-free / karya sendiri); sumber dan lisensi dicatat di `README`.
- [ ] Seed dimasukkan ke **katalog publik** lewat akun admin / service role (tidak lewat klien).
- [ ] Seed tidak mencakup like atau playlist (itu milik tiap user); empty state Lagu Disukai, Playlist, dan Library pribadi harus tampak baik untuk pengunjung baru.

### F17 — Upgrade ke akun email (Nanti, P1)

**Story:** Sebagai pengunjung anonim, saya ingin menautkan email ke akun saya agar like, playlist, dan lagu saya tidak hilang dan bisa dipakai di perangkat lain.

**Acceptance criteria**
- [ ] Tombol "Simpan akun" membuka formulir email (+ password atau tautan ajaib) yang **menautkan identitas ke user anonim yang sama** sehingga user ID tidak berubah dan like/playlist tetap utuh.
- [ ] Setelah email terkonfirmasi, `is_anonymous = false` dan akun tidak lagi terkena pembersihan 7 hari.
- [ ] Email yang sudah terdaftar ditolak dengan pesan jelas; data tetap aman di akun anonim.
- [ ] Upgrade yang gagal atau belum terkonfirmasi tidak menghapus data apa pun.
- [ ] Batas library pribadi (MP3, 10 MB, 3 lagu, 24 jam) tetap berlaku setelah upgrade; upgrade **tidak** memberi hak admin.

### F18 — Pembersihan otomatis

**Story:** Sebagai pemilik proyek, saya ingin data pengunjung yang tak terpakai terhapus otomatis agar kuota gratis Supabase tidak habis.

**Acceptance criteria**
- [ ] Job terjadwal (mis. `pg_cron` atau scheduled function) berjalan **setiap jam**: menghapus lagu pribadi dengan `expires_at <= now()` beserta file audio/cover di Storage, like, dan entri playlist terkait.
- [ ] Job terjadwal berjalan **harian**: menghapus user anonim yang tidak aktif ≥ 7 hari beserta seluruh data dan file Storage-nya.
- [ ] User non-anonim (admin, akun hasil upgrade) dan lagu katalog publik **tidak pernah** tersentuh job.
- [ ] Job idempoten dan aman dijalankan ulang; urutan penghapusan menjamin tidak ada baris atau file yatim, dan kegagalan dicatat di log.
- [ ] Diuji dengan data fixture berumur >24 jam dan >7 hari: yang kedaluwarsa terhapus, yang belum tetap ada.

---

## 7. Persyaratan Non-Fungsional

- **Keamanan:** RLS aktif di semua tabel dan bucket; service-role key hanya di server; role admin disimpan di `app_metadata` (tidak bisa diubah klien); CAPTCHA wajib untuk sign-in anonim; semua batas upload (format, ukuran, jumlah, kedaluwarsa) ditegakkan **di server/DB**, bukan hanya di UI; ada uji otomatis yang membuktikan user A tidak bisa membaca data user B.
- **Performa:** First Contentful Paint beranda ≤ 2 s di jaringan 4G; audio mulai terdengar ≤ 2 s setelah klik play (file ≤ 15 MB, Storage publik/signed URL).
- **Aksesibilitas:** semua kontrol pemutar dapat dioperasikan dengan keyboard, punya label ARIA, dan kontras warna memenuhi WCAG AA.
- **Kompatibilitas:** Chrome, Firefox, Safari, Edge versi terbaru; viewport 360 px hingga desktop. Safari/iOS diuji khusus untuk kebijakan autoplay.
- **Biaya:** tetap di free tier Supabase; batas upload pengunjung (10 MB × 3 lagu, hapus 24 jam), pembersihan akun anonim 7 hari, dan CAPTCHA melindungi kuota Storage dan Auth.

## 8. Model Data (garis besar)

`artists(id, name, image_url)` · `albums(id, title, artist_id, cover_url, year)` · `songs(id, title, visibility['public'|'private'], owner_id?, artist_id?, album_id?, artist_name?, album_name?, audio_path, cover_path?, duration_sec, expires_at?, created_at)` · `likes(user_id, song_id, created_at; PK gabungan)` · `playlists(id, user_id, name, description, created_at)` · `playlist_songs(playlist_id, song_id, position, added_at; unik gabungan)`

- Lagu `public`: `owner_id` kosong, `expires_at` kosong, memakai `artist_id`/`album_id`; hanya admin yang boleh menulis.
- Lagu `private`: `owner_id = auth.uid()`, `expires_at = created_at + 24 jam`, artis/album sebagai teks (`artist_name`/`album_name`); terbaca hanya jika `owner_id = auth.uid() AND expires_at > now()`.
- `likes`, `playlists`, `playlist_songs`, dan lagu pribadi memakai `ON DELETE CASCADE` ke `auth.users` dan ke `songs`, sehingga penghapusan akun anonim atau lagu kedaluwarsa membersihkan semua turunannya.

Storage: bucket publik `audio` & `covers` (tulis hanya admin); bucket privat `user-audio` & `user-covers` dengan path `{user_id}/{uuid}` dan policy berbasis folder; audio privat diakses lewat signed URL.

## 9. Metrik Keberhasilan

Karena ini portofolio, metrik diukur dengan daftar periksa dan uji manual, bukan analitik pengguna.

**Indikator utama (diukur saat rilis)**
| Metrik | Target |
|---|---|
| Klik dari URL sampai lagu terdengar | ≤ 3 klik |
| Skenario navigasi yang memutus audio | 0 dari seluruh rute (uji manual semua rute) |
| Alur P0 lulus uji end-to-end (Playwright) | 100% (login, putar+navigasi, upload, cari, like, playlist) |
| Lighthouse beranda mobile (Perf / A11y) | ≥ 85 / ≥ 90 |
| Error tak tertangani di console pada alur utama | 0 |
| Uji RLS: user A tidak dapat membaca/menulis like, playlist, lagu pribadi user B | 100% lulus |
| Uji batas upload pengunjung (non-MP3, >10 MB, lagu ke-4, paralel, tulis katalog publik) ditolak server | 100% ditolak |
| Uji pembersihan (fixture >24 jam & >7 hari) | 100% lulus |

**Indikator tambahan (opsional, 1–3 bulan)**
- Jumlah kunjungan/klik dari tautan portofolio (jika memasang analitik ringan).
- Umpan balik dari reviewer/rekan.

## 10. Keputusan & Pertanyaan Terbuka

### Keputusan (final)

1. **Auth:** Supabase anonymous sign-in per pengunjung lewat tombol "Coba tanpa daftar", CAPTCHA aktif. Akun anonim tidak aktif 7 hari dihapus otomatis. Upgrade ke akun email tanpa kehilangan data → fase Nanti (F17).
2. **Data:** katalog (songs publik, albums, artists) dibagi bersama dan read-only; likes dan playlists milik tiap user, dilindungi RLS.
3. **Upload:** katalog publik hanya bisa diisi role admin. Pengunjung boleh upload ke library pribadi yang hanya terlihat olehnya: MP3 saja, maks 10 MB per file, maks 3 lagu per akun, otomatis terhapus setelah 24 jam.

### Pertanyaan terbuka

| # | Pertanyaan | Pemilik | Sifat |
|---|---|---|---|
| 1 | Penyedia CAPTCHA (Cloudflare Turnstile vs hCaptcha) dan modenya (tak terlihat vs tantangan)? Harus tetap memenuhi target masuk ≤ 15 detik dan menangani rate limit sign-in anonim. | Engineering | Non-blocking |
| 2 | Bagaimana akun admin dibuat dan login-nya diakses (akun email manual + `app_metadata.role='admin'` lewat SQL/dashboard; rute login tersembunyi atau lewat `service role` skrip)? | Pemilik proyek / Engineering | **Blocking** untuk F5 dan seed |
| 3 | Sumber audio seed dan lisensinya (mis. Free Music Archive, Pixabay, karya sendiri). | Pemilik proyek | Non-blocking |
| 4 | Audio katalog di bucket publik, audio pribadi lewat signed URL. Berapa masa berlaku signed URL, dan bagaimana menyegarkannya di tengah antrean panjang tanpa memutus pemutaran? | Engineering | Non-blocking |
| 5 | Pustaka state pemutar: Context vs Zustand? | Engineering | Non-blocking |
| 6 | Definisi "tidak aktif 7 hari": berdasarkan `last_sign_in_at` bawaan Supabase (sesi yang hanya di-refresh mungkin tidak memperbaruinya) atau penanda aktivitas sendiri (mis. `last_seen_at` yang diperbarui berkala)? | Engineering | Non-blocking |
| 7 | Saat lagu pribadi kedaluwarsa ketika sedang diputar: lanjut sampai selesai atau langsung berhenti? Usulan: biarkan lagu yang sedang berjalan selesai, lewati sisanya di antrean. | Pemilik proyek (produk) | Non-blocking |

## 11. Pertimbangan Jadwal & Fase

Tidak ada tenggat keras yang diketahui. Urutan pengerjaan yang disarankan (tiap fase menghasilkan sesuatu yang bisa didemokan):

1. **Fase 1 — Fondasi:** setup Next.js + Tailwind + Supabase, skema DB + RLS (termasuk role admin dan visibilitas lagu), F1 (sign-in anonim + CAPTCHA), F9 (seed lewat akun admin).
2. **Fase 2 — Inti mendengar:** F3 (beranda), F4 (album & artis), **F2 (pemutar global)**. *Pemutar adalah risiko teknis terbesar dan pembeda utama — kerjakan lebih awal.*
3. **Fase 3 — Interaksi:** F6 (pencarian), F7 (like), F8 (playlist).
4. **Fase 4 — Konten:** F5 (upload admin ke katalog publik + upload pribadi dengan seluruh batasnya) dan F18 (job pembersihan 24 jam / 7 hari).
5. **Fase 5 — Poles & rilis:** uji end-to-end, aksesibilitas, Lighthouse, README (screenshot, lisensi audio, tautan demo), deploy (mis. Vercel). Setelah itu ambil item P1 sesuai waktu.

**Definisi selesai MVP:** semua F1–F9 dan F18 memenuhi acceptance criteria, uji end-to-end lulus, demo ter-deploy dengan seed data, dan README tersedia.
