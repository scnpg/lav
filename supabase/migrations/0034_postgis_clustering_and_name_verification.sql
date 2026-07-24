-- Lav: same-building spatial clustering + crowdsourced name verification
--
-- Two independent features bundled in one migration (same pattern as
-- 0023_social_and_submissions.sql, which bundled friendships + the
-- submissions queue + the profanity firewall):
--
--   1. get_clustered_bathrooms(): groups verified pins within
--      cluster_radius_meters of each other (e.g. multiple restrooms in the
--      same building) via ST_ClusterDBSCAN.
--   2. bathroom_name_submissions + process_bathroom_verification(): a
--      crowd-vote table where >=5 votes with a >50% normalized-mode
--      majority auto-updates a bathroom's name and flips a new
--      name_verified flag.
--
-- Naming note: the table below is bathroom_name_submissions, not
-- bathroom_submissions - that name is already taken by the admin-approved
-- new-pin/amendment moderation queue (0023_social_and_submissions.sql), a
-- different shape (name/latitude/longitude/details jsonb/status/reviewed_*)
-- serving a different job. `create table if not exists bathroom_submissions`
-- with this feature's shape would have silently no-op'd against that
-- existing table instead of creating anything - naming it distinctly avoids
-- that trap entirely. It's also deliberately not a repurposing of
-- bathroom_suggestions (0021_consensus_suggestions.sql), which already does
-- mode()-based name consensus but with no minimum-count/threshold gate, and
-- which the same trigger also uses to drive amenity consensus - adding this
-- feature's >=5/>50% gate to that shared function would silently change
-- amenity-consensus behavior too. Two name-consensus mechanisms now exist
-- side by side; worth consolidating later, but out of scope here.

-- ============================================================================
-- FEATURE 1: same-building spatial clustering
-- ============================================================================
-- postgis (extension) and bathrooms.location (geography(Point, 4326), kept
-- in sync with latitude/longitude by sync_bathroom_location() in
-- 0004_triggers.sql) already exist - re-enabling the extension here is just
-- an idempotent no-op to match the spec literally.
create extension if not exists "postgis";

