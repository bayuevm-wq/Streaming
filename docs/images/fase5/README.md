# Fase 5: katalog asli dan kredit

Dihasilkan oleh workflow manual [`screenshots-katalog`](../../../.github/workflows/screenshots-katalog.yml) (`e2e-preview/fase5.spec.ts`): Supabase lokal di-seed dengan **katalog asli** (`scripts/seed/catalog.json`: 17 lagu, 4 artis, 4 album, lisensi dan kredit asli, durasi asli, sampul buatan sendiri).

**Batas yang jujur:** audio di pipeline ini adalah **pengganti sunyi berdurasi sama**, karena audio asli tidak ada di repo (dan tidak boleh masuk git). Yang tampak di gambar hanya metadata, kredit, sampul, dan durasi, bukan bunyinya.

| Layar | Desktop 1280px | Ponsel 390px |
|---|---|---|
| Beranda | [desktop-beranda.png](desktop-beranda.png) | [ponsel-beranda.png](ponsel-beranda.png) |
| Album "FREE FOR YOU - CC BY" (lisensi campuran) | [desktop-album.png](desktop-album.png) | [ponsel-album.png](ponsel-album.png) |
| Bagian Kredit di halaman album | [desktop-album-kredit.png](desktop-album-kredit.png) | [ponsel-album-kredit.png](ponsel-album-kredit.png) |
| /kredit | [desktop-kredit.png](desktop-kredit.png) | [ponsel-kredit.png](ponsel-kredit.png) |
| /kredit, seluruh daftar (viewport tinggi) | [desktop-kredit-lengkap.png](desktop-kredit-lengkap.png) | [ponsel-kredit-lengkap.png](ponsel-kredit-lengkap.png) |

Perbarui: Actions → `screenshots-katalog` → *Run workflow* (centang `commit` untuk menyimpan ke folder ini), atau unduh artefak `screenshots-katalog`.
