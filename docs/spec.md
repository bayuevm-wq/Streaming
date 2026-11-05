# Streaming — Spesifikasi MVP (Web)

**Status:** Draft v1 · **Tanggal:** 2026-11-05 · **Jenis proyek:** Portofolio
**Stack:** Next.js (App Router) + Tailwind CSS + Supabase (Postgres, Auth, Storage)

---

## 1. Ringkasan Masalah

Proyek portofolio perlu menunjukkan kemampuan membangun aplikasi full-stack yang terasa seperti produk nyata, bukan sekadar CRUD. Aplikasi streaming musik cocok karena menuntut hal-hal yang sulit dipalsukan: state global yang bertahan lintas halaman (pemutar), upload file, relasi data (lagu–album–artis–playlist), dan auth.

**Pengguna utama:** perekrut / reviewer teknis yang membuka demo selama 2–5 menit. Mereka harus bisa langsung masuk, memutar musik, dan merasakan kualitas tanpa hambatan registrasi.

**Biaya jika tidak dipecahkan:** demo yang butuh daftar akun, kosong tanpa konten, atau pemutarnya terputus saat pindah halaman akan langsung terkesan amatir.

## 2. Tujuan

1. **Demo siap pakai:** reviewer bisa masuk dan memutar lagu pertama dalam **≤ 3 klik / ≤ 15 detik** dari membuka URL.
2. **Pemutar tidak terputus:** audio tetap berjalan tanpa jeda/reset saat berpindah antar halaman (100% skenario navigasi internal).
3. **Alur inti lengkap end-to-end:** upload → muncul di beranda/album/artis → bisa diputar, dicari, di-like, dan dimasukkan ke playlist.
4. **Data demo realistis:** minimal **15 lagu, 4 album, 4 artis** ter-seed dengan cover, agar beranda tidak kosong saat pertama dibuka.
5. **Kualitas teknis terlihat:** Lighthouse Performance ≥ 85 dan Accessibility ≥ 90 pada beranda (mobile), tanpa error console pada alur utama.

## 3. Bukan Tujuan (Non-Goals)

| Di luar MVP | Alasan |
|---|---|
| Registrasi / lupa password / login sosial | Akun demo sudah cukup untuk portofolio; hemat waktu dan hindari menyimpan data pribadi |
| Aplikasi mobile native | Versi pertama web; desain responsif sudah cukup |
| Rekomendasi / algoritma personalisasi | Butuh data perilaku yang tidak ada; nilai portofolio kecil dibanding biayanya |
| Streaming adaptif (HLS), transcoding, normalisasi volume | Kompleksitas infrastruktur tinggi; MVP cukup memutar file audio langsung dari Storage |
| Fitur sosial (follow, komentar, bagikan, profil publik) | Bukan inti alur dengar-musik |
| Pembayaran, langganan, iklan | Tidak relevan untuk portofolio |
| Lirik tersinkron, equalizer, crossfade | Nilai tambah kecil terhadap risiko waktu |
| Moderasi konten & hak cipta otomatis | Konten dibatasi ke lagu bebas hak / milik sendiri (lihat Pertanyaan Terbuka) |

## 4. Persona

- **Reviewer (utama)** — membuka demo, ingin cepat melihat fitur dan kualitas. Tidak mau mendaftar.
- **Pendengar demo** — memakai akun demo untuk menjelajah, menyukai lagu, dan membuat playlist.
- **Pengunggah (akun demo)** — mengunggah lagu untuk menunjukkan alur upload.

> Di MVP, semua persona memakai **satu akun demo yang sama**. Konsekuensinya dibahas di Pertanyaan Terbuka.

## 5. Prioritas Fitur

| # | Fitur | Prioritas |
|---|---|---|
| F1 | Login akun demo | **Wajib (P0)** |
| F2 | Pemutar global + antrean persisten | **Wajib (P0)** |
| F3 | Beranda | **Wajib (P0)** |
| F4 | Halaman album & artis | **Wajib (P0)** |
| F5 | Upload lagu (judul, artis, album, cover) | **Wajib (P0)** |
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
| F17 | Registrasi pengguna nyata + RLS per pengguna | Nanti (P2) |

> **Catatan F2 vs F11:** *Repeat* dan *shuffle* sangat dekat dengan inti pemutar dan murah dikerjakan bersamaan dengan antrean. Jika waktu cukup, kerjakan di fase yang sama; tidak memblokir rilis.

---

## 6. User Story & Acceptance Criteria

### F1 — Login akun demo

**Story:** Sebagai reviewer, saya ingin masuk dengan satu klik memakai akun demo agar saya bisa mencoba aplikasi tanpa mendaftar.

