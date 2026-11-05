-- 0002_functions.sql — trigger, RPC, fungsi pendukung job
-- Semua fungsi SECURITY DEFINER memakai search_path kosong, jadi semua objek ditulis dengan nama skema.

-- (d) Baris profiles dibuat otomatis setiap ada baris baru di auth.users.
-- Sign-in anonim Supabase juga meng-INSERT ke auth.users (is_anonymous = true), jadi trigger ini menangkapnya.
-- Dibuat sesederhana mungkin: trigger yang melempar error akan menggagalkan sign-in.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- last_seen_at: maksimal 1x per jam, dibatasi DI SQL (klien yang nakal pun tidak bisa menulis lebih sering).
-- Sekaligus "self-heal" bila baris profiles belum ada.
create or replace function public.touch_last_seen()
returns void language sql security definer set search_path = '' as $$
  insert into public.profiles as p (user_id) values ((select auth.uid()))
  on conflict (user_id) do update set last_seen_at = now()
  where p.status = 'active' and p.last_seen_at < now() - interval '1 hour';
$$;

-- (b) Kuota 3 lagu aktif per akun. Berlaku untuk SETIAP INSERT lagu pribadi, dari jalur mana pun.
-- Kunci: SELECT ... FOR UPDATE pada baris profiles milik user. Transaksi kedua untuk user yang sama
-- menunggu sampai transaksi pertama commit, lalu menghitung dengan snapshot baru (READ COMMITTED),
-- sehingga melihat baris yang baru di-insert transaksi pertama.
create or replace function public.enforce_private_song_quota()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_active integer;
  v_used   bigint;
  v_cap    bigint;
begin
  insert into public.profiles (user_id) values (new.owner_id) on conflict (user_id) do nothing;

  perform 1 from public.profiles
   where user_id = new.owner_id and status = 'active'
   for update;
  if not found then
    raise exception 'account_not_active' using errcode = 'P0001';
  end if;

  select count(*) into v_active
    from public.songs
   where owner_id = new.owner_id and visibility = 'private' and expires_at > now();

  if v_active >= 3 then
    raise exception 'quota_exceeded' using errcode = 'P0001', hint = 'maks 3 lagu pribadi aktif';
  end if;

  -- Batas penyimpanan pribadi GLOBAL. Kunci kedua (baris singleton) diambil SETELAH kunci profil; urutan
  -- profil -> global selalu sama, jadi tidak ada deadlock. Semua baris lagu pribadi yang masih ada dihitung,
  -- termasuk yang sudah kedaluwarsa tetapi belum dipurge (file fisiknya masih ada). Reservasi tanpa ukuran
  -- (pending) dihitung 10 MiB, batas maksimum per file. Hanya byte audio; cover (maks 2 MiB) tidak dihitung.
  select private_storage_cap_bytes into v_cap from public.app_limits for update;
  select coalesce(sum(coalesce(size_bytes, 10485760)), 0) into v_used
    from public.songs where visibility = 'private';
  if v_used + 10485760 > v_cap then
    raise exception 'storage_full' using errcode = 'P0001', hint = 'upload pengunjung ditutup sementara';
  end if;
  return new;
end $$;

create trigger songs_private_quota
before insert on public.songs
for each row when (new.visibility = 'private')
execute function public.enforce_private_song_quota();

-- Status untuk UI: slot terpakai dan apakah upload sedang dibuka (batas global belum penuh).
create or replace function public.get_upload_status()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'active', (select count(*) from public.songs
                where owner_id = (select auth.uid()) and visibility = 'private' and expires_at > now()),
    'max', 3,
    'storage_open', (select coalesce(sum(coalesce(size_bytes, 10485760)), 0) + 10485760
                            <= (select private_storage_cap_bytes from public.app_limits)
                       from public.songs where visibility = 'private'));
$$;

