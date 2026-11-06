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
3. **Alur inti lengkap end-to-end, dua jalur konten:** lagu katalog publik (diisi admin lewat skrip seed) muncul di beranda/album/artis; lagu yang diunggah pengunjung muncul di `/library` miliknya saja. Keduanya bisa diputar, dicari, di-like, dan dimasukkan ke playlist.
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
| Upload publik oleh pengunjung / katalog kontribusi pengguna | Mencegah spam dan masalah hak cipta; katalog sengaja hanya diisi admin |
| Form/panel admin di MVP | Katalog diisi lewat skrip seed dengan service role; form upload admin (opsi "Katalog publik") masuk P1 (F19); UI moderasi tidak diperlukan |

## 4. Persona

- **Pengunjung anonim / reviewer (utama)** — membuka demo, ingin cepat melihat fitur dan kualitas. Tidak mau mendaftar. Masuk lewat "Coba tanpa daftar", mendapat identitas anonim sendiri, bisa menyukai lagu, membuat playlist, dan mengunggah lagu ke library pribadi (dengan batas).
- **Admin (pemilik proyek)** — satu-satunya yang boleh mengisi katalog publik (lagu, album, artis). Di MVP lewat skrip seed dengan service role, bukan lewat UI.

> Keputusan: tiap pengunjung memakai **user anonim Supabase miliknya sendiri**. Katalog dibagi bersama dan read-only; like, playlist, dan lagu pribadi adalah milik masing-masing user dan dilindungi RLS.

## 5. Prioritas Fitur

| # | Fitur | Prioritas |
|---|---|---|
| F1 | Sign-in anonim "Coba tanpa daftar" + CAPTCHA | **Wajib (P0)** |
| F2 | Pemutar global + antrean persisten | **Wajib (P0)** |
| F3 | Beranda | **Wajib (P0)** |
| F4 | Halaman album & artis | **Wajib (P0)** |
| F5 | Upload lagu pengunjung ke library pribadi (judul, artis, album, cover; MP3, ≤ 10 MB, ≤ 3 lagu, hapus otomatis 24 jam) | **Wajib (P0)** |
| F6 | Pencarian | **Wajib (P0)** |
| F7 | Like lagu + halaman "Lagu Disukai" | **Wajib (P0)** |
| F8 | Playlist (buat, tambah/hapus lagu, putar; maks 20 playlist per user, 200 lagu per playlist) | **Wajib (P0)** |
| F9 | Seed katalog publik (skrip + service role) | **Wajib (P0)** — pendukung |
| F10 | Antrean: reorder via drag, "putar berikutnya" | Nanti (P1) |
| F11 | Mode acak & ulang (shuffle/repeat) | Nanti (P1) — *lihat catatan di F2* |
| F12 | Edit / hapus lagu yang diunggah | Nanti (P1) |
| F13 | Ingat posisi terakhir pemutar setelah refresh | Nanti (P1) |
| F14 | Media Session API (kontrol layar kunci / tombol media) | Nanti (P1) |
| F15 | Pintasan keyboard (spasi, panah) | Nanti (P1) |
| F16 | Tema terang/gelap | Nanti (P2) |
| F17 | Upgrade akun anonim ke akun email tanpa kehilangan data | Nanti (P1) |
| F18 | Pembersihan otomatis: akun anonim tidak aktif 7 hari & upload pribadi > 24 jam | **Wajib (P0)** — pendukung |
| F19 | Akun admin + form upload admin (opsi "Katalog publik") | Nanti (P1) |
| F20 | Keep-alive harian agar proyek Supabase free tier tidak di-pause (GitHub Actions) | **Wajib (P0)** — pendukung |

> **Catatan F2 vs F11:** *Repeat* dan *shuffle* sangat dekat dengan inti pemutar dan murah dikerjakan bersamaan dengan antrean. Jika waktu cukup, kerjakan di fase yang sama; tidak memblokir rilis.

---

## 6. User Story & Acceptance Criteria

### F1 — Sign-in anonim "Coba tanpa daftar"

