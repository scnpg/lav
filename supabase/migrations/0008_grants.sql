-- Lav: baseline table/sequence/function grants.
--
-- Root cause this fixes: every migration so far (0002-0007) created tables
-- as the `postgres` role. Postgres's default-privilege ACL for objects
-- owned by `postgres` only extends Delete/Truncate/References/Trigger to
-- anon/authenticated/service_role - never Select/Insert/Update. RLS
-- policies (0006_rls.sql) only narrow access that the base GRANT already
-- allows; without this migration, RLS is moot because Postgres denies the
-- request before RLS is ever evaluated. Confirmed locally: authenticated
-- had zero SELECT on `bathrooms`, and even service_role (BYPASSRLS) got
-- "permission denied for table bathrooms".
--
-- This is the standard Supabase pattern: grant broadly at the table level,
-- let RLS do the actual per-row/per-column restriction. Column-level
-- REVOKEs in 0006_rls.sql (private_access_code etc.) still apply on top of
-- this - GRANT ALL here does not undo a more specific column REVOKE.
grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant all on all tables in schema public to service_role;

grant usage, select on all sequences in schema public to anon, authenticated, service_role;

grant execute on all functions in schema public to anon, authenticated, service_role;

-- Apply the same defaults to anything created by future migrations too -
-- otherwise this same bug reappears the next time a table/function is added.
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;
alter default privileges in schema public
  grant all on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant execute on functions to anon, authenticated, service_role;