-- Batas playlist: maks 20 per user dan 200 lagu per playlist. Pola kuncinya sama dengan kuota lagu:
-- kunci baris induk (profil / playlist) sebelum menghitung. Bila baris bukan milik pemanggil, trigger
-- tidak mengunci apa pun dan membiarkan RLS yang menolak (agar user tak bisa mengunci baris orang lain).
create or replace function public.enforce_playlist_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_n integer;
begin
  if new.user_id is distinct from (select auth.uid()) then return new; end if;
  insert into public.profiles (user_id) values (new.user_id) on conflict (user_id) do nothing;
  perform 1 from public.profiles where user_id = new.user_id for update;
  select count(*) into v_n from public.playlists where user_id = new.user_id;
  if v_n >= 20 then
    raise exception 'playlist_limit' using errcode = 'P0001', hint = 'maks 20 playlist';
  end if;
  return new;
end $$;

create trigger playlists_limit
before insert on public.playlists
for each row execute function public.enforce_playlist_limit();

create or replace function public.enforce_playlist_song_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_n integer;
begin
  perform 1 from public.playlists
   where id = new.playlist_id and user_id = (select auth.uid()) for update;
  if not found then return new; end if;
  select count(*) into v_n from public.playlist_songs where playlist_id = new.playlist_id;
  if v_n >= 200 then
    raise exception 'playlist_song_limit' using errcode = 'P0001', hint = 'maks 200 lagu per playlist';
  end if;
  return new;
end $$;

create trigger playlist_songs_limit
before insert on public.playlist_songs
for each row execute function public.enforce_playlist_song_limit();

-- Keep-alive: dipanggil GitHub Actions tiap hari. Hanya-baca, tanpa data sensitif, tetapi benar-benar
-- menyentuh tabel sehingga terhitung sebagai aktivitas database (proyek Free di-pause bila aktivitas rendah 7 hari).
create or replace function public.ping()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('ok', (select count(*) >= 0 from public.artists), 'ts', now());
$$;