**Acceptance criteria**
- [ ] Halaman login menampilkan tombol **"Masuk sebagai Demo"** yang langsung melakukan sign-in ke akun demo Supabase tanpa mengetik apa pun.
- [ ] Setelah berhasil, pengguna diarahkan ke beranda dan sesi bertahan setelah refresh.
- [ ] Pengguna yang belum login dan membuka halaman lain dialihkan ke halaman login.
- [ ] Ada tombol **Keluar**; setelah keluar, audio berhenti dan antrean dikosongkan.
- [ ] Jika sign-in gagal (jaringan/Supabase down), muncul pesan error yang jelas dan tombol bisa dicoba ulang.
- [ ] Kredensial akun demo **tidak** hardcoded di bundle klien yang bisa dibaca sebagai teks biasa selain yang memang dibutuhkan untuk sign-in; service-role key **tidak pernah** dikirim ke klien.

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

**Story:** Sebagai pengunggah, saya ingin mengunggah lagu beserta judul, artis, album, dan cover agar koleksi saya muncul di aplikasi.

**Acceptance criteria**
- [ ] Formulir upload berisi: file audio (wajib), judul (wajib), artis (wajib), album (opsional), cover (opsional).
- [ ] Field artis & album berupa input dengan saran dari data yang ada; mengetik nama baru membuat entri baru, nama yang sudah ada **dipakai ulang** (tanpa duplikat, pencocokan tidak peka huruf besar/kecil).
- [ ] Format audio diterima: **MP3, M4A/AAC, WAV/OGG** (ditetapkan di implementasi); ukuran maksimal **15 MB**; cover: JPG/PNG/WebP maksimal **2 MB**. Pelanggaran ditolak sebelum upload dengan pesan spesifik.
- [ ] Durasi lagu dibaca dari file dan disimpan.
- [ ] Indikator progres upload tampil; tombol kirim dinonaktifkan selama proses agar tidak terkirim ganda.
- [ ] Given upload sukses, Then lagu langsung tampil di beranda, halaman artis, dan album terkait tanpa refresh manual, dan pengguna melihat konfirmasi.
- [ ] Given upload gagal di tengah jalan, Then tidak tersisa data setengah jadi (baris DB tanpa file, atau file tanpa baris); pengguna mendapat pesan error dan bisa mengulang.
- [ ] Jika cover tidak diunggah, cover album dipakai; jika tidak ada keduanya, tampil placeholder konsisten.
- [ ] Bucket Storage: audio dan cover dipisah; nama file di-sanitasi/diacak (UUID) sehingga nama asli dan karakter aneh tidak menimbulkan tabrakan.
- [ ] Hanya pengguna yang login dapat mengunggah (diterapkan di RLS/policy, bukan hanya di UI).
- [ ] Peringatan di UI: "Unggah hanya musik yang kamu punya haknya."

### F6 — Pencarian

**Story:** Sebagai pendengar, saya ingin mencari lagu, album, dan artis agar saya cepat menemukan yang saya mau.

**Acceptance criteria**
- [ ] Kolom pencarian selalu dapat diakses (header); hasil di `/cari?q=...` sehingga URL dapat dibagikan dan tombol Back berfungsi.
- [ ] Hasil dikelompokkan: **Lagu**, **Album**, **Artis**; pencarian cocok pada sebagian kata, tidak peka huruf besar/kecil, dan mencakup judul lagu serta nama artis/album.
- [ ] Input di-*debounce* (≈300 ms); permintaan lama dibatalkan agar hasil lama tidak menimpa hasil baru.
- [ ] Given tidak ada hasil, Then tampil "Tidak ada hasil untuk '…'" dengan saran.
- [ ] Query kosong tidak mengirim permintaan; karakter khusus (`%`, `_`, `'`) tidak merusak query maupun menyebabkan injeksi.
- [ ] Mengeklik hasil lagu memutarnya tanpa mengganggu navigasi; pemutar tetap berjalan saat pindah ke halaman hasil.

### F7 — Like lagu

**Story:** Sebagai pendengar, saya ingin menyukai lagu agar saya bisa menemukannya lagi dengan mudah.

**Acceptance criteria**
- [ ] Ikon hati tersedia di baris lagu dan di bar pemutar; status sinkron di semua tempat untuk lagu yang sama.
- [ ] Toggle bersifat *optimistic*: UI berubah seketika; jika server gagal, UI dikembalikan dan toast error muncul.
- [ ] Like disimpan per pengguna, unik per (pengguna, lagu); klik cepat berulang tidak membuat duplikat.
- [ ] Halaman **Lagu Disukai** (`/disukai`) menampilkan semua lagu yang disukai, bisa diputar; empty state jika belum ada.
- [ ] Meng-unlike lagu di halaman Lagu Disukai menghapusnya dari daftar tanpa menghentikan pemutaran.
- [ ] Hanya pemilik yang dapat membaca/menulis like-nya (RLS).

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

### F9 — Seed data demo

