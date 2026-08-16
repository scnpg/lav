-- Bug fix: get_venues_in_bounds (0044/0045) computed its pin score from
-- bathrooms.cleanliness_score, which is never populated by the review
-- pipeline (sync_bathroom_overall_score / 0022, 0028, 0037 all write to
-- overall_score - cleanliness_score is a separate, currently-unused
-- sub-dimension column, confirmed 0 on every row in production). Every
-- other score display in the app (BathroomBottomCard, the old per-bathroom
-- map pins, Feed, leaderboards) reads overall_score - this was the one spot
-- that didn't, which is why rated venues were showing as unrated (0.0) on
-- the map after the venues refactor. Renamed the output column to
-- max_overall_score to match what it actually holds.
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
  max_overall_score numeric,
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
    max(b.overall_score) filter (where b.review_count > 0) as max_overall_score,
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

revoke all on function get_venues_in_bounds(double precision, double precision, double precision, double precision) from public;
grant execute on function get_venues_in_bounds(double precision, double precision, double precision, double precision) to anon, authenticated;
