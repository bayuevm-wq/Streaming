-- Tiruan minimal skema Supabase untuk uji lokal (BUKAN bagian migrasi)
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema extensions;
create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  is_anonymous boolean not null default false,
  email text
);
create table auth.sessions (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users (id) on delete cascade);
create function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  created_at timestamptz default now(),
  unique (bucket_id, name)
);
alter table storage.objects enable row level security;
grant usage on schema auth, storage, extensions, public to anon, authenticated, service_role;
grant select, insert on storage.objects to authenticated;
grant all on storage.objects to service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
-- meniru default Supabase: hak luas ke anon/authenticated/service_role pada objek baru di public
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
