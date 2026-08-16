-- Links bathrooms (individual restrooms) to venues (the building they're
-- in). Nullable and ON DELETE SET NULL - a restroom never loses its own
-- identity if a venue is ever removed, and nothing here retroactively
-- assigns existing rows (that's scripts/backfill-venues.mjs, run once
-- separately against the already-imported ~355k rows).
alter table bathrooms add column if not exists venue_id uuid references venues(id) on delete set null;

create index if not exists bathrooms_venue_id_idx on bathrooms (venue_id);

-- Building-scale (~15m) proximity lookup, matching get_clustered_bathrooms's
-- (0034) already-proven DBSCAN radius for "same physical building" rather
-- than inventing a new distance heuristic. Finds an existing venue within
-- range and returns it; otherwise creates one named `candidate_name`. This
-- is the ONE place venue-assignment logic lives - both the one-time
-- backfill script and the ongoing insert trigger below call it, so there's
-- no duplicated "what counts as the same venue" logic to drift apart.
create or replace function find_or_create_venue(p_lat double precision, p_lng double precision, p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  found_venue_id uuid;
  new_venue_id uuid;
begin
  select id into found_venue_id
  from venues
  where ST_DWithin(
    location,
    geography(ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)),
    15
  )
  order by location <-> geography(ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326))
  limit 1;

  if found_venue_id is not null then
    return found_venue_id;
  end if;

  insert into venues (name, latitude, longitude)
  values (p_name, p_lat, p_lng)
  returning id into new_venue_id;

  return new_venue_id;
end;
$$;

revoke all on function find_or_create_venue(double precision, double precision, text) from public;
grant execute on function find_or_create_venue(double precision, double precision, text) to authenticated;

-- Keeps new bathrooms (submissions, admin approvals, future ingestion runs)
-- assigned to a venue automatically going forward - the backfill script
-- only ever needs to run once for pre-existing rows, not repeatedly.
-- AFTER INSERT (not BEFORE) because it needs a real, committed bathroom id
-- to update back onto - and because guard_bathroom_update only fires on
-- UPDATE, this trigger's own UPDATE back onto the just-inserted row still
-- needs the app.bypass_bathroom_guard flag (same convention as
-- sync_bathroom_overall_score, 0022) so that UPDATE doesn't itself get
-- reverted by the guard.
create or replace function assign_venue_on_bathroom_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_venue_id uuid;
begin
  if new.venue_id is not null then
    return new;
  end if;

  resolved_venue_id := find_or_create_venue(new.latitude, new.longitude, new.name);

  perform set_config('app.bypass_bathroom_guard', 'true', true);
  update bathrooms set venue_id = resolved_venue_id where id = new.id;

  return new;
end;
$$;

drop trigger if exists assign_venue_on_bathroom_insert on bathrooms;
create trigger assign_venue_on_bathroom_insert after insert on bathrooms
  for each row execute function assign_venue_on_bathroom_insert();

-- guard_bathroom_update (0012/0013/0022/0034) protects a fixed list of
-- system-owned columns from non-admin UPDATEs - venue_id is exactly that
-- kind of column (assigned by the trigger above, not something a community
-- edit should be able to repoint), so it's added to the same revert list.
-- Everything else about this function is unchanged from 0034's version.
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
  new.venue_id := old.venue_id;

  return new;
end;
$$;
