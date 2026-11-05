-- 0001_schema.sql — tabel, constraint, indeks
create extension if not exists pg_trgm with schema extensions;

-- Satu baris per user (anonim maupun terdaftar). Dibuat oleh trigger (lihat 0002).
create table public.profiles (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  status       text not null default 'active' check (status in ('active', 'deleting')),
  last_seen_at timestamptz not null default now(),
  created_at   timestamptz not null default now()
);
create index profiles_inactive_idx on public.profiles (last_seen_at) where status = 'active';

create table public.artists (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(btrim(name)) between 1 and 120),
  name_key   text generated always as (lower(btrim(name))) stored,
  image_path text,
  created_at timestamptz not null default now(),
  unique (name_key)
);

create table public.albums (
  id         uuid primary key default gen_random_uuid(),
  artist_id  uuid not null references public.artists (id) on delete cascade,
  title      text not null check (char_length(btrim(title)) between 1 and 120),
  title_key  text generated always as (lower(btrim(title))) stored,
  cover_path text,
  year       smallint check (year between 1900 and 2100),
  created_at timestamptz not null default now(),
  unique (artist_id, title_key)
);

-- Satu tabel untuk lagu katalog (public) dan lagu pribadi (private).
create table public.songs (
  id          uuid primary key default gen_random_uuid(),
  visibility  text not null check (visibility in ('public', 'private')),
  status      text not null default 'ready' check (status in ('pending', 'ready')),
  owner_id    uuid references auth.users (id) on delete cascade,
  seed_key    text unique,                       -- kunci idempotensi skrip seed
  title       text not null check (char_length(btrim(title)) between 1 and 120),
  artist_id   uuid references public.artists (id) on delete restrict,
  album_id    uuid references public.albums (id) on delete set null,
  track_no    smallint,
  artist_name text check (char_length(btrim(artist_name)) between 1 and 120),
  album_name  text check (char_length(album_name) <= 120),
  audio_path  text not null,                     -- relatif terhadap bucket
  cover_path  text,
  duration_sec integer check (duration_sec between 1 and 7200),
  size_bytes  bigint check (size_bytes > 0),
  expires_at  timestamptz,
  created_at  timestamptz not null default now(),
  constraint songs_shape check (
    (visibility = 'public' and status = 'ready' and owner_id is null and expires_at is null
       and artist_id is not null and duration_sec is not null)
    or
    (visibility = 'private' and owner_id is not null and expires_at is not null
       and artist_name is not null and artist_id is null and album_id is null
       and (status = 'pending' or duration_sec is not null))
  )
);
create unique index songs_audio_path_uq     on public.songs (audio_path);
create index songs_public_recent_idx        on public.songs (created_at desc) where visibility = 'public';
create index songs_artist_idx               on public.songs (artist_id) where artist_id is not null;
create index songs_album_idx                on public.songs (album_id, track_no) where album_id is not null;
create index songs_owner_live_idx           on public.songs (owner_id, expires_at) where visibility = 'private';
create index songs_expiry_idx               on public.songs (expires_at) where visibility = 'private';
create index songs_title_trgm               on public.songs using gin (title extensions.gin_trgm_ops);
create index artists_name_trgm              on public.artists using gin (name extensions.gin_trgm_ops);
create index albums_title_trgm              on public.albums using gin (title extensions.gin_trgm_ops);

create table public.likes (
  user_id    uuid not null references auth.users (id) on delete cascade,
  song_id    uuid not null references public.songs (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, song_id)
);
create index likes_song_idx on public.likes (song_id);

create table public.playlists (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null check (name = btrim(name) and char_length(name) between 1 and 60),
  description text check (char_length(description) <= 300),
  created_at  timestamptz not null default now()
);
create index playlists_user_idx on public.playlists (user_id, created_at desc);

create table public.playlist_songs (
  playlist_id uuid not null references public.playlists (id) on delete cascade,
  song_id     uuid not null references public.songs (id) on delete cascade,
  position    bigint generated always as identity,
  added_at    timestamptz not null default now(),
  primary key (playlist_id, song_id)
);
create index playlist_songs_order_idx on public.playlist_songs (playlist_id, position);
create index playlist_songs_song_idx  on public.playlist_songs (song_id);

-- Batas global yang bisa diubah pemilik proyek lewat SQL (singleton: tepat satu baris).
create table public.app_limits (
  id                        boolean primary key default true check (id),
  private_storage_cap_bytes bigint not null default 524288000 check (private_storage_cap_bytes > 0)  -- 500 MB
);
insert into public.app_limits default values;

-- Lease agar job pembersih tidak berjalan tumpang tindih; juga log hasil terakhir.
create table public.job_leases (
  name         text primary key,
  locked_until timestamptz not null default 'epoch',
  last_run_at  timestamptz,
  last_result  jsonb
);
