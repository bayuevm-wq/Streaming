-- 0007_credits.sql — lisensi, sumber, dan kredit lagu katalog.
-- CC BY dan CC BY-SA mewajibkan atribusi, jadi aplikasi menampilkan kredit tiap lagu (album/lagu dan /kredit).
-- Kolom diisi skrip seed (service role); klien hanya membaca (grant tabel songs untuk klien = SELECT saja).
--
--   license    salah satu dari tiga lisensi yang diizinkan (ejaan baku; validator seed menegakkan hal yang sama)
--   source_url halaman lagu di sumbernya (Free Music Archive / incompetech), tempat lisensi diperiksa
--   credit     teks atribusi lengkap yang ditampilkan apa adanya
--
-- Bentuknya "semua terisi atau semua kosong": lagu lama dan lagu pribadi (unggahan pengunjung) tidak punya kredit.
alter table public.songs
  add column license    text,
  add column source_url text,
  add column credit     text;

alter table public.songs
  add constraint songs_credit_shape check (
    (license is null and source_url is null and credit is null)
    -- IS NOT NULL eksplisit: CHECK meloloskan hasil NULL, jadi tanpa ini baris setengah terisi (mis. lisensi tanpa kredit) lolos.
    or (
      visibility = 'public'
      and license is not null and source_url is not null and credit is not null
      and license in ('CC0 1.0', 'CC BY 4.0', 'CC BY-SA 4.0')
      and source_url ~ '^https?://'
      and char_length(source_url) <= 500
      and char_length(btrim(credit)) between 1 and 600
    )
  );