create or replace function get_clustered_bathrooms(
  min_lat double precision,
  max_lat double precision,
  min_lng double precision,
  max_lng double precision,
  cluster_radius_meters double precision default 15.0
)
returns table (
  cluster_id integer,
  center_lat double precision,
  center_lng double precision,
  pin_count integer,
  bathrooms jsonb
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with in_bounds as (
    select b.id, b.name, b.floor, b.latitude, b.longitude, b.location
    from bathrooms b
    where b.status = 'verified'
      and b.latitude between min_lat and max_lat
      -- Antimeridian-safe bounds check, same logic as getBathroomsInBounds
      -- (src/features/bathrooms/api.ts): a viewport panned across it reports
      -- west > east, so longitude has to be OR'd across the wrap instead of
      -- a plain BETWEEN.
      and (
        (min_lng <= max_lng and b.longitude between min_lng and max_lng)
        or
        (min_lng > max_lng and (b.longitude >= min_lng or b.longitude <= max_lng))
      )
    -- Backstop against an accidentally city-wide bbox, same reasoning as
    -- BOUNDS_QUERY_LIMIT in api.ts. This RPC is meant to be called on a
    -- tight, building-scale viewport anyway - the default 15m radius only
    -- makes sense at that scale.
    limit 2000
  ),
  clustered as (
    select
      in_bounds.*,
      -- ST_ClusterDBSCAN needs a planar CRS to interpret eps as a distance
      -- rather than degrees - geography's native SRID 4326 is angular. Web
      -- Mercator (3857) is metric but stretches east-west distance by
      -- 1/cos(latitude); at building-scale radii (tens of meters) and
      -- outside polar latitudes that distortion stays far under the radius
      -- itself, so it never changes which pins land in the same cluster.
      -- minpoints = 1 means every pin gets a cluster id - a lone bathroom is
      -- still a valid cluster of 1, never dropped as DBSCAN "noise".
      st_clusterdbscan(st_transform(location::geometry, 3857), cluster_radius_meters, 1)
        over () as cluster_id
    from in_bounds
  )
  select
    cluster_id,
    avg(latitude) as center_lat,
    avg(longitude) as center_lng,
    count(*)::integer as pin_count,
    jsonb_agg(jsonb_build_object('id', id, 'name', name, 'floor', floor) order by name) as bathrooms
  from clustered
  group by cluster_id
  order by pin_count desc;
$$;

comment on function get_clustered_bathrooms is 'Groups verified bathrooms within cluster_radius_meters of each other (e.g. multiple restrooms in the same building) via ST_ClusterDBSCAN. Public-safe: same status=verified filter as get_verified_bathrooms_nearby, never returns private_access_code.';

revoke all on function get_clustered_bathrooms(double precision, double precision, double precision, double precision, double precision) from public;
grant execute on function get_clustered_bathrooms(double precision, double precision, double precision, double precision, double precision) to authenticated;

-- ============================================================================
-- FEATURE 2: crowdsourced name-verification consensus
-- ============================================================================
-- pg_trgm is already enabled (0033_efficient_bathroom_search.sql) - listed
-- here too to match the spec. Not actually used for fuzzy similarity
-- matching below; see the comment on process_bathroom_verification for why.
create extension if not exists "pg_trgm";

create table if not exists bathroom_name_submissions (
  id uuid primary key default gen_random_uuid(),
  bathroom_id uuid not null references bathrooms(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  submitted_name text not null,
  created_at timestamptz not null default now(),
  -- One vote per user per bathroom (upsert to change it). Without this, a
  -- single user inserting 5 rows themselves would clear the >=5 threshold
  -- below alone, defeating the point of a *crowd* consensus - the same
  -- problem bathroom_suggestions (0021) already guards against with its own
  -- unique(bathroom_id, user_id, field_name).
  unique (bathroom_id, user_id)
);

create index bathroom_name_submissions_bathroom_id_idx on bathroom_name_submissions (bathroom_id);
create index bathroom_name_submissions_user_id_idx on bathroom_name_submissions (user_id);

alter table bathroom_name_submissions enable row level security;

create policy bathroom_name_submissions_select_all_authenticated on bathroom_name_submissions
  for select to authenticated using (true);

create policy bathroom_name_submissions_insert_own on bathroom_name_submissions
  for insert to authenticated with check (user_id = auth.uid());

create policy bathroom_name_submissions_update_own on bathroom_name_submissions
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Same profanity firewall already applied to every other user-writable path
-- into bathrooms.name/description (0023_social_and_submissions.sql) - this
-- table can land a blocked term in bathrooms.name via the consensus trigger
-- below just as directly as those, so it gets the same guard.
create or replace function firewall_bathroom_name_submissions()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'INSERT' or new.submitted_name is distinct from old.submitted_name)
     and contains_blocked_term(new.submitted_name) then
    raise exception 'Submission rejected due to policy violations';
  end if;
  return new;
end;
$$;

create trigger firewall_bathroom_name_submissions_trigger
  before insert or update on bathroom_name_submissions
  for each row execute function firewall_bathroom_name_submissions();

-- +5 for a fresh name vote, same rate/insert-only rule as
-- award_points_on_suggestion (0021) - changing your vote (UPDATE) doesn't
-- re-award.
create or replace function award_points_on_name_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform award_points(new.user_id, 5);
  return new;
end;
$$;

create trigger award_points_on_name_submission_trigger
  after insert on bathroom_name_submissions
  for each row execute function award_points_on_name_submission();

-- Crowd-verification signal, deliberately separate from the admin-driven
-- bathrooms.status lifecycle (0002_tables.sql: "invisible to everyone...
-- until an admin sets status='verified'"). "5+ people agree on this name" is
-- a meaningfully weaker claim than "an admin confirmed this listing is real
-- and appropriate", so this never touches `status` - only the two new
-- columns below.
alter table bathrooms
  add column if not exists name_verified boolean not null default false,
  add column if not exists name_verified_at timestamptz;

-- Teach guard_bathroom_update() (0012 / 0013 / 0022) about the two columns
-- above: same treatment as verified_at/last_verified_at - a system-computed
-- signal, not something a non-admin's direct bathrooms UPDATE should be able
-- to set by hand (otherwise a plain community edit through
-- updateBathroomDetails() could self-assign "crowd verified" with no votes
-- at all). process_bathroom_verification() below sets
-- app.bypass_bathroom_guard the same way sync_bathroom_overall_score()
-- (0022) already does, for the same reason: this guard can't otherwise tell
-- "the consensus trigger wrote this" apart from "the voting user tried to
-- set it themselves" - both see the same non-null, non-admin auth.uid().
-- Every other branch of this function is unchanged from 0022.
create or replace function guard_bathroom_update()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null or is_admin() or current_setting('app.bypass_bathroom_guard', true) = 'true' then
    return new;
  end if;

  new.status := old.status;
  new.submitted_by := old.submitted_by;
  new.verified_by := old.verified_by;
  new.verified_at := old.verified_at;
  new.last_verified_at := old.last_verified_at;
  new.latitude := old.latitude;
  new.longitude := old.longitude;
  new.private_access_code := old.private_access_code;
  new.access_code_public_allowed := old.access_code_public_allowed;
  new.submission_latitude := old.submission_latitude;
  new.submission_longitude := old.submission_longitude;
  new.dataset_source := old.dataset_source;
  new.cleanliness_score := old.cleanliness_score;
  new.safety_score := old.safety_score;
  new.privacy_score := old.privacy_score;
  new.smell_score := old.smell_score;
  new.prestige_score := old.prestige_score;
  new.overall_score := old.overall_score;
  new.review_count := old.review_count;
  new.photo_count := old.photo_count;
  new.created_at := old.created_at;
  new.name_verified := old.name_verified;
  new.name_verified_at := old.name_verified_at;

  return new;
end;
$$;

-- Normalizes every live vote for a bathroom (lowercase, strip anything that
-- isn't a letter/digit/space, collapse whitespace) and takes the exact-match
-- mode of the result - "keyword matching" in the sense of matching
-- normalized-equal strings, not true typo-tolerant fuzzy clustering (e.g.
-- "Main Lobby" and "Main Loby" still land in separate buckets). Doing that
-- well needs a similarity-threshold clustering pass over pg_trgm's
-- similarity(), which is a reasonable follow-up but isn't built here.
create or replace function process_bathroom_verification(target_bathroom_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  total_submissions integer;
  winning_name text;
  winning_votes integer;
begin
  select count(*) into total_submissions
  from bathroom_name_submissions
  where bathroom_id = target_bathroom_id;

  if total_submissions < 5 then
    return;
  end if;

  select normalized_name, vote_count into winning_name, winning_votes
  from (
    select
      regexp_replace(
        regexp_replace(trim(lower(submitted_name)), '[^a-z0-9 ]+', '', 'g'),
        '\s+', ' ', 'g'
      ) as normalized_name,
      count(*) as vote_count
    from bathroom_name_submissions
    where bathroom_id = target_bathroom_id
    group by 1
  ) tallied
  where normalized_name <> ''
  order by vote_count desc
  limit 1;

  if winning_name is null or winning_votes::numeric / total_submissions <= 0.5 then
    return;
  end if;

  perform set_config('app.bypass_bathroom_guard', 'true', true);

  update bathrooms
  set name = initcap(winning_name),
      name_verified = true,
      name_verified_at = now()
  where id = target_bathroom_id;
end;
$$;

create or replace function process_bathroom_verification_trigger_fn()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform process_bathroom_verification(new.bathroom_id);
  return new;
end;
$$;

create trigger process_bathroom_verification_trigger
  after insert or update on bathroom_name_submissions
  for each row execute function process_bathroom_verification_trigger_fn();
