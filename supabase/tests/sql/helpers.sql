-- helpers.sql — fungsi bantu uji (skema "t"). Dimuat sebelum rls_and_limits.test.sql.
-- Login disimulasikan dengan mengatur klaim JWT dan SET ROLE; auth.uid() membacanya.
create schema if not exists t;
grant usage on schema t to public;

create or replace function t.login(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', u::text, false);
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, false);
  execute 'set role authenticated';
end $$;

create or replace function t.as_service() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claims', '{"role":"service_role"}', false);
  execute 'set role service_role';
end $$;

create or replace function t.as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claims', '{"role":"anon"}', false);
  execute 'set role anon';
end $$;

create or replace function t.logout() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claims', '', false);
end $$;

create or replace function t.check(n text, cond boolean) returns void language plpgsql as $$
begin
  if cond then raise notice 'PASS %', n; else raise warning 'FAIL %', n; end if;
end $$;

create or replace function t.q(stmt text) returns text language plpgsql as $$
declare r text;
begin execute stmt into r; return r; end $$;

-- Pernyataan stmt HARUS gagal dan pesan errornya harus cocok dengan pola pat.
create or replace function t.err(n text, stmt text, pat text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
    raise warning 'FAIL % (tidak ada error)', n;
  exception when others then
    if sqlerrm ~* pat then
      raise notice 'PASS % [%]', n, sqlerrm;
    else
      raise warning 'FAIL % (error lain: %)', n, sqlerrm;
    end if;
  end;
end $$;
