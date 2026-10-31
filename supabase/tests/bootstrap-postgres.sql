-- ONLY for an isolated PostgreSQL integration test cluster, NOT a Supabase migration.
-- Provides Supabase's role/identity contract without pretending to run GoTrue/PostgREST.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'sub')::uuid
$$;

grant usage on schema auth to anon, authenticated;