**Story:** Sebagai reviewer, saya ingin masuk dengan satu klik tanpa mendaftar agar saya bisa mencoba aplikasi dengan like dan playlist milik saya sendiri, tidak tercampur dengan pengunjung lain.

**Acceptance criteria**
- [ ] Halaman masuk menampilkan tombol **"Coba tanpa daftar"** yang memanggil sign-in anonim Supabase tanpa input apa pun dari pengguna.
- [ ] **CAPTCHA aktif** untuk sign-in anonim di pengaturan Supabase Auth; permintaan tanpa token CAPTCHA valid **ditolak oleh server** (bukan hanya disembunyikan di UI). Penyedia: **Cloudflare Turnstile, mode tak terlihat**.
- [ ] Setiap browser/pengunjung mendapat user anonim berbeda (`is_anonymous = true`); sesi bertahan setelah refresh dan setelah tab ditutup selama penyimpanan browser tidak dihapus.
- [ ] Given dua pengunjung berbeda, When pengunjung A menyukai lagu dan membuat playlist, Then pengunjung B tidak dapat melihat atau mengubahnya (RLS, diuji lewat API langsung, bukan hanya UI).
- [ ] Katalog (songs publik, albums, artists) dapat dibaca semua user ter-autentikasi termasuk anonim, tetapi **INSERT/UPDATE/DELETE katalog ditolak untuk semua user klien** (anonim maupun terdaftar), termasuk lewat panggilan API langsung; hanya skrip seed dengan service role yang dapat menulis.
- [ ] Pengguna tanpa sesi yang membuka halaman lain dialihkan ke halaman masuk.
- [ ] Ada tombol **Keluar**. Karena akun anonim tidak bisa dipulihkan, muncul dialog konfirmasi: "Like, playlist, dan lagu pribadi akan hilang." Konfirmasi → audio berhenti, antrean kosong, sesi berakhir; batal → tidak ada perubahan.
- [ ] Info singkat di UI: "Mode tamu — data dihapus otomatis setelah 7 hari tidak aktif."
- [ ] Jika sign-in gagal (jaringan, CAPTCHA gagal, rate limit), muncul pesan jelas dan tombol coba lagi; tidak ada loop otomatis.
- [ ] Di MVP **tidak ada akun admin atau UI admin** di aplikasi; katalog diisi lewat skrip seed (F9). Akun admin (role `admin` di `app_metadata`, tidak bisa diubah user sendiri) disiapkan di P1 (F19).
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

**Catatan teknis:** state pemutar disimpan di **Zustand** (store global yang dipakai dari layout root), dan **satu elemen audio berada di luar siklus render React** (instance singleton yang dibuat sekali di modul/store, bukan elemen JSX sehingga tidak ikut ter-unmount atau dibuat ulang saat render ulang); semua navigasi memakai `next/link`. Pastikan tidak ada `window.location` / full reload pada navigasi internal.

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

**Story (pengunjung):** Sebagai pengunjung, saya ingin mengunggah lagu ke library pribadi agar saya bisa mencoba alur upload tanpa memengaruhi katalog publik.

**Acceptance criteria — umum**
- [ ] Formulir upload berisi: file audio (wajib), judul (wajib), artis (wajib), album (opsional), cover (opsional; JPG/PNG/WebP, maks 2 MB).
- [ ] Durasi lagu dibaca dari file dan disimpan.
- [ ] Indikator progres upload tampil; tombol kirim dinonaktifkan selama proses agar tidak terkirim ganda.
- [ ] Given upload gagal di tengah jalan, Then tidak tersisa data setengah jadi (baris DB tanpa file, atau file tanpa baris); pengguna mendapat pesan error dan bisa mengulang.
- [ ] Nama file di Storage diacak (UUID); nama asli hanya disimpan sebagai metadata.
- [ ] Jika cover tidak diunggah, tampil placeholder konsisten.