**Story:** Sebagai reviewer, saya ingin aplikasi sudah berisi musik agar saya tidak perlu mengunggah apa pun sebelum bisa menilai.

**Acceptance criteria**
- [ ] Skrip seed idempoten (dijalankan ulang tidak membuat duplikat) menghasilkan ≥ 15 lagu, ≥ 4 album, ≥ 4 artis, lengkap dengan cover.
- [ ] Semua audio seed berlisensi bebas (CC0 / royalty-free / karya sendiri); sumber dan lisensi dicatat di `README`.
- [ ] Minimal 1 playlist contoh dan beberapa lagu tersuka tersedia.

---

## 7. Persyaratan Non-Fungsional

- **Keamanan:** RLS aktif di semua tabel; service-role key hanya di server; validasi tipe & ukuran file dilakukan di klien **dan** di sisi server/policy bucket.
- **Performa:** First Contentful Paint beranda ≤ 2 s di jaringan 4G; audio mulai terdengar ≤ 2 s setelah klik play (file ≤ 15 MB, Storage publik/signed URL).
- **Aksesibilitas:** semua kontrol pemutar dapat dioperasikan dengan keyboard, punya label ARIA, dan kontras warna memenuhi WCAG AA.
- **Kompatibilitas:** Chrome, Firefox, Safari, Edge versi terbaru; viewport 360 px hingga desktop. Safari/iOS diuji khusus untuk kebijakan autoplay.
- **Biaya:** tetap di free tier Supabase; batas ukuran upload + batas jumlah lagu per akun demo melindungi kuota Storage.

## 8. Model Data (garis besar)

`artists(id, name, image_url)` · `albums(id, title, artist_id, cover_url, year)` · `songs(id, title, artist_id, album_id?, audio_path, cover_path?, duration_sec, created_by, created_at)` · `likes(user_id, song_id, created_at; PK gabungan)` · `playlists(id, user_id, name, description, created_at)` · `playlist_songs(playlist_id, song_id, position, added_at; unik gabungan)`

Storage: bucket `audio`, bucket `covers`.

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

**Indikator tambahan (opsional, 1–3 bulan)**
- Jumlah kunjungan/klik dari tautan portofolio (jika memasang analitik ringan).
- Umpan balik dari reviewer/rekan.

## 10. Pertanyaan Terbuka

| # | Pertanyaan | Pemilik | Sifat |
|---|---|---|---|
| 1 | Apakah semua pengunjung berbagi **satu akun demo**? Like/playlist akan saling timpa dan terlihat orang lain. Alternatif: sign-in anonim Supabase per pengunjung atau reset berkala. | Pemilik proyek | **Blocking** (menentukan skema auth & RLS) |
| 2 | Apakah upload terbuka untuk semua pengunjung demo? Risiko: spam, konten berhak cipta, kuota Storage penuh. Opsi: batasi per akun, batasi total, atau hanya seed + upload lewat akun admin. | Pemilik proyek | **Blocking** |
| 3 | Sumber audio seed dan lisensinya (mis. Free Music Archive, Pixabay, karya sendiri). | Pemilik proyek | Non-blocking |
| 4 | Audio disajikan lewat bucket publik atau signed URL? Publik lebih sederhana; signed URL lebih terkendali tetapi perlu penyegaran URL pada antrean panjang. | Engineering | Non-blocking |
| 5 | Pustaka state pemutar: Context vs Zustand? | Engineering | Non-blocking |
| 6 | Perlukah data demo di-reset otomatis (cron) untuk membersihkan unggahan pengunjung? | Pemilik proyek | Non-blocking |

## 11. Pertimbangan Jadwal & Fase

Tidak ada tenggat keras yang diketahui. Urutan pengerjaan yang disarankan (tiap fase menghasilkan sesuatu yang bisa didemokan):

1. **Fase 1 — Fondasi:** setup Next.js + Tailwind + Supabase, skema DB + RLS, F1 (login demo), F9 (seed).
2. **Fase 2 — Inti mendengar:** F3 (beranda), F4 (album & artis), **F2 (pemutar global)**. *Pemutar adalah risiko teknis terbesar dan pembeda utama — kerjakan lebih awal.*
3. **Fase 3 — Interaksi:** F6 (pencarian), F7 (like), F8 (playlist).
4. **Fase 4 — Konten:** F5 (upload) beserta batas dan penanganan kegagalan.
5. **Fase 5 — Poles & rilis:** uji end-to-end, aksesibilitas, Lighthouse, README (screenshot, lisensi audio, tautan demo), deploy (mis. Vercel). Setelah itu ambil item P1 sesuai waktu.

**Definisi selesai MVP:** semua F1–F9 memenuhi acceptance criteria, uji end-to-end lulus, demo ter-deploy dengan seed data, dan README tersedia.
