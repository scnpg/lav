-- search_verified_bathrooms (0005) was never updated as BathroomPublic
-- (src/types/database.ts) gained fields over the following 26 migrations -
-- its return table is missing status, access_code_public_allowed, and
-- verified_at. searchBathroomsByText() casts its result straight to
-- BathroomNearby[], so every search result has been silently missing these
-- (undefined at runtime despite TypeScript believing they're always
-- present) - not caught until building a dedicated search screen that
-- actually needs the shape to be honest. Same filter/ordering/security as
-- before, just completing the column list to match BathroomPublic (minus
-- the fields BathroomNearby itself omits: submitted_by, verified_by,
-- created_at, updated_at).
--
-- Postgres won't let CREATE OR REPLACE change a function's OUT-parameter
-- shape (only in-place-compatible tweaks), so the old signature has to be
-- dropped first - safe here: it's just the function definition, no table/
-- data is touched, and the revoke/grant below re-apply the same lockdown
-- immediately after.
drop function if exists search_verified_bathrooms(text);

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
  status text,
  access_type text,
  purchase_required boolean,
  purchase_note text,
  access_difficulty text,
  access_notes text,
  access_code_public_allowed boolean,
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
  verified_at timestamptz,
  last_verified_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    b.id, b.name, b.venue_name, b.description, b.address, b.city, b.region, b.country, b.floor,
    b.latitude, b.longitude, b.status, b.access_type, b.purchase_required, b.purchase_note, b.access_difficulty,
    b.access_notes, b.access_code_public_allowed, b.cost_type, b.cost_amount, b.gender_category, b.toilet_type,
    b.amenities, b.tags, b.open_hours, b.cleanliness_score, b.safety_score, b.privacy_score, b.smell_score,
    b.prestige_score, b.overall_score, b.review_count, b.photo_count, b.verified_at, b.last_verified_at
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