**Acceptance criteria — pengunjung → library pribadi** *(F5 di MVP hanya mencakup jalur ini; upload admin ke katalog publik ada di F19, P1)*
- [ ] Tujuan unggahan pengunjung terkunci ke **Library pribadi**; ada halaman `/library` berisi lagu pribadi miliknya, dapat diputar, di-like, dan ditambahkan ke playlist.
- [ ] **Hanya MP3**: ditolak jika ekstensi bukan `.mp3`, MIME bukan `audio/mpeg`, atau header file bukan MP3 yang valid (diperiksa di sisi server, bukan hanya nama file).
- [ ] **Maks 10 MB per file**; file lebih besar ditolak sebelum diunggah dan juga ditolak oleh batas bucket/policy.
- [ ] **Maks 3 lagu aktif per akun** (lagu yang belum kedaluwarsa). Given sudah 3 lagu aktif, Then form dinonaktifkan dengan pesan jelas; penegakan di DB/RPC sehingga dua upload paralel tidak bisa melampaui 3.
- [ ] **Batas penyimpanan pribadi global 500 MB**: total ukuran semua lagu pribadi yang barisnya masih ada (termasuk yang sudah kedaluwarsa tetapi belum dihapus job); reservasi yang belum selesai dihitung 10 MB. Hanya byte audio yang dihitung, cover tidak. Given batas penuh, Then **upload pengunjung ditutup sementara**: form dinonaktifkan dengan pesan "Upload sedang ditutup sementara karena penyimpanan penuh. Coba lagi nanti.", dan permintaan lewat API langsung ditolak database (`storage_full`). Upload terbuka kembali otomatis setelah job pembersih membebaskan ruang. Nilai batas dapat diubah pemilik proyek lewat SQL tanpa mengubah kode.
- [ ] Menghapus lagu pribadi secara manual membebaskan slot dan menghapus file Storage-nya.
- [ ] UI menampilkan slot terpakai (mis. "2/3") dan waktu sisa sebelum tiap lagu terhapus.
- [ ] Setiap lagu pribadi memiliki `expires_at = waktu upload + 24 jam`. Setelah itu lagu **tidak dapat dibaca** (RLS/query memfilter `expires_at > now()`) dan signed URL-nya ditolak, walaupun job pembersih belum berjalan.
- [ ] Lagu pribadi **hanya terlihat oleh pemiliknya**: tidak muncul di beranda, halaman album/artis, atau pencarian user lain. Diuji: user B tidak bisa SELECT baris maupun mengunduh objek milik user A.
- [ ] Artis dan album lagu pribadi disimpan sebagai **teks pada lagu itu**, tidak membuat entri di tabel `artists`/`albums` publik, dan tidak punya halaman artis/album.
- [ ] Audio pribadi disajikan lewat **signed URL yang dibuat saat lagu akan diputar** (bukan saat daftar dimuat), **berlaku 1 jam**, dari bucket privat berfolder per user. Lagu di antrean mendapat URL baru ketika gilirannya tiba, sehingga antrean panjang tidak memakai URL basi.
- [ ] Given lagu pribadi kedaluwarsa saat sedang diputar, Then lagu itu dibiarkan selesai (aplikasi tidak menghentikannya), lalu lagu pribadi kedaluwarsa lain di antrean dilewati.
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
- [ ] **Maks 20 playlist per user** dan **maks 200 lagu per playlist**, ditegakkan di database (trigger, aman terhadap permintaan paralel; bukan hanya di UI). Given batas tercapai, Then aksi ditolak dengan pesan jelas ("Batas 20 playlist tercapai" / "Playlist penuh (200 lagu)") dan tombol terkait dinonaktifkan. Menghapus playlist atau lagu membebaskan ruang seketika.
- [ ] Hitungan 200 lagu mencakup baris lagu pribadi yang sudah kedaluwarsa tetapi belum dihapus job (paling lama ±75 menit); ini disengaja agar penghitungan sederhana.

### F9 — Seed data demo

**Story:** Sebagai reviewer, saya ingin aplikasi sudah berisi musik agar saya tidak perlu mengunggah apa pun sebelum bisa menilai.

