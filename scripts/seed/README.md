# Seed katalog publik (F9)

Katalog publik hanya diisi lewat skrip ini (service role); klien tidak punya akses tulis.

## Mengisi katalog

1. Unduh minimal **15 lagu** dari [Pixabay Music](https://pixabay.com/music/) (Pixabay Content License) atau sumber **CC0**. **Jangan** memakai lagu berlisensi NC (non-komersial).
2. Taruh berkas di `scripts/seed/audio/` (MP3 atau M4A, maks 15 MiB, disarankan 128–192 kbps) dan cover di `scripts/seed/covers/` (JPG/PNG/WebP, maks 2 MiB). Dua folder ini **tidak masuk git**.
3. Isi `scripts/seed/catalog.json` (bentuk di bawah): minimal 4 artis, 4 album, 15 lagu; setiap album punya cover, dan setiap lagu punya cover sendiri atau cover albumnya.
4. Validasi tanpa menyentuh jaringan: `npm run seed:check`.
5. Isi database: `npm run seed` (membaca `.env.local`; target non-lokal memerlukan `--yes`).
6. Perbarui tabel sumber/lisensi di README: `node scripts/seed.ts --dry-run --readme`.

```json
{
  "artists": [{ "name": "Nama Artis", "image": "covers/artis.jpg" }],
  "albums":  [{ "artist": "Nama Artis", "title": "Judul Album", "year": 2024, "cover": "covers/album.jpg" }],
  "songs":   [{
    "key": "slug-unik-lagu",
    "title": "Judul Lagu",
    "artist": "Nama Artis",
    "album": "Judul Album",
    "trackNo": 1,
    "file": "audio/lagu.mp3",
    "cover": "covers/lagu.jpg",
    "source": "https://pixabay.com/music/...",
    "license": "Pixabay Content License"
  }]
}
```

`license` hanya boleh `Pixabay Content License` atau `CC0 1.0`. `key` menjadi `seed_key` sehingga menjalankan ulang skrip tidak menggandakan data.

## Aturan yang diperiksa dari isi berkas (bukan sekadar nama)

MP3/M4A saja (OGG tidak didukung: dukungan Safari tidak konsisten), maks 15 MiB, struktur MP3 valid (3 frame Layer III beruntun) atau kotak `ftyp` M4A, bitrate di luar 128–192 kbps menghasilkan **peringatan**, cover valid menurut magic bytes, lisensi dan sumber wajib. Detail dan uji: `scripts/seed/rules.ts`, `npm run test:seed`.

## Catatan

- Berkas yang sudah ada di Storage dengan ukuran sama dilewati; `--force-upload` memaksa unggah ulang.
- Berkas contoh sintetis untuk uji (`make-sample.ts`) berupa MP3 sunyi, bukan musik, dan tidak pernah dipakai sebagai konten katalog.
