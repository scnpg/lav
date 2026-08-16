-- Adds `single_bathroom_id` to get_venues_in_bounds (0044): the id of the
-- venue's one restroom when restroom_count = 1 (the overwhelming majority -
-- ~98.7% of restrooms have no sibling at their venue), null otherwise. Lets
-- the map navigate straight to that restroom's detail screen on tap without
-- an extra round-trip for the common case - only a multi-restroom venue
-- needs a follow-up fetch (getBathroomsByVenueId) to list its members.
-- Postgres refuses to CREATE OR REPLACE a table-returning function when the
-- OUT-parameter shape changes (adding single_bathroom_id here) - must drop
-- first.
drop function if exists get_venues_in_bounds(double precision, double precision, double precision, double precision);

create function get_venues_in_bounds(
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
  max_cleanliness numeric,
  single_bathroom_id uuid
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
    max(b.cleanliness_score) filter (where b.review_count > 0) as max_cleanliness,
    -- min()/max() aren't defined for uuid - array_agg's first element works
    -- for any type instead.
    case when count(b.id) = 1 then (array_agg(b.id))[1] else null end as single_bathroom_id
  from venues v
  join bathrooms b on b.venue_id = v.id and b.status = 'verified'
  where v.latitude between min_lat and max_lat
    and (
      (min_lng <= max_lng and v.longitude between min_lng and max_lng)
      or
      (min_lng > max_lng and (v.longitude >= min_lng or v.longitude <= max_lng))
    )
  group by v.id, v.name, v.latitude, v.longitude
  limit 2000;
$$;

-- Dropping the function drops its grants too - reinstate the same anon +
-- authenticated read access from 0044.
revoke all on function get_venues_in_bounds(double precision, double precision, double precision, double precision) from public;
grant execute on function get_venues_in_bounds(double precision, double precision, double precision, double precision) to anon, authenticated;