**Acceptance criteria**
- [ ] Skrip seed idempoten (dijalankan ulang tidak membuat duplikat) menghasilkan ≥ 15 lagu, ≥ 4 album, ≥ 4 artis, lengkap dengan cover.
- [ ] Sumber audio seed (Free Music Archive dan Incompetech/Kevin MacLeod): **hanya CC0 1.0, CC BY 4.0, atau CC BY-SA 4.0**, dicek di halaman lagu itu sendiri (bukan hanya halaman album). **NC, ND, dan FMA-Limited dilarang**; Pixabay tidak dipakai (melarang distribusi "standalone", tidak cocok untuk aplikasi streaming). Skrip seed menolak lisensi lain. Sumber (URL halaman lagu), lisensi, dan **kredit** tiap lagu dicatat di `README` dan **ditampilkan di aplikasi** (halaman album/lagu dan halaman `/kredit`), sebagaimana dipersyaratkan CC BY dan CC BY-SA.
- [ ] **Aturan format katalog** (berlaku juga untuk F19): hanya **MP3 dan M4A**, maks **15 MB** per file, disarankan **128–192 kbps**. Skrip seed menolak file di luar aturan ini dengan pesan jelas.
- [ ] Seed dimasukkan ke **katalog publik** lewat **skrip seed dengan service role** (dijalankan lokal/CI, tidak pernah lewat klien). Ini satu-satunya cara mengisi katalog di MVP.
- [ ] Seed tidak mencakup like atau playlist (itu milik tiap user); empty state Lagu Disukai, Playlist, dan Library pribadi harus tampak baik untuk pengunjung baru.

### F19 — Akun admin + form upload admin (Nanti, P1)

**Story:** Sebagai admin, saya ingin mengunggah lagu beserta judul, artis, album, dan cover ke katalog publik lewat UI agar saya tidak perlu menjalankan skrip seed setiap kali menambah musik.

**Acceptance criteria**
- [ ] Akun admin berupa akun email dengan role `admin` di `app_metadata`; tidak ada tautan ke login admin di UI publik.
- [ ] Hanya user dengan role `admin` melihat opsi tujuan **"Katalog publik"** pada form upload; di UI pengunjung opsi ini tidak ada.
- [ ] Field artis & album berupa input dengan saran dari data yang ada; nama baru membuat entri baru, nama yang sudah ada **dipakai ulang** (tanpa duplikat, tidak peka huruf besar/kecil).
- [ ] Aturan format katalog sama dengan F9: **MP3 dan M4A saja** (OGG tidak didukung karena dukungan Safari tidak konsisten), maks **15 MB**, disarankan **128–192 kbps**; file di luar aturan ditolak dengan pesan jelas. Tanpa batas jumlah dan tidak kedaluwarsa.
- [ ] Given upload sukses, Then lagu langsung tampil di beranda dan halaman artis/album terkait tanpa refresh manual.
- [ ] Given user non-admin memanggil API langsung untuk menulis ke tabel katalog atau bucket publik, Then permintaan **ditolak** oleh RLS/policy Storage.

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
- [ ] Job terjadwal berjalan **harian**: menghapus user anonim dengan `last_seen_at` ≥ 7 hari lalu beserta seluruh data dan file Storage-nya.
- [ ] `last_seen_at` adalah kolom sendiri (tabel `profiles`), **diperbarui aplikasi maksimal 1× per jam per user** (bukan di setiap request); user baru langsung memiliki `last_seen_at` saat sign-in anonim.
- [ ] User non-anonim (admin, akun hasil upgrade) dan lagu katalog publik **tidak pernah** tersentuh job.
- [ ] Job idempoten dan aman dijalankan ulang; urutan penghapusan menjamin tidak ada baris atau file yatim, dan kegagalan dicatat di log.
- [ ] Diuji dengan data fixture berumur >24 jam dan >7 hari: yang kedaluwarsa terhapus, yang belum tetap ada.

### F20 — Keep-alive harian (GitHub Actions)

**Story:** Sebagai pemilik proyek, saya ingin proyek Supabase free tier tidak di-pause karena tidak aktif agar demo portofolio selalu bisa dibuka reviewer.

