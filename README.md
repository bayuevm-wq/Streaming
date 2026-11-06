# Streaming

[![db-tests](https://github.com/bayuevm-wq/Streaming/actions/workflows/db-tests.yml/badge.svg)](https://github.com/bayuevm-wq/Streaming/actions/workflows/db-tests.yml)

Aplikasi streaming musik untuk portofolio (web): Next.js + Tailwind + Supabase. Pemutar global dengan antrean yang tetap berjalan saat pindah halaman, pencarian, like, playlist, dan upload pribadi dengan batas.

| Dokumen | Isi |
|---|---|
| [`docs/spec.md`](docs/spec.md) | Spesifikasi MVP: user story, acceptance criteria, prioritas, di luar MVP |
| [`docs/architecture.md`](docs/architecture.md) | Arsitektur, keputusan, skema, dan rencana fase |
| [`supabase/migrations/`](supabase/migrations/) | Skema, RLS, trigger, dan policy Storage (satu-satunya salinan SQL) |
| [`supabase/tests/`](supabase/tests/README.md) | Uji SQL dan konkurensi |

## Status

Pengerjaan Fase 1 (fondasi). Badge di atas adalah hasil uji database terhadap Supabase CLI sungguhan di GitHub Actions (spike S6).

## Pengembangan

```bash
npm install
cp .env.example .env.local     # isi nilai dari `supabase status`
npm run dev                    # http://localhost:3000
npm run lint && npx tsc --noEmit && npm run build
node lib/audio/mp3.test.ts     # uji validator MP3
```

Catatan: ini Next.js 16 (middleware bernama `proxy.ts`, Cache Components aktif). Baca `node_modules/next/dist/docs/` sebelum mengubah konvensi rute.

## Sumber audio katalog

Setiap lagu seed dicatat sumber dan lisensinya di bawah (dihasilkan `node scripts/seed.ts --dry-run --readme` dari `scripts/seed/catalog.json`). Hanya Pixabay Content License atau CC0; lagu NC tidak dipakai. Lihat [`scripts/seed/README.md`](scripts/seed/README.md) untuk cara mengisi katalog.

<!-- seed-sources:start -->
_Katalog belum diisi._
<!-- seed-sources:end -->

## Keep-alive

Proyek Supabase Free di-pause bila aktivitas database rendah selama 7 hari. Workflow [`keepalive`](.github/workflows/keepalive.yml) memanggil RPC `ping()` tiap hari. Isi secret repositori `SUPABASE_URL` dan `SUPABASE_ANON_KEY` (anon key, bukan service role); selama belum diisi, workflow hanya memberi pemberitahuan. GitHub dapat menonaktifkan workflow terjadwal pada repositori publik yang lama tidak aktif; jalankan manual lewat tab Actions (`workflow_dispatch`) bila ada email peringatan pause dari Supabase.

## Design system

Arah **Tinta Cetak** (mode gelap, kobalt, serif editorial): [`docs/design-system.md`](docs/design-system.md). Token ada di `app/globals.css`, komponen di `components/ui/`, dan halaman review di `/gaya` (`npm run dev`, buka `http://localhost:3000/gaya`). Uji: `npm run test:contrast` dan `npm run test:keyboard`.
