-- Lets the sign-in screen accept a username instead of requiring an email
-- address. Supabase Auth's identity model is email/phone-based - there's no
-- native "sign in with username" - so this resolves username -> email
-- client-side (see signInWithPassword in apps/mobile/src/lib/auth.tsx)
-- before the real supabase.auth.signInWithPassword({email, password}) call,
-- which still does the actual password verification exactly as before.
--
-- SECURITY DEFINER and granted to anon specifically because this has to be
-- callable *before* sign-in succeeds - there's no authenticated session yet
-- at that point. That does mean anyone can ask "does username X have an
-- account, and if so what's the associated email" - a real, if narrow,
-- information disclosure, accepted here because profiles.username is
-- already public and searchable in this app (searchUsers() in
-- lib/profiles.ts, public profile pages) - this doesn't let anyone learn
-- anything they couldn't already learn by searching for the username, plus
-- the unsurprising fact that *some* email is attached to every account. The
-- sign-in flow itself never turns this into a distinguishable signal: an
-- unresolved username just falls through to signInWithPassword() with a
-- non-matching "email", producing the exact same generic "Invalid login
-- credentials" as a wrong password would.
create or replace function resolve_username_to_email(input_username text)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select u.email
  from profiles p
  join auth.users u on u.id = p.id
  where lower(p.username) = lower(trim(input_username))
  limit 1;
$$;

comment on function resolve_username_to_email is 'Username -> email lookup for sign-in only - see migration comment for the deliberate anon grant and its tradeoff.';

revoke all on function resolve_username_to_email(text) from public;
grant execute on function resolve_username_to_email(text) to anon, authenticated;
