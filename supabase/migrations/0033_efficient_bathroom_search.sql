-- search_verified_bathrooms (0005, most recently reshaped in 0032) has
-- always done a plain `ilike '%...%'` scan across every verified bathroom,
-- ordered only by rating - fine at the seed-data scale it was written
-- against, but at 350k+ real rows two things fall over: a leading-wildcard
-- ILIKE can't use a plain B-tree index at all (full table scan on every
-- keystroke), and ranking by rating alone means a low-quality tag/address
-- match can outrank an exact name match. This is exactly the gap the
-- function's own comment already flagged: "TODO: swap ILIKE for pg_trgm/
-- full-text once catalog grows" - it has.
--
-- pg_trgm (not full-text search): the search targets are short proper-noun
-- strings (bathroom/venue names), not prose, and pg_trgm's GIN opclass
-- directly supports ILIKE/'%...%' patterns - a closer fit than tsvector's
-- word-stemming model, and no application-side query rewriting needed.
create extension if not exists "pg_trgm";

create index if not exists bathrooms_name_trgm_idx on bathrooms using gin (name gin_trgm_ops);
create index if not exists bathrooms_venue_name_trgm_idx on bathrooms using gin (venue_name gin_trgm_ops);

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
  -- Match-quality tier first (a name match belongs above an address/tag-only
  -- match regardless of rating), trigram similarity to rank within a tier,
  -- rating/review_count only as the final tiebreaker - the same "text
  -- relevance before quality" ordering src/features/bathrooms/search.ts
  -- already uses for the client-side viewport search, now mirrored here for
  -- the global one.
  order by
    case
      when b.name ilike search_query || '%' then 0
      when b.name ilike '%' || search_query || '%' then 1
      when b.venue_name ilike '%' || search_query || '%' then 2
      else 3
    end,
    greatest(
      similarity(lower(b.name), lower(search_query)),
      similarity(lower(coalesce(b.venue_name, '')), lower(search_query))
    ) desc,
    b.overall_score desc nulls last,
    b.review_count desc
  limit 100;
$$;

comment on function search_verified_bathrooms is 'Public-safe text search over verified bathrooms, trigram-indexed on name/venue_name and ranked by match quality before rating. Never returns private_access_code.';

revoke all on function search_verified_bathrooms(text) from public;
grant execute on function search_verified_bathrooms(text) to authenticated;