-- (a) Langkah 1 upload: memesan slot. Baris dibuat SEBELUM file ada (status 'pending', TTL 15 menit).
create or replace function public.reserve_upload(
  p_title text, p_artist_name text, p_album_name text default null, p_cover_ext text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := (select auth.uid());
  v_id    uuid := gen_random_uuid();
  v_audio text;
  v_cover text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_cover_ext is not null and p_cover_ext not in ('jpg', 'png', 'webp') then
    raise exception 'bad_cover_ext' using errcode = '22023';
  end if;

  v_audio := v_uid::text || '/' || v_id::text || '.mp3';
  v_cover := case when p_cover_ext is null then null
                  else v_uid::text || '/' || v_id::text || '.' || p_cover_ext end;

  insert into public.songs
    (id, visibility, status, owner_id, title, artist_name, album_name, audio_path, cover_path, expires_at)
  values
    (v_id, 'private', 'pending', v_uid, btrim(p_title), btrim(p_artist_name),
     nullif(btrim(coalesce(p_album_name, '')), ''), v_audio, v_cover, now() + interval '15 minutes');

  return jsonb_build_object('song_id', v_id, 'audio_path', v_audio, 'cover_path', v_cover);
end $$;

-- Batalkan reservasi / hapus lagu sendiri: langsung tak terlihat dan slot bebas (expires_at = now()).
-- File dan baris dibersihkan Route Handler (segera) atau job per jam (cadangan).
create or replace function public.expire_my_song(p_song_id uuid)
returns void language sql security definer set search_path = '' as $$
  update public.songs set expires_at = now()
   where id = p_song_id and owner_id = (select auth.uid()) and visibility = 'private';
$$;

-- Langkah 3 upload: hanya bisa dipanggil service role SETELAH server memverifikasi isi file.
create or replace function public.finalize_upload(
  p_song_id uuid, p_user_id uuid, p_duration_sec integer, p_size_bytes bigint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.songs
     set status = 'ready', duration_sec = p_duration_sec, size_bytes = p_size_bytes,
         expires_at = now() + interval '24 hours'
   where id = p_song_id and owner_id = p_user_id
     and visibility = 'private' and status = 'pending' and expires_at > now();
  if not found then
    if exists (select 1 from public.songs
                where id = p_song_id and owner_id = p_user_id and status = 'ready') then
      return;                                   -- idempoten
    end if;
    -- Baris pending milik user ada tetapi tidak lolos "expires_at > now()": kedaluwarsa menurut jam DATABASE.
    if exists (select 1 from public.songs
                where id = p_song_id and owner_id = p_user_id
                  and visibility = 'private' and status = 'pending') then
      raise exception 'reservation_expired' using errcode = 'P0003';
    end if;
    raise exception 'reservation_invalid' using errcode = 'P0002';
  end if;
end $$;

-- Menolak reservasi yang isinya tidak sah: kedaluwarsakan SEKARANG menurut jam database (bukan jam Node),
-- sehingga lagu tak pernah terlihat dan slot langsung bebas. Hanya untuk baris 'pending'; baris 'ready' tak tersentuh.
-- least(): tidak pernah memperpanjang reservasi yang sudah kedaluwarsa.
create or replace function public.reject_upload(p_song_id uuid, p_user_id uuid)
returns void language sql security definer set search_path = '' as $$
  update public.songs set expires_at = least(expires_at, now())
   where id = p_song_id and owner_id = p_user_id and visibility = 'private' and status = 'pending';
$$;

-- (c) Job F18, langkah 1 untuk user: "tombstone". Menandai user, mencabut sesinya, mengembalikan daftar id.
-- Kondisi tidak aktif dievaluasi ulang di dalam UPDATE yang sama (atomik); baris status 'deleting'
-- ikut dikembalikan lagi agar kegagalan hari sebelumnya dicoba ulang.
create or replace function public.claim_inactive_anonymous_users(
  p_inactive interval default interval '7 days', p_limit integer default 50)
returns setof uuid language plpgsql security definer set search_path = '' as $$
begin
  return query
  with picked as (
    select p.user_id
      from public.profiles p
      join auth.users u on u.id = p.user_id
     where u.is_anonymous
       and (p.status = 'deleting'
            or (p.status = 'active' and p.last_seen_at < now() - p_inactive))
     order by p.last_seen_at
     limit p_limit
       for update of p skip locked
  ), marked as (
    update public.profiles p set status = 'deleting'
      from picked where p.user_id = picked.user_id
    returning p.user_id
  ), revoked as (
    delete from auth.sessions s using marked where s.user_id = marked.user_id
    returning s.id
  )
  select marked.user_id from marked;
end $$;

-- Objek Storage tanpa baris songs (kasus tak terduga). Dibaca lewat SQL, TETAPI dihapus lewat Storage API.
create or replace function public.list_orphan_objects(
  p_min_age interval default interval '1 day', p_limit integer default 500)
returns table (bucket text, object_name text)
language sql stable security definer set search_path = '' as $$
  select o.bucket_id::text, o.name::text
    from storage.objects o
   where o.bucket_id in ('user-audio', 'user-covers')
     and o.created_at < now() - p_min_age
     and not exists (
       select 1 from public.songs s
        where (o.bucket_id = 'user-audio'  and s.audio_path = o.name)
           or (o.bucket_id = 'user-covers' and s.cover_path = o.name))
   limit p_limit;
$$;

create or replace function public.acquire_job_lease(p_name text, p_ttl interval)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_rows integer;
begin
  -- Bila lease masih dipegang, WHERE pada DO UPDATE bernilai false => 0 baris tersentuh.
  insert into public.job_leases as l (name, locked_until, last_run_at)
  values (p_name, now() + p_ttl, now())
  on conflict (name) do update
    set locked_until = now() + p_ttl, last_run_at = now()
    where l.locked_until < now();
  get diagnostics v_rows = row_count;
  return v_rows > 0;
end $$;

create or replace function public.release_job_lease(p_name text, p_result jsonb)
returns void language sql security definer set search_path = '' as $$
  update public.job_leases set locked_until = 'epoch', last_result = p_result where name = p_name;
$$;

-- Pencarian: SECURITY INVOKER, jadi RLS berlaku (lagu publik + lagu pribadi MILIK SENDIRI yang belum kedaluwarsa).
-- Input di-escape untuk ILIKE dan dikirim sebagai parameter, bukan digabung ke string SQL.
create or replace function public.search_all(p_q text, p_limit integer default 20)
returns jsonb language sql stable security invoker set search_path = '' as $$
  with q as (
    select '%' || replace(replace(replace(btrim(left(coalesce(p_q, ''), 100)), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pat,
           btrim(left(coalesce(p_q, ''), 100)) <> '' as ok
  )
  select jsonb_build_object(
    'songs', coalesce((
      select jsonb_agg(to_jsonb(x)) from (
        select s.id, s.title, s.visibility, s.audio_path, s.cover_path, s.duration_sec,
               coalesce(a.name, s.artist_name) as artist, coalesce(al.title, s.album_name) as album
          from public.songs s
          left join public.artists a  on a.id  = s.artist_id
          left join public.albums  al on al.id = s.album_id
          cross join q
         where q.ok and (s.title ilike q.pat or a.name ilike q.pat or al.title ilike q.pat
                         or s.artist_name ilike q.pat or s.album_name ilike q.pat)
         order by s.created_at desc limit least(p_limit, 50)) x), '[]'::jsonb),
    'albums', coalesce((
      select jsonb_agg(to_jsonb(x)) from (
        select al.id, al.title, al.cover_path, a.name as artist
          from public.albums al join public.artists a on a.id = al.artist_id
          cross join q
         where q.ok and (al.title ilike q.pat or a.name ilike q.pat)
         order by al.title limit least(p_limit, 50)) x), '[]'::jsonb),
    'artists', coalesce((
      select jsonb_agg(to_jsonb(x)) from (
        select a.id, a.name, a.image_path
          from public.artists a cross join q
         where q.ok and a.name ilike q.pat
         order by a.name limit least(p_limit, 50)) x), '[]'::jsonb)
  );
$$;

-- Hak eksekusi: default Postgres/Supabase memberi EXECUTE ke PUBLIC dan anon, jadi dicabut eksplisit.
revoke all on function public.handle_new_user()                                      from public, anon, authenticated;
revoke all on function public.enforce_private_song_quota()                           from public, anon, authenticated;
revoke all on function public.enforce_playlist_limit()                               from public, anon, authenticated;
revoke all on function public.enforce_playlist_song_limit()                          from public, anon, authenticated;
revoke all on function public.get_upload_status()                                    from public, anon;
revoke all on function public.ping()                                                 from public;
revoke all on function public.touch_last_seen()                                      from public, anon;
revoke all on function public.reserve_upload(text, text, text, text)                 from public, anon;
revoke all on function public.expire_my_song(uuid)                                   from public, anon;
revoke all on function public.search_all(text, integer)                              from public, anon;
revoke all on function public.finalize_upload(uuid, uuid, integer, bigint)           from public, anon, authenticated;
revoke all on function public.reject_upload(uuid, uuid)                              from public, anon, authenticated;
revoke all on function public.claim_inactive_anonymous_users(interval, integer)      from public, anon, authenticated;
revoke all on function public.list_orphan_objects(interval, integer)                 from public, anon, authenticated;
revoke all on function public.acquire_job_lease(text, interval)                      from public, anon, authenticated;
revoke all on function public.release_job_lease(text, jsonb)                         from public, anon, authenticated;

grant execute on function public.touch_last_seen()                              to authenticated;
grant execute on function public.get_upload_status()                            to authenticated;
grant execute on function public.ping()                                         to anon, authenticated;
grant execute on function public.reserve_upload(text, text, text, text)         to authenticated;
grant execute on function public.expire_my_song(uuid)                           to authenticated;
grant execute on function public.search_all(text, integer)                      to authenticated;
grant execute on function public.finalize_upload(uuid, uuid, integer, bigint)   to service_role;
grant execute on function public.reject_upload(uuid, uuid)                      to service_role;
grant execute on function public.claim_inactive_anonymous_users(interval, integer) to service_role;
grant execute on function public.list_orphan_objects(interval, integer)         to service_role;
grant execute on function public.acquire_job_lease(text, interval)              to service_role;
grant execute on function public.release_job_lease(text, jsonb)                 to service_role;
