-- Lav: RPC functions
--
-- Design note: Supabase/Postgres only has three DB-level roles that matter
-- here (anon, authenticated, service_role) - "admin" is just a value in
-- profiles.role, not a separate Postgres role. That means plain column
-- GRANT/REVOKE can't say "admins may see this column, other authenticated
-- users may not" - both are the same `authenticated` role. So:
--   * is_admin() is SECURITY DEFINER so it can check profiles.role without
--     depending on the caller's own RLS visibility into profiles.
--   * Sensitive bathroom columns (private_access_code, submission_*) are
--     column-REVOKEd from anon/authenticated entirely in 0006_rls.sql, and
--     only readable through admin_get_bathroom_private_fields() below, which
--     runs as SECURITY DEFINER and does its own is_admin() check.
--   * get_verified_bathrooms_nearby / search_verified_bathrooms explicitly
--     enumerate "public-safe" columns rather than `select *`, as a second,
--     redundant layer of protection.

create or replace function is_admin(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from profiles where id = check_user_id and role = 'admin'
  );
$$;

comment on function is_admin is 'True if check_user_id has profiles.role = admin. SECURITY DEFINER so RLS policies can call it without recursive-RLS issues.';

-- ---------------------------------------------------------------------------
-- get_verified_bathrooms_nearby: powers the Map tab.
-- ---------------------------------------------------------------------------
create or replace function get_verified_bathrooms_nearby(
  lat double precision,
  lng double precision,
  radius_meters integer default 3000
)
returns table (
  id uuid,
  name text,
  venue_name text,
  description text,
  address text,
  city text,
  region text,
  country text,
  floor text,
  latitude double precision,
  longitude double precision,
  access_type text,
  purchase_required boolean,
  purchase_note text,
  access_difficulty text,
  access_notes text,
  cost_type text,
  cost_amount numeric,
  gender_category text,
  toilet_type text,
  amenities jsonb,
  tags text[],
  open_hours jsonb,
  cleanliness_score numeric,
  safety_score numeric,
  privacy_score numeric,
  smell_score numeric,
  prestige_score numeric,
  overall_score numeric,
  review_count int,
  photo_count int,
  last_verified_at timestamptz,
  distance_meters double precision
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    b.id, b.name, b.venue_name, b.description, b.address, b.city, b.region, b.country, b.floor,
    b.latitude, b.longitude, b.access_type, b.purchase_required, b.purchase_note, b.access_difficulty,
    b.access_notes, b.cost_type, b.cost_amount, b.gender_category, b.toilet_type, b.amenities, b.tags,
    b.open_hours, b.cleanliness_score, b.safety_score, b.privacy_score, b.smell_score, b.prestige_score,
    b.overall_score, b.review_count, b.photo_count, b.last_verified_at,
    st_distance(b.location, st_setsrid(st_makepoint(lng, lat), 4326)::geography) as distance_meters
  from bathrooms b
  where b.status = 'verified'
    and st_dwithin(b.location, st_setsrid(st_makepoint(lng, lat), 4326)::geography, radius_meters)
  order by distance_meters asc
  limit 200;
$$;

comment on function get_verified_bathrooms_nearby is 'Public-safe nearby search for the map. Never returns private_access_code.';

revoke all on function get_verified_bathrooms_nearby(double precision, double precision, integer) from public;
grant execute on function get_verified_bathrooms_nearby(double precision, double precision, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- search_verified_bathrooms: powers the Map tab search bar.
-- ---------------------------------------------------------------------------
create or replace function search_verified_bathrooms(search_query text)
returns table (
  id uuid,
  name text,
  venue_name text,
  description text,
  address text,
  city text,
  region text,
  country text,
  floor text,
  latitude double precision,
  longitude double precision,
  access_type text,
  purchase_required boolean,
  purchase_note text,
  access_difficulty text,
  access_notes text,
  cost_type text,
  cost_amount numeric,
  gender_category text,
  toilet_type text,
  amenities jsonb,
  tags text[],
  open_hours jsonb,
  cleanliness_score numeric,
  safety_score numeric,
  privacy_score numeric,
  smell_score numeric,
  prestige_score numeric,
  overall_score numeric,
  review_count int,
  photo_count int,
  last_verified_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    b.id, b.name, b.venue_name, b.description, b.address, b.city, b.region, b.country, b.floor,
    b.latitude, b.longitude, b.access_type, b.purchase_required, b.purchase_note, b.access_difficulty,
    b.access_notes, b.cost_type, b.cost_amount, b.gender_category, b.toilet_type, b.amenities, b.tags,
    b.open_hours, b.cleanliness_score, b.safety_score, b.privacy_score, b.smell_score, b.prestige_score,
    b.overall_score, b.review_count, b.photo_count, b.last_verified_at
  from bathrooms b
  where b.status = 'verified'
    and (
      b.name ilike '%' || search_query || '%'
      or b.venue_name ilike '%' || search_query || '%'
      or b.address ilike '%' || search_query || '%'
      or b.city ilike '%' || search_query || '%'
      or b.region ilike '%' || search_query || '%'
      or b.country ilike '%' || search_query || '%'
      or exists (select 1 from unnest(b.tags) tag where tag ilike '%' || search_query || '%')
    )
  order by b.overall_score desc nulls last, b.review_count desc
  limit 100;
$$;

comment on function search_verified_bathrooms is 'Public-safe text search over verified bathrooms. Never returns private_access_code. TODO: swap ILIKE for pg_trgm/full-text once catalog grows.';

revoke all on function search_verified_bathrooms(text) from public;
grant execute on function search_verified_bathrooms(text) to authenticated;

-- ---------------------------------------------------------------------------
-- update_bathroom_scores: recompute aggregate scores from reviews.
-- TODO(scores): MVP calls this from the client right after a review is
-- inserted/updated/deleted. Move to a statement-level trigger on `reviews`
-- or a scheduled job (pg_cron) once write volume makes per-write client
-- calls unreliable (e.g. user closes app before the RPC fires).
-- ---------------------------------------------------------------------------
create or replace function update_bathroom_scores(target_bathroom_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update bathrooms b
  set
    cleanliness_score = coalesce(r.avg_cleanliness, 0),
    safety_score = coalesce(r.avg_safety, 0),
    privacy_score = coalesce(r.avg_privacy, 0),
    smell_score = coalesce(r.avg_smell, 0),
    prestige_score = coalesce(r.avg_prestige, 0),
    overall_score = coalesce(r.avg_overall, 0),
    review_count = coalesce(r.review_count, 0)
  from (
    select
      avg(cleanliness)::numeric(4,2) as avg_cleanliness,
      avg(safety)::numeric(4,2) as avg_safety,
      avg(privacy)::numeric(4,2) as avg_privacy,
      avg(smell)::numeric(4,2) as avg_smell,
      avg(prestige)::numeric(4,2) as avg_prestige,
      avg(overall)::numeric(4,2) as avg_overall,
      count(*) as review_count
    from reviews
    where bathroom_id = target_bathroom_id
  ) r
  where b.id = target_bathroom_id;
end;
$$;

revoke all on function update_bathroom_scores(uuid) from public;
grant execute on function update_bathroom_scores(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- find_nearby_duplicate_bathrooms: powers the Submit screen's 50m warning.
-- Intentionally returns only id/name/status/distance - never the full row -
-- since the caller may not otherwise be allowed to see someone else's
-- pending submission.
-- ---------------------------------------------------------------------------
create or replace function find_nearby_duplicate_bathrooms(
  lat double precision,
  lng double precision,
  radius_meters integer default 50
)
returns table (
  id uuid,
  name text,
  status text,
  distance_meters double precision
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    b.id, b.name, b.status,
    st_distance(b.location, st_setsrid(st_makepoint(lng, lat), 4326)::geography) as distance_meters
  from bathrooms b
  where b.status in ('verified', 'pending')
    and st_dwithin(b.location, st_setsrid(st_makepoint(lng, lat), 4326)::geography, radius_meters)
  order by distance_meters asc
  limit 10;
$$;

revoke all on function find_nearby_duplicate_bathrooms(double precision, double precision, integer) from public;
grant execute on function find_nearby_duplicate_bathrooms(double precision, double precision, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- admin_get_bathroom_private_fields: the *only* way to read
-- private_access_code / submission_latitude / submission_longitude.
-- ---------------------------------------------------------------------------
create or replace function admin_get_bathroom_private_fields(target_bathroom_id uuid)
returns table (
  private_access_code text,
  submission_latitude double precision,
  submission_longitude double precision
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not is_admin(auth.uid()) then
    raise exception 'Only admins can view private bathroom fields';
  end if;

  return query
    select b.private_access_code, b.submission_latitude, b.submission_longitude
    from bathrooms b
    where b.id = target_bathroom_id;
end;
$$;

revoke all on function admin_get_bathroom_private_fields(uuid) from public;
grant execute on function admin_get_bathroom_private_fields(uuid) to authenticated;
