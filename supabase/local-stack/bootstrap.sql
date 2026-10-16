-- Roles and schemas a hosted Supabase project already has. Local stack only.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then create role authenticator login noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then create role supabase_auth_admin login createrole; end if;
end $$;
grant anon, authenticated, service_role to authenticator;
create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";
create schema if not exists auth authorization supabase_auth_admin;
do $$ begin execute format($f$grant create on database %I to supabase_auth_admin$f$, current_database()); end $$;
grant usage on schema public to anon, authenticated, service_role;
grant all on schema public to service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
