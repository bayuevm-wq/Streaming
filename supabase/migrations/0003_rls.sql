-- 0003_rls.sql — RLS dan grant tabel
alter table public.profiles       enable row level security;
alter table public.artists        enable row level security;
alter table public.albums         enable row level security;
alter table public.songs          enable row level security;
alter table public.likes          enable row level security;
alter table public.playlists      enable row level security;
alter table public.playlist_songs enable row level security;
alter table public.job_leases     enable row level security;
alter table public.app_limits     enable row level security;

-- Default Supabase memberi hak luas ke anon/authenticated; cabut lalu beri minimum.
revoke all on all tables in schema public from anon, authenticated;
grant select                         on public.artists, public.albums, public.songs to authenticated;
grant select, insert, delete         on public.likes          to authenticated;
grant select, insert, update, delete on public.playlists      to authenticated;
grant select, insert, delete         on public.playlist_songs to authenticated;
-- profiles, job_leases, app_limits: tanpa grant dan tanpa policy untuk klien (hanya fungsi SECURITY DEFINER / service role).

-- Catatan: "authenticated" mencakup user ANONIM (JWT mereka ber-role authenticated, is_anonymous = true).
-- Role "anon" hanya untuk permintaan tanpa sesi, dan tidak diberi akses apa pun.

-- Katalog dan lagu: tidak ada policy INSERT/UPDATE/DELETE => klien tidak bisa menulis (service role melewati RLS).
create policy artists_read on public.artists for select to authenticated using (true);
create policy albums_read  on public.albums  for select to authenticated using (true);

create policy songs_read on public.songs for select to authenticated
using (
  status = 'ready'
  and (
    visibility = 'public'
    or (owner_id = (select auth.uid()) and expires_at > now())
  )
);

-- Like: hanya milik sendiri, dan hanya untuk lagu yang TERLIHAT oleh pemanggil
-- (subquery di dalam policy tunduk pada RLS tabel songs milik pemanggil).
create policy likes_read   on public.likes for select to authenticated using (user_id = (select auth.uid()));
create policy likes_add    on public.likes for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.songs s where s.id = song_id));
create policy likes_remove on public.likes for delete to authenticated using (user_id = (select auth.uid()));

create policy playlists_own on public.playlists for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy playlist_songs_read on public.playlist_songs for select to authenticated
  using (exists (select 1 from public.playlists p where p.id = playlist_id and p.user_id = (select auth.uid())));
create policy playlist_songs_add on public.playlist_songs for insert to authenticated
  with check (
    exists (select 1 from public.playlists p where p.id = playlist_id and p.user_id = (select auth.uid()))
    and exists (select 1 from public.songs s where s.id = song_id));
create policy playlist_songs_remove on public.playlist_songs for delete to authenticated
  using (exists (select 1 from public.playlists p where p.id = playlist_id and p.user_id = (select auth.uid())));
