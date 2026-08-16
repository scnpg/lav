-- One-time cleanup after the venues backfill (0042_venues.sql /
-- 0043_bathrooms_venue_id.sql + the find_or_create_venue bulk backfill):
-- every multi-restroom venue currently has venues.name set to whatever
-- restroom happened to create it first (e.g. "DREAM PLAZA 5F-A區男"), and
-- every one of its restrooms still carries that same full "VENUE FLOOR"
-- string as its own name. This derives a clean venue name (the longest
-- common prefix shared by all its restroom names) and strips that prefix
-- from each restroom's own name, leaving just the floor/detail remainder
-- (e.g. venue "DREAM PLAZA", restroom "2F女").
--
-- Safe to re-run: venues already at their final (non-strippable) name are
-- no-ops, since the computed prefix of already-split names is empty.

-- Longest common prefix of two strings, comparing by Unicode codepoint so
-- multi-byte characters (Chinese, etc.) are never split mid-character.
create or replace function pg_temp.lcp(a text, b text)
returns text
language plpgsql
immutable
as $$
declare
  i integer := 1;
  max_len integer := least(length(a), length(b));
begin
  while i <= max_len and substr(a, i, 1) = substr(b, i, 1) loop
    i := i + 1;
  end loop;
  return substr(a, 1, i - 1);
end;
$$;

-- The common prefix of an entire set of strings equals the common prefix of
-- its lexicographic min and max member - computing just those two avoids an
-- O(n) scan per venue for venues with many restrooms.
with venue_bounds as (
  select
    venue_id,
    min(name) as min_name,
    max(name) as max_name,
    count(*) as restroom_count
  from bathrooms
  where venue_id is not null
  group by venue_id
  having count(*) > 1
),
prefixes as (
  select
    venue_id,
    restroom_count,
    -- Trim trailing partial-word/whitespace noise (e.g. a prefix ending
    -- mid-floor-code) back to the last space/punctuation boundary, so a
    -- coincidental shared substring across otherwise-unrelated restroom
    -- names doesn't produce a nonsense venue name.
    regexp_replace(pg_temp.lcp(min_name, max_name), '[\s\-–—·・#:]+$', '') as raw_prefix
  from venue_bounds
),
-- Sanity floor: require at least 3 characters so a single shared letter/digit
-- (common by chance across unrelated restroom names) never becomes the
-- venue name - those venues keep whatever name they already have.
usable_prefixes as (
  select venue_id, restroom_count, raw_prefix
  from prefixes
  where length(raw_prefix) >= 3
),
venue_update as (
  update venues v
  set name = up.raw_prefix, updated_at = now()
  from usable_prefixes up
  where v.id = up.venue_id
    and v.name is distinct from up.raw_prefix
  returning v.id
)
select count(*) as venues_renamed from venue_update;

-- Strip the same prefix from each restroom's own name, trimming any
-- leftover leading separator/whitespace. Only applied where stripping
-- leaves a non-empty remainder, so a restroom whose full name IS the
-- prefix (nothing left to distinguish it) keeps its original name rather
-- than going blank.
with usable_prefixes as (
  select
    venue_id,
    regexp_replace(pg_temp.lcp(min_name, max_name), '[\s\-–—·・#:]+$', '') as raw_prefix
  from (
    select venue_id, min(name) as min_name, max(name) as max_name, count(*) as n
    from bathrooms
    where venue_id is not null
    group by venue_id
    having count(*) > 1
  ) b
  where length(regexp_replace(pg_temp.lcp(min_name, max_name), '[\s\-–—·・#:]+$', '')) >= 3
),
restroom_update as (
  update bathrooms b
  set name = trimmed.remainder
  from (
    select
      b2.id,
      regexp_replace(substr(b2.name, length(up.raw_prefix) + 1), '^[\s\-–—·・#:]+', '') as remainder
    from bathrooms b2
    join usable_prefixes up on up.venue_id = b2.venue_id
  ) trimmed
  where b.id = trimmed.id
    and trimmed.remainder <> ''
    and b.name is distinct from trimmed.remainder
  returning b.id
)
select count(*) as restrooms_renamed from restroom_update;
