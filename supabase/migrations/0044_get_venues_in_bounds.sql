-- Venue-aware counterpart to getBathroomsInBounds - the map's new primary
-- pin-rendering data source (one row per venue, not per bathroom). Reuses
-- venues.venue_id (0043) instead of runtime DBSCAN, since venue membership
-- is now a real, precomputed FK rather than something to recompute per
-- request - get_clustered_bathrooms (0034) stays as-is for its own callers.
--
-- Granted to anon as well as authenticated: the map is publicly browsable
-- without signing in (only editing actions prompt sign-in), so this needs
-- the same anon-read reach as bathrooms_select_verified_anon (0012) or
-- logged-out users would see a blank map once the app's pin-fetching
-- switches to this RPC.
create or replace function get_venues_in_bounds(
  min_lat double precision,
  max_lat double precision,
  min_lng double precision,
  max_lng double precision
)
returns table (
  id uuid,
  name text,
  latitude double precision,
  longitude double precision,
  restroom_count integer,
  max_cleanliness numeric
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    v.id,
    v.name,
    v.latitude,
    v.longitude,
    count(b.id)::integer as restroom_count,
    -- Only among RATED restrooms (review_count > 0) - same "never let an
    -- unrated member drag down/fake a score" rule already used for cluster
    -- averaging in MapView.web.tsx/pinColor.ts.
    max(b.cleanliness_score) filter (where b.review_count > 0) as max_cleanliness
  from venues v
  join bathrooms b on b.venue_id = v.id and b.status = 'verified'
  where v.latitude between min_lat and max_lat
    -- Antimeridian-safe bounds check, same logic as get_clustered_bathrooms
    -- (0034) / getBathroomsInBounds (src/features/bathrooms/api.ts).
    and (
      (min_lng <= max_lng and v.longitude between min_lng and max_lng)
      or
      (min_lng > max_lng and (v.longitude >= min_lng or v.longitude <= max_lng))
    )
  group by v.id, v.name, v.latitude, v.longitude
  -- Same backstop reasoning as getBathroomsInBounds's BOUNDS_QUERY_LIMIT -
  -- venues are already deduplicated so this caps far higher than the
  -- per-bathroom limit ever needed to.
  limit 2000;
$$;

revoke all on function get_venues_in_bounds(double precision, double precision, double precision, double precision) from public;
grant execute on function get_venues_in_bounds(double precision, double precision, double precision, double precision) to anon, authenticated;
