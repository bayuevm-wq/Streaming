# Tangkapan layar Fase 2

Dihasilkan oleh `e2e/screenshots.spec.ts` (Chrome, data contoh sintetis dari CI: sampul 1×1 biru dan MP3 sunyi, bukan konten asli).

| Halaman | Desktop 1280px | Ponsel 390px |
|---|---|---|
| Beranda | [desktop-beranda.png](desktop-beranda.png) | [ponsel-beranda.png](ponsel-beranda.png) |
| Album | [desktop-album.png](desktop-album.png) | [ponsel-album.png](ponsel-album.png) |
| Artis | [desktop-artis.png](desktop-artis.png) | [ponsel-artis.png](ponsel-artis.png) |
| Antrean | [desktop-antrean.png](desktop-antrean.png) | [ponsel-antrean.png](ponsel-antrean.png) |

`ponsel-sebelum-redesain/` menyimpan tampilan ponsel **sebelum** mini-player dan navigasi bawah, sebagai pembanding.

## Memperbarui

Tidak pernah otomatis. Buka **Actions → e2e → Run workflow**, centang `update_screenshots`, jalankan. Workflow menjalankan seluruh E2E lalu meng-commit gambar baru ke cabang yang dipilih. Atau unduh artefak `e2e-hasil` dari run mana pun dan salin isi `shots/`.
