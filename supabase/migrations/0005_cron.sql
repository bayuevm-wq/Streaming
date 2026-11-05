-- 0005_cron.sql — penjadwalan job F18 (TIDAK ikut diuji lokal: butuh pg_cron, pg_net, Vault, dan Edge Function)
-- Prasyarat: extension pg_cron dan pg_net aktif; secret 'cleanup_secret' ada di Vault dan sama dengan CLEANUP_SECRET
-- di Edge Function; <PROJECT_REF> diganti dengan ref proyek.
-- Di lingkungan lokal (`supabase start`) file ini boleh dilewati: URL fungsi di bawah hanya valid di proyek hosted.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule('cleanup-songs-hourly', '7 * * * *', $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/cleanup?task=songs',
    headers := jsonb_build_object('Authorization',
                 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cleanup_secret')),
    timeout_milliseconds := 60000);
$$);

select cron.schedule('cleanup-users-daily', '23 3 * * *', $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/cleanup?task=users',
    headers := jsonb_build_object('Authorization',
                 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cleanup_secret')),
    timeout_milliseconds := 60000);
$$);

select cron.schedule('cleanup-orphans-daily', '41 3 * * *', $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/cleanup?task=orphans',
    headers := jsonb_build_object('Authorization',
                 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cleanup_secret')),
    timeout_milliseconds := 60000);
$$);
