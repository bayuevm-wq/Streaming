-- 0004_storage.sql — bucket dan policy Storage
-- file_size_limit ditegakkan Storage terhadap byte yang benar-benar masuk (tidak bisa dipalsukan klien).
-- allowed_mime_types hanya memeriksa Content-Type yang DIKLAIM klien, jadi ini pagar kasar, bukan validasi isi.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('audio',       'audio',       true,  15728640, array['audio/mpeg', 'audio/mp4', 'audio/x-m4a']),
  ('covers',      'covers',      true,   2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('user-audio',  'user-audio',  false, 10485760, array['audio/mpeg']),
  ('user-covers', 'user-covers', false,  2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Bucket publik (audio, covers): tidak ada policy untuk klien => klien tidak bisa menulis/mengubah/menghapus.
-- Pembacaan lewat URL publik tidak memerlukan policy. Penulisan hanya service role (skrip seed).

-- Pemeriksa "apakah path ini milik reservasi pending saya?". SECURITY DEFINER karena baris 'pending'
-- sengaja tidak terlihat lewat RLS songs.
create or replace function public.owns_pending_object(p_bucket text, p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.songs s
     where s.owner_id = (select auth.uid())
       and s.visibility = 'private' and s.status = 'pending' and s.expires_at > now()
       and ((p_bucket = 'user-audio'  and s.audio_path = p_name)
         or (p_bucket = 'user-covers' and s.cover_path = p_name))
  );
$$;
revoke all on function public.owns_pending_object(text, text) from public, anon;
grant execute on function public.owns_pending_object(text, text) to authenticated;

-- Tulis: HANYA ke path yang sudah dipesan lewat reserve_upload dan masih 'pending'. Tidak ada policy UPDATE,
-- jadi objek tidak bisa ditimpa (upsert ditolak) dan tak bisa diganti setelah divalidasi.
-- Tidak ada policy DELETE: penghapusan hanya lewat server (service role).
create policy "private_upload_reserved_path_only" on storage.objects
for insert to authenticated
with check (
  bucket_id in ('user-audio', 'user-covers')
  and public.owns_pending_object(bucket_id, name)
);

-- Baca (dibutuhkan createSignedUrl): hanya bila ada baris songs yang TERLIHAT bagi pemanggil,
-- artinya status 'ready', milik sendiri, dan belum kedaluwarsa (RLS songs yang menegakkan).
create policy "private_read_own_live" on storage.objects
for select to authenticated
using (
  (bucket_id = 'user-audio'  and exists (select 1 from public.songs s where s.audio_path = name))
  or
  (bucket_id = 'user-covers' and exists (select 1 from public.songs s where s.cover_path = name))
);
