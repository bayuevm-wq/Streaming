-- 0006_defaults.sql — user_id terisi otomatis dari JWT.
-- Klien tidak perlu tahu id penggunanya; RLS (WITH CHECK user_id = auth.uid()) tetap menolak user_id palsu.
-- Default dievaluasi SEBELUM trigger BEFORE INSERT (batas playlist), sehingga trigger melihat nilai akhirnya.
alter table public.likes     alter column user_id set default auth.uid();
alter table public.playlists alter column user_id set default auth.uid();