**Dasar (kebijakan Supabase, dicek 2026-11-05):** proyek Free Plan yang menunjukkan aktivitas rendah selama 7 hari di-pause otomatis; "beberapa permintaan ke database setiap hari" dinyatakan cukup untuk mencegahnya; ada email peringatan sekitar seminggu sebelumnya; proyek yang di-pause dapat dipulihkan hingga 1 tahun; proyek berbayar tidak di-pause. Sumber: <https://supabase.com/docs/guides/platform/free-project-pausing>. Karena job pembersih (F18) berjalan di dalam database, **tidak dapat diandalkan sebagai aktivitas "pengguna"**; keep-alive harus berupa permintaan API dari luar.

**Acceptance criteria**
- [ ] Workflow GitHub Actions terjadwal **harian** (plus `workflow_dispatch` untuk uji manual) memanggil `POST {SUPABASE_URL}/rest/v1/rpc/ping` dengan anon key.
- [ ] `ping()` adalah fungsi **hanya-baca** yang benar-benar membaca tabel (agar terhitung aktivitas database) dan hanya mengembalikan `{ ok, ts }`; tidak ada data pengguna yang terbuka. Fungsi ini boleh dipanggil role `anon`; tidak ada akses tabel lain untuk `anon`.
- [ ] Workflow tidak memakai service-role key. Secret yang dibutuhkan: `SUPABASE_URL` dan `SUPABASE_ANON_KEY`; bila belum diatur, workflow berhenti dengan pesan jelas (bukan gagal merah).
- [ ] Permintaan dicoba ulang hingga 3 kali; bila tetap non-2xx, workflow **gagal** sehingga GitHub mengirim notifikasi ke pemilik.
- [ ] Dokumentasi di README: cara mengisi secret, dan peringatan bahwa GitHub dapat menonaktifkan workflow terjadwal pada repositori publik yang tidak aktif lama (cek ulang di dokumentasi GitHub; commit berkala atau jalankan manual bila perlu).
- [ ] Bila proyek dipindah ke paket berbayar, workflow ini boleh dimatikan.

---

## 7. Persyaratan Non-Fungsional

- **Keamanan:** RLS aktif di semua tabel dan bucket; service-role key hanya di server; tidak ada policy tulis katalog untuk klien di MVP (hanya service role lewat skrip seed; role admin di `app_metadata` baru dipakai di P1); CAPTCHA wajib untuk sign-in anonim; semua batas upload (format, ukuran, jumlah, kedaluwarsa) ditegakkan **di server/DB**, bukan hanya di UI; ada uji otomatis yang membuktikan user A tidak bisa membaca data user B.
- **Performa:** First Contentful Paint beranda ≤ 2 s di jaringan 4G; audio mulai terdengar ≤ 2 s setelah klik play (file ≤ 15 MB, Storage publik/signed URL).
- **Aksesibilitas:** semua kontrol pemutar dapat dioperasikan dengan keyboard, punya label ARIA, dan kontras warna memenuhi WCAG AA.
- **Kompatibilitas:** Chrome, Firefox, Safari, Edge versi terbaru; viewport 360 px hingga desktop. Safari/iOS diuji khusus untuk kebijakan autoplay.
- **Biaya:** tetap di free tier Supabase; batas upload pengunjung (10 MB × 3 lagu, hapus 24 jam), pembersihan akun anonim 7 hari, dan CAPTCHA melindungi kuota Storage dan Auth. Batas free tier yang menjadi acuan (dicek 2026-11-05): database 500 MB, Storage 1 GB, egress 5 GB, Edge Function 500.000 invokasi; angka ini perlu dicek ulang saat rilis. Anggaran Storage: lagu pribadi ≤ 500 MB (batas global F5) + katalog seed (≥ 15 lagu, ≤ 15 MB per file) + cover, seluruhnya di bawah 1 GB. Proyek Free di-pause bila aktivitas database rendah 7 hari, ditangani F20.

## 8. Model Data (garis besar)

