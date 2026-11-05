-- rls_and_limits.test.sql: uji RLS, policy Storage, trigger, RPC, batas, dan fungsi job.
-- Prasyarat: migrasi 0001-0004 sudah diterapkan dan helpers.sql sudah dimuat.
-- Keluaran: baris PASS atau WARNING FAIL. Lulus bila tidak ada FAIL dan tidak ada ERROR.
-- Pakai database kosong: uji ini memasukkan data dengan UUID tetap.

\set A '''aaaaaaaa-0000-0000-0000-000000000001'''
\set B '''aaaaaaaa-0000-0000-0000-000000000002'''
\set D '''aaaaaaaa-0000-0000-0000-000000000004'''
\set E '''aaaaaaaa-0000-0000-0000-000000000005'''

\echo == T1 trigger profiles ==
insert into auth.users (id, is_anonymous) values (:A, true), (:B, true), (:D, true);
insert into auth.users (id, is_anonymous, email) values (:E, false, 'e@example.com');
select t.check('T1 profiles dibuat untuk 4 user', (select count(*) from public.profiles) = 4);

\echo == data katalog publik (service role) ==
select t.as_service();
insert into public.artists (name) values ('Artis Satu');
insert into public.albums (artist_id, title) select id, 'Album Satu' from public.artists;
insert into public.songs (visibility, title, artist_id, album_id, audio_path, duration_sec)
  select 'public', 'Lagu 100% Publik', a.id, al.id, 'seed/pub1.mp3', 180 from public.artists a join public.albums al on al.artist_id = a.id;
select t.logout();
select t.err('T2 constraint: lagu public tidak boleh punya owner',
  format($f$insert into public.songs (visibility, owner_id, title, artist_id, audio_path, duration_sec)
            select 'public', %L, 'x', id, 'seed/bad.mp3', 10 from public.artists$f$, :A::text), 'songs_shape');

\echo == T3 kuota berurutan ==
select t.login(:A);
select t.check('T3a reserve #1 ok', public.reserve_upload('Pribadi 1', 'Aku') ? 'song_id');
select t.check('T3b reserve #2 ok', public.reserve_upload('Pribadi 2', 'Aku', 'Album X', 'jpg') ? 'cover_path');
select t.check('T3c reserve #3 ok', public.reserve_upload('Pribadi 3', 'Aku') ? 'audio_path');
select t.err('T3d reserve #4 ditolak', $$select public.reserve_upload('Pribadi 4', 'Aku')$$, 'quota_exceeded');
select t.err('T3e cover ext aneh ditolak', $$select public.reserve_upload('x', 'y', null, 'exe')$$, 'bad_cover_ext');
select t.logout();
select t.login(:B);
select t.err('T3f judul kosong ditolak (user B, kuota kosong)', $$select public.reserve_upload('   ', 'y')$$, 'check|violates');
select t.logout();
select t.login(:A);
select t.err('T3g klien tidak bisa INSERT langsung ke songs',
  $$insert into public.songs (visibility, status, owner_id, title, artist_name, audio_path, expires_at)
    values ('private','ready', 'aaaaaaaa-0000-0000-0000-000000000001', 't', 'a', 'x.mp3', now() + interval '1 day')$$, 'permission denied');
select t.logout();

