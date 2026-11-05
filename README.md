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