`artists(id, name, image_url)` · `albums(id, title, artist_id, cover_url, year)` · `songs(id, title, visibility['public'|'private'], owner_id?, artist_id?, album_id?, artist_name?, album_name?, audio_path, cover_path?, duration_sec, expires_at?, created_at)` · `likes(user_id, song_id, created_at; PK gabungan)` · `playlists(id, user_id, name, description, created_at)` · `playlist_songs(playlist_id, song_id, position, added_at; unik gabungan)` · `profiles(user_id, last_seen_at)`

- Lagu `public`: `owner_id` kosong, `expires_at` kosong, memakai `artist_id`/`album_id`; di MVP hanya service role (skrip seed) yang menulis; admin via UI di P1.
- Lagu `private`: `owner_id = auth.uid()`, `expires_at = created_at + 24 jam`, artis/album sebagai teks (`artist_name`/`album_name`); terbaca hanya jika `owner_id = auth.uid() AND expires_at > now()`.
- `likes`, `playlists`, `playlist_songs`, dan lagu pribadi memakai `ON DELETE CASCADE` ke `auth.users` dan ke `songs`, sehingga penghapusan akun anonim atau lagu kedaluwarsa membersihkan semua turunannya.

- `app_limits(id, private_storage_cap_bytes)`: tabel satu baris untuk batas global (default 500 MB), tanpa akses klien.

Storage: bucket publik `audio` & `covers` (tulis hanya service role di MVP); bucket privat `user-audio` & `user-covers` dengan path `{user_id}/{uuid}` dan policy berbasis folder; audio privat diakses lewat signed URL.

## 9. Metrik Keberhasilan

Karena ini portofolio, metrik diukur dengan daftar periksa dan uji manual, bukan analitik pengguna.

**Indikator utama (diukur saat rilis)**
| Metrik | Target |
|---|---|
| Klik dari URL sampai lagu terdengar | ≤ 3 klik |
| Skenario navigasi yang memutus audio | 0 dari seluruh rute (uji manual semua rute) |
| Alur P0 lulus uji end-to-end (Playwright) | 100% (masuk anonim + CAPTCHA, putar+navigasi, upload pribadi, cari, like, playlist, isolasi data antar dua pengunjung) |
| Lighthouse beranda mobile (Perf / A11y) | ≥ 85 / ≥ 90 |
| Error tak tertangani di console pada alur utama | 0 |
| Uji RLS: user A tidak dapat membaca/menulis like, playlist, lagu pribadi user B | 100% lulus |
| Uji batas upload pengunjung (non-MP3, >10 MB, lagu ke-4, paralel, tulis katalog publik) ditolak server | 100% ditolak |
| Uji pembersihan (fixture >24 jam & >7 hari) | 100% lulus |
| Uji batas: playlist ke-21, lagu ke-201 per playlist, dan upload saat batas global 500 MB penuh ditolak database, termasuk pada permintaan paralel | 100% ditolak |
| Keep-alive harian berjalan dan ping sukses (cek riwayat workflow) | ≥ 6 dari 7 hari terakhir |

**Indikator tambahan (opsional, 1–3 bulan)**
- Jumlah kunjungan/klik dari tautan portofolio (jika memasang analitik ringan).
- Umpan balik dari reviewer/rekan.

## 10. Keputusan & Pertanyaan Terbuka

### Keputusan (final)