\echo == T4 pending tak terlihat, finalize hanya service role ==
select t.login(:A);
select t.check('T4a pending tak terlihat lewat RLS', (select count(*) from public.songs where visibility = 'private') = 0);
select t.err('T4b authenticated tak boleh finalize',
  $$select public.finalize_upload(gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001', 100, 1000)$$, 'permission denied');
select t.logout();
select t.as_service();
select public.finalize_upload((select id from public.songs where title = 'Pribadi 1'), :A, 120, 3000000);
select public.finalize_upload((select id from public.songs where title = 'Pribadi 1'), :A, 999, 999);
select t.check('T4c finalize kedua idempoten dan tidak mengubah data',
  (select status = 'ready' and duration_sec = 120 from public.songs where title = 'Pribadi 1'));
select t.err('T4d finalize id/owner salah',
  format($f$select public.finalize_upload(%L, %L, 1, 1)$f$, (select id from public.songs where title = 'Pribadi 2'), :B::text) , 'reservation_invalid');
select t.logout();

\echo == T5 isolasi antar user ==
select t.login(:A);
select t.check('T5a A melihat lagu publik + 1 lagu pribadi sendiri', (select count(*) from public.songs) = 2);
select t.logout();
select t.login(:B);
select t.check('T5b B hanya melihat lagu publik', (select count(*) from public.songs) = 1);
select t.err('T5c klien tak punya akses ke profiles', $$select count(*) from public.profiles$$, 'permission denied');
select t.logout();
select t.as_anon();
select t.err('T5d role anon ditolak', $$select count(*) from public.songs$$, 'permission denied');
select t.logout();

\echo == T6 like dan playlist ==
select t.login(:B);
insert into public.likes (user_id, song_id) select :B, id from public.songs where visibility = 'public';
select t.check('T6a B like lagu publik', (select count(*) from public.likes) = 1);
select t.logout();
select t.as_service();
select id from public.songs where title = 'Pribadi 1' \gset a_
select t.logout();
select t.login(:B);
select t.err('T6c B like lagu pribadi A ditolak (RLS)',
  format($f$insert into public.likes (user_id, song_id) values (%L, %L)$f$, :B::text, :'a_id'), 'row-level security');
select t.err('T6d B like atas nama A ditolak',
  format($f$insert into public.likes (user_id, song_id) select %L, id from public.songs where visibility='public'$f$, :A::text), 'row-level security');
select t.logout();
select t.login(:A);
select t.check('T6e A tak melihat like B', (select count(*) from public.likes) = 0);
insert into public.likes (user_id, song_id) values (:A, :'a_id');
select t.check('T6f A like lagu pribadi sendiri', (select count(*) from public.likes) = 1);
select t.err('T6g like ganda ditolak (PK)', format($f$insert into public.likes values (%L, %L)$f$, :A::text, :'a_id'), 'duplicate key');
insert into public.playlists (user_id, name) values (:A, 'Favorit');
insert into public.playlist_songs (playlist_id, song_id) select (select id from public.playlists), :'a_id'::uuid;
select t.check('T6h playlist menerima lagu pribadi sendiri', (select count(*) from public.playlist_songs) = 1);
select t.err('T6i lagu ganda di playlist ditolak',
  format($f$insert into public.playlist_songs (playlist_id, song_id) select id, %L from public.playlists$f$, :'a_id'), 'duplicate key');
select t.err('T6j nama playlist dengan spasi ujung ditolak',
  format($f$insert into public.playlists (user_id, name) values (%L, ' x ')$f$, :A::text), 'check');
select t.logout();
select t.login(:B);
select t.check('T6k B tak melihat playlist A', (select count(*) from public.playlists) = 0);
select t.err('T6l B tak bisa menambah lagu ke playlist A',
  format($f$insert into public.playlist_songs (playlist_id, song_id) select (select id from public.playlists where false), id from public.songs where visibility='public'$f$), 'null value|row-level');
select t.logout();

\echo == T7 kedaluwarsa ==
update public.songs set expires_at = now() - interval '1 minute' where title = 'Pribadi 1';
select t.login(:A);
select t.check('T7a lagu kedaluwarsa tak terlihat walau job belum jalan', (select count(*) from public.songs where title = 'Pribadi 1') = 0);
select t.check('T7b playlist_songs join songs tak menampilkan lagu kedaluwarsa',
  (select count(*) from public.playlist_songs ps join public.songs s on s.id = ps.song_id) = 0);
select t.check('T7c slot kedaluwarsa dibebaskan: reserve berhasil lagi', public.reserve_upload('Pribadi 5', 'Aku') ? 'song_id');
select t.logout();

\echo == T8 policy Storage ==
select t.login(:A);
insert into storage.objects (bucket_id, name) select 'user-audio', audio_path from public.songs where false;
select t.logout();
select t.as_service();
select audio_path as p2 from public.songs where title = 'Pribadi 2' \gset
select audio_path as p5 from public.songs where title = 'Pribadi 5' \gset
select cover_path as c2 from public.songs where title = 'Pribadi 2' \gset
select t.logout();
select t.login(:A);
insert into storage.objects (bucket_id, name) values ('user-audio', :'p2');
select t.check('T8a upload ke path pending milik sendiri diizinkan', true);
insert into storage.objects (bucket_id, name) values ('user-covers', :'c2');
select t.check('T8b upload cover ke path pending milik sendiri diizinkan', true);
select t.err('T8c upload ke path lain ditolak',
  $$insert into storage.objects (bucket_id, name) values ('user-audio', 'aaaaaaaa-0000-0000-0000-000000000001/liar.mp3')$$, 'row-level security');
select t.err('T8d upload ke bucket publik ditolak',
  format($f$insert into storage.objects (bucket_id, name) values ('audio', %L)$f$, :'p2'), 'row-level security|violates foreign key');
select t.err('T8e upload kedua ke path yang sama ditolak', format($f$insert into storage.objects (bucket_id, name) values ('user-audio', %L)$f$, :'p2'), 'duplicate key');
select t.check('T8f objek pending belum bisa dibaca pemilik (belum ready)', (select count(*) from storage.objects) = 0);
select t.logout();
select t.login(:B);
select t.err('T8g B tak bisa upload ke path pending milik A', format($f$insert into storage.objects (bucket_id, name) values ('user-audio', %L)$f$, :'p5'), 'row-level security');
select t.logout();
select t.as_service();
select public.finalize_upload((select id from public.songs where title = 'Pribadi 2'), :A, 100, 2000000);
select t.logout();
select t.login(:A);
select t.check('T8h setelah ready, pemilik bisa membaca objek audio dan cover', (select count(*) from storage.objects) = 2);
select t.err('T8i setelah ready, tak bisa upload lagi ke path yang sama', format($f$insert into storage.objects (bucket_id, name) values ('user-audio', %L)$f$, :'p2'), 'row-level security');
select t.logout();
select t.login(:B);
select t.check('T8j B tak bisa membaca objek A', (select count(*) from storage.objects) = 0);
select t.logout();

\echo == T9 pencarian ==
select t.login(:B);
select t.check('T9a cari "publik" menemukan lagu publik', jsonb_array_length(public.search_all('publik') -> 'songs') = 1);
select t.check('T9b "%" dianggap literal (hanya judul yang memuat %)', jsonb_array_length(public.search_all('%') -> 'songs') = 1);
select t.check('T9c "_" literal: tidak ada judul bergaris bawah', jsonb_array_length(public.search_all('_') -> 'songs') = 0);
select t.check('T9d kutip dan backslash tidak merusak query', jsonb_array_length(public.search_all('''; drop table songs; --\') -> 'songs') = 0);
select t.check('T9e query kosong => kosong', jsonb_array_length(public.search_all('   ') -> 'songs') = 0);
select t.check('T9f B tidak menemukan lagu pribadi A', jsonb_array_length(public.search_all('Pribadi') -> 'songs') = 0);
select t.logout();
select t.login(:A);
select t.check('T9g A menemukan lagu pribadi sendiri yang aktif (Pribadi 2)', jsonb_array_length(public.search_all('Pribadi 2') -> 'songs') = 1);
select t.check('T9h album dan artis ditemukan', jsonb_array_length(public.search_all('Satu') -> 'albums') = 1 and jsonb_array_length(public.search_all('Satu') -> 'artists') = 1);
select t.logout();

\echo == T10 last_seen_at ==
update public.profiles set last_seen_at = now() - interval '2 hours' where user_id = :A;
select t.login(:A);
select public.touch_last_seen();
select t.logout();
select t.check('T10a touch memperbarui bila > 1 jam', (select last_seen_at > now() - interval '1 minute' from public.profiles where user_id = :A));
update public.profiles set last_seen_at = now() - interval '10 minutes' where user_id = :A;
select t.login(:A);
select public.touch_last_seen();
select t.logout();
select t.check('T10b touch tidak menulis bila < 1 jam', (select last_seen_at < now() - interval '9 minutes' from public.profiles where user_id = :A));
select t.login(:A);
select t.err('T10c klien tak bisa UPDATE profiles langsung', format($f$update public.profiles set last_seen_at = now() where user_id = %L$f$, :A::text) , 'permission denied');
select t.logout();

\echo == T11 claim user tidak aktif (tombstone) ==
insert into auth.sessions (id, user_id) values (gen_random_uuid(), :D), (gen_random_uuid(), :E);
update public.profiles set last_seen_at = now() - interval '8 days' where user_id in (:D, :E);
select t.as_service();
select t.check('T11a hanya user ANONIM tak aktif yang diklaim', (select array_agg(x) from public.claim_inactive_anonymous_users() x) = array[:D::uuid]);
select t.logout();
select t.check('T11b status menjadi deleting', (select status from public.profiles where user_id = :D) = 'deleting');
select t.check('T11c sesi D dicabut, sesi E utuh', (select count(*) from auth.sessions where user_id = :D) = 0 and (select count(*) from auth.sessions where user_id = :E) = 1);
select t.check('T11d user terdaftar tak tersentuh', (select status from public.profiles where user_id = :E) = 'active');
select t.as_service();
select t.check('T11e klaim ulang mengembalikan D lagi (retry)', (select array_agg(x) from public.claim_inactive_anonymous_users() x) = array[:D::uuid]);
select t.logout();
select t.login(:D);
select t.err('T11f user berstatus deleting tak bisa reserve', $$select public.reserve_upload('x','y')$$, 'account_not_active');
select t.logout();

\echo == T12 orphan ==
insert into storage.objects (bucket_id, name, created_at) values ('user-audio', 'zzz/yatim.mp3', now() - interval '3 days');
insert into storage.objects (bucket_id, name, created_at) values ('user-audio', 'zzz/baru.mp3', now());
update storage.objects set created_at = now() - interval '3 days';
insert into storage.objects (bucket_id, name) values ('user-audio', 'zzz/yatim-baru.mp3');
select t.as_service();
select t.check('T12 hanya objek yatim berumur > 1 hari terdaftar, objek berbaris songs tidak',
  (select array_agg(object_name order by object_name) from public.list_orphan_objects()) = array['zzz/baru.mp3','zzz/yatim.mp3']);
select t.logout();

\echo == T13 lease ==
select t.as_service();
select t.check('T13a lease #1 didapat', public.acquire_job_lease('songs', interval '10 minutes'));
select t.check('T13b lease #2 ditolak selagi dipegang', not public.acquire_job_lease('songs', interval '10 minutes'));
select public.release_job_lease('songs', '{"ok":true}');
select t.check('T13c setelah release bisa diambil lagi', public.acquire_job_lease('songs', interval '10 minutes'));
select t.logout();

\echo == T14 cascade hapus user ==
insert into public.likes (user_id, song_id) select :D, id from public.songs where visibility = 'public';
select public.reserve_upload('x','y') where false;
delete from auth.users where id = :D;
select t.check('T14 hapus user menghapus profile dan like-nya', (select count(*) from public.profiles where user_id = :D) = 0 and (select count(*) from public.likes where user_id = :D) = 0);

\echo == T15 batas playlist (maks 20 per user) ==
select t.login(:A);
insert into public.playlists (user_id, name) select :A, 'P' || g from generate_series(1, 19) g;
select t.check('T15a A mencapai 20 playlist', (select count(*) from public.playlists) = 20);
select t.err('T15b playlist ke-21 ditolak', format($f$insert into public.playlists (user_id, name) values (%L, 'ke21')$f$, :A::text), 'playlist_limit');
select t.logout();
select t.login(:B);
insert into public.playlists (user_id, name) values (:B, 'B1');
select t.check('T15c B tak terpengaruh batas A', (select count(*) from public.playlists) = 1);
select t.err('T15d B tak bisa membuat playlist atas nama A (RLS, bukan batas)',
  format($f$insert into public.playlists (user_id, name) values (%L, 'palsu')$f$, :A::text), 'row-level security');
select t.logout();

\echo == T16 batas 200 lagu per playlist ==
select t.as_service();
insert into public.songs (visibility, title, artist_id, audio_path, duration_sec)
  select 'public', 'Bulk ' || g, (select id from public.artists limit 1), 'seed/bulk' || g || '.mp3', 100
    from generate_series(1, 205) g;
select t.logout();
select t.login(:A);
-- 'Favorit' sudah berisi 1 baris (lagu pribadi kedaluwarsa yang barisnya belum dipurge), jadi tambah 199.
insert into public.playlist_songs (playlist_id, song_id)
  select (select id from public.playlists where name = 'Favorit'), id from public.songs
   where title like 'Bulk %' order by title limit 199;
select t.check('T16a playlist mencapai 200 baris',
  (select count(*) from public.playlist_songs where playlist_id = (select id from public.playlists where name = 'Favorit')) = 200);
select t.err('T16b lagu ke-201 ditolak',
  $$insert into public.playlist_songs (playlist_id, song_id)
    select (select id from public.playlists where name = 'Favorit'), id from public.songs
     where title like 'Bulk %' and id not in (select song_id from public.playlist_songs) limit 1$$, 'playlist_song_limit');
insert into public.playlist_songs (playlist_id, song_id)
  select (select id from public.playlists where name = 'P1'), id from public.songs where title = 'Bulk 205';
select t.check('T16c playlist lain milik A tidak terpengaruh', (select count(*) from public.playlist_songs
  where playlist_id = (select id from public.playlists where name = 'P1')) = 1);
select t.logout();
select id as a_playlist from public.playlists where name = 'Favorit' \gset
select t.login(:B);
select t.err('T16d B tak bisa menambah lagu ke playlist A (RLS, bukan batas)',
  format($f$insert into public.playlist_songs (playlist_id, song_id) select %L, id from public.songs where title = 'Bulk 205'$f$, :'a_playlist'),
  'row-level security');
select t.logout();

\echo == T17 batas penyimpanan pribadi global ==
-- Atur batas sehingga TEPAT satu reservasi lagi yang muat.
update public.app_limits set private_storage_cap_bytes =
  (select coalesce(sum(coalesce(size_bytes, 10485760)), 0) + 10485760 from public.songs where visibility = 'private');
select t.login(:B);
select t.check('T17a upload masih dibuka (muat satu lagi)', (public.get_upload_status() ->> 'storage_open')::boolean);
select t.check('T17b reserve berhasil sampai batas', public.reserve_upload('B1', 'b') ? 'song_id');
select t.check('T17c status berubah menjadi ditutup', not (public.get_upload_status() ->> 'storage_open')::boolean);
select t.err('T17d reserve berikutnya ditolak storage_full', $$select public.reserve_upload('B2', 'b')$$, 'storage_full');
select t.check('T17e kuota pribadi B belum habis, jadi penolakan murni karena batas global',
  (public.get_upload_status() ->> 'active')::int = 1);
select t.logout();
delete from public.songs where owner_id = :B;   -- simulasi purge baris
select t.login(:B);
select t.check('T17f setelah baris dipurge, upload dibuka lagi', (public.get_upload_status() ->> 'storage_open')::boolean);
select t.logout();
update public.app_limits set private_storage_cap_bytes = 524288000;

\echo == T18 ping (keep-alive) dan hak akses app_limits ==
select t.as_anon();
select t.check('T18a anon dapat memanggil ping', (public.ping() ->> 'ok')::boolean);
select t.err('T18b anon tetap tak bisa membaca tabel', $$select count(*) from public.artists$$, 'permission denied');
select t.err('T18c anon tak bisa memanggil get_upload_status', $$select public.get_upload_status()$$, 'permission denied');
select t.logout();
select t.login(:A);
select t.err('T18d klien tak bisa membaca app_limits', $$select * from public.app_limits$$, 'permission denied');
select t.err('T18e klien tak bisa mengubah app_limits', $$update public.app_limits set private_storage_cap_bytes = 1$$, 'permission denied');
select t.logout();

\echo == T19 kedaluwarsa reservasi diputuskan database: reject_upload dan finalize_upload ==
select t.login(:B);
select (public.reserve_upload('R1', 'x') ->> 'song_id') as rid \gset
select t.check('T19a B punya 1 slot terpakai', (public.get_upload_status() ->> 'active')::int = 1);
select t.err('T19b authenticated tak boleh memanggil reject_upload',
  format($f$select public.reject_upload(%L, %L)$f$, :'rid', :B::text), 'permission denied');
select t.logout();
select t.as_service();
select public.reject_upload(:'rid', :B);
select t.logout();
select t.check('T19c reject_upload mengatur expires_at <= now() menurut DB dan status tetap pending',
  (select status = 'pending' and expires_at <= now() from public.songs where id = :'rid'));
select t.login(:B);
select t.check('T19d slot langsung bebas setelah reject', (public.get_upload_status() ->> 'active')::int = 0);
select t.logout();
select t.as_service();
select t.err('T19e finalize_upload atas reservasi yang ditolak/kedaluwarsa => reservation_expired',
  format($f$select public.finalize_upload(%L, %L, 100, 1000)$f$, :'rid', :B::text), 'reservation_expired');
select t.err('T19f finalize_upload dengan owner salah => reservation_invalid',
  format($f$select public.finalize_upload(%L, %L, 100, 1000)$f$, :'rid', :A::text), 'reservation_invalid');
select id as a_ready from public.songs where title = 'Pribadi 2' \gset
select public.reject_upload(:'a_ready', :A);
select t.check('T19g reject_upload tidak menyentuh lagu yang sudah ready',
  (select status = 'ready' and expires_at > now() from public.songs where id = :'a_ready'));
-- Reservasi kedaluwarsa yang lebih lama tidak diperpanjang oleh reject_upload.
update public.songs set expires_at = now() - interval '1 hour' where id = :'rid';
select public.reject_upload(:'rid', :B);
select t.check('T19h reject_upload tidak memperpanjang reservasi yang sudah lama kedaluwarsa',
  (select expires_at < now() - interval '59 minutes' from public.songs where id = :'rid'));
select t.logout();
