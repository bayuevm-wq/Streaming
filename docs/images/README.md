# Tangkapan layar

Dihasilkan oleh E2E (Chrome, `e2e/screenshots*.spec.ts`) terhadap **data contoh sintetis** CI (sampul biru polos, MP3 sunyi), bukan konten asli. Dua ukuran: **desktop 1280px** dan **ponsel 390px**. Disimpan per fase agar tiap gambar menunjukkan tampilan yang berlaku saat fase itu selesai, lalu diperbarui bila UI berubah (supaya tidak menampilkan teks usang).

| Folder | Isi |
|---|---|
| [`fase2/`](fase2/README.md) | Beranda, album, artis, antrean, player bar / mini-player, pemutar penuh |
| [`fase3/`](fase3/README.md) | Pencarian dengan hasil, Lagu Disukai, playlist |
| [`fase4/`](fase4/README.md) | Library (slot n/3), unggah: normal, sedang mengunggah, kuota penuh, MP3 palsu ditolak |

## Memperbarui

Tidak pernah otomatis pada tiap run. Dua cara:

1. **Manual lewat workflow:** Actions → `e2e` → *Run workflow*, centang `update_screenshots`. Workflow menjalankan seluruh E2E lalu meng-commit isi `test-results/shots/fase2|fase3|fase4` ke `docs/images/`.
2. **Dari artefak:** unduh artefak `e2e-hasil` dari run mana pun dan salin isi `shots/faseN/` ke folder yang sama.