1. **Auth:** Supabase anonymous sign-in per pengunjung lewat tombol "Coba tanpa daftar", CAPTCHA aktif. Akun anonim tidak aktif 7 hari dihapus otomatis. Upgrade ke akun email tanpa kehilangan data → fase Nanti (F17).
2. **Data:** katalog (songs publik, albums, artists) dibagi bersama dan read-only; likes dan playlists milik tiap user, dilindungi RLS.
3. **Upload:** katalog publik hanya bisa diisi admin. Pengunjung boleh upload ke library pribadi yang hanya terlihat olehnya: MP3 saja, maks 10 MB per file, maks 3 lagu per akun, otomatis terhapus setelah 24 jam.
4. **Admin di MVP:** katalog diisi hanya lewat skrip seed dengan service role. Akun admin dan form upload admin ("Katalog publik") dipindah ke P1 (F19); F5 di MVP hanya mencakup upload pengunjung.
5. **CAPTCHA:** Cloudflare Turnstile, mode tak terlihat.
6. **Signed URL:** dibuat saat lagu akan diputar, berlaku 1 jam.
7. **Aktivitas akun:** kolom `last_seen_at` sendiri, diperbarui maksimal 1× per jam; dasar penghapusan akun anonim tidak aktif 7 hari.
8. **Lagu pribadi kedaluwarsa saat diputar:** dibiarkan selesai; lagu kedaluwarsa lain di antrean dilewati.
9. **Format katalog (F9 dan F19):** MP3 dan M4A saja (OGG dihapus karena dukungan Safari tidak konsisten), maks 15 MB, disarankan 128–192 kbps.
10. **Sumber seed (dikoreksi):** hanya **CC0 1.0, CC BY 4.0, atau CC BY-SA 4.0** dari Free Music Archive dan Incompetech/Kevin MacLeod; NC, ND, dan FMA-Limited dilarang. Pixabay dicoret karena lisensinya melarang distribusi "standalone" (tidak cocok untuk aplikasi streaming). Sumber, lisensi, dan kredit tiap lagu dicatat di README dan ditampilkan di aplikasi (halaman album/lagu dan `/kredit`).
11. **State pemutar:** Zustand, dengan satu elemen audio di luar siklus render React.
12. **Batas penyimpanan pribadi global:** 500 MB; bila penuh, upload pengunjung ditutup sementara dengan pesan jelas (F5).
13. **Batas playlist:** maks 20 playlist per user dan 200 lagu per playlist, ditegakkan di database (F8).
14. **Keep-alive:** kebijakan pause proyek Free berlaku (7 hari aktivitas rendah), sehingga ditambahkan keep-alive harian lewat GitHub Actions yang memanggil fungsi `ping()` ringan (F20).
15. **Perubahan arsitektur yang disetujui:** status `pending` + TTL reservasi 15 menit (validasi isi file sebelum publikasi); jeda 15 menit sebelum penghapusan fisik lagu kedaluwarsa; hapus manual membebaskan slot seketika dan file dihapus segera; penjadwal memakai `pg_cron` + Edge Function; kolom/tabel `songs.seed_key`, `profiles.status`, `job_leases`, `app_limits`; M4A hanya untuk katalog publik. Rinciannya di `docs/architecture.md`.

### Pertanyaan terbuka

| # | Pertanyaan | Pemilik | Sifat |
|---|---|---|---|
| 1 | Untuk F19 (P1): bagaimana login admin diakses (rute tersembunyi vs hanya lokal)? | Engineering | Non-blocking, dibahas saat F19 dikerjakan |

## 11. Pertimbangan Jadwal & Fase

Tidak ada tenggat keras yang diketahui. Urutan pengerjaan yang disarankan (tiap fase menghasilkan sesuatu yang bisa didemokan):

1. **Fase 1 — Fondasi:** setup Next.js + Tailwind + Supabase, skema DB + RLS (termasuk visibilitas lagu, tabel `profiles`, dan tanpa policy tulis katalog untuk klien), F1 (sign-in anonim + CAPTCHA), F9 (seed lewat skrip dengan service role), F20 (keep-alive harian).
2. **Fase 2 — Inti mendengar:** F3 (beranda), F4 (album & artis), **F2 (pemutar global)**. *Pemutar adalah risiko teknis terbesar dan pembeda utama — kerjakan lebih awal.*
3. **Fase 3 — Interaksi:** F6 (pencarian), F7 (like), F8 (playlist).
4. **Fase 4 — Konten:** F5 (upload pribadi pengunjung dengan seluruh batasnya) dan F18 (job pembersihan 24 jam / 7 hari).
5. **Fase 5 — Poles & rilis:** uji end-to-end, aksesibilitas, Lighthouse, README (screenshot, lisensi audio, tautan demo), deploy (mis. Vercel). Setelah itu ambil item P1 sesuai waktu.

**Definisi selesai MVP:** semua F1–F9, F18, dan F20 memenuhi acceptance criteria, uji end-to-end lulus, demo ter-deploy dengan seed data, dan README tersedia.
