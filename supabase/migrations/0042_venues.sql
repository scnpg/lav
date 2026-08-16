-- Venues: building-level grouping for bathrooms/restrooms (0043 adds the
-- bathrooms.venue_id FK). A venue is a physical place - a mall, MRT
-- station, convenience store, restaurant - that can contain one or more
-- individual restrooms (floors/stalls). Deliberately does NOT touch or
-- rename the existing `bathrooms` table: every one of its ~18 functions/6
-- triggers/5 RLS policies keeps working completely unchanged. This is an
-- additive layer on top, not a restructuring of what already works.
create table if not exists venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  city text,
  region text,
  country text,
  -- Free-text for now (not an enum) - "mall", "mrt_station", "convenience_store",
  -- "restaurant", etc. Nothing reads/writes this yet beyond display, so no
  -- check constraint until real categories are actually needed.
  venue_type text,
  latitude double precision not null,
  longitude double precision not null,
  location geography(Point, 4326) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists venues_location_gix on venues using gist (location);

create extension if not exists "pg_trgm";
create index if not exists venues_name_trgm_idx on venues using gin (name gin_trgm_ops);

-- Same pattern as sync_bathroom_location (0004_triggers.sql) - keeps
-- `location` in sync whenever latitude/longitude is set directly.
create or replace function sync_venue_location()
returns trigger
language plpgsql
as $$
begin
  if new.latitude is not null and new.longitude is not null then
    new.location = geography(st_setsrid(st_makepoint(new.longitude, new.latitude), 4326));
  end if;
  return new;
end;
$$;

drop trigger if exists sync_venue_location on venues;
create trigger sync_venue_location before insert or update on venues
  for each row execute function sync_venue_location();

-- set_updated_at() already exists (0004_triggers.sql), reused as-is.
drop trigger if exists set_updated_at on venues;
create trigger set_updated_at before update on venues
  for each row execute function set_updated_at();

alter table venues enable row level security;

-- Venues aren't moderated content the way an individual bathroom submission
-- is - they're just a grouping derived from already-public bathroom data -
-- so read access is open to everyone, matching bathrooms_select_verified_anon's
-- shape but without a status gate (a venue with zero verified restrooms
-- simply never gets created/returned by get_venues_in_bounds, see 0044).
create policy "venues_select_all"
  on venues for select
  to anon, authenticated
  using (true);

-- Writes only ever happen via find_or_create_venue() (0043), a SECURITY
-- DEFINER function that bypasses RLS entirely - this policy exists purely
-- as a safety net against any other write path, same admin-gated shape as
-- bathrooms_update_admin_only.
create policy "venues_write_admin_only"
  on venues for all
  to authenticated
  using (is_admin())
  with check (is_admin());
