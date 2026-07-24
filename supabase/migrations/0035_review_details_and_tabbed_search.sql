-- Lav: review-time description/access-notes proposals + linguistic-average
-- consensus, plus extending bathroom search to cover description.
--
-- Naming note: the feature that requested this called the second field
-- "access instructions". bathrooms already has a column doing exactly that
-- job - `access_notes` (0002_tables.sql) - and the detail screen already
-- labels it "Access instructions" to the user (DetailsGrid.tsx). Adding a
-- second, parallel `access_instructions` column would just give the app two
-- different "how do I get in" fields that can drift out of sync, so
-- everything below writes to the existing `access_notes` column instead of
-- creating a new one. `description` already exists on bathrooms too - no new
-- columns needed there either.
--
-- Where proposals come from, and why they're treated differently:
--   - bathroom_submissions (new pin / amendment, admin-approved): a human
--     already reviews every field before it goes live
--     (admin_approve_all_pending_submissions, 0026), so description/
--     access_notes proposed there write straight to the bathroom on
--     approval, same as name/access_type/amenities already do - no
--     algorithmic consensus needed on top of a human gate.
--   - bathroom_reviews (ongoing, one row per user per bathroom, no human
--     review): this is the untrusted, ever-growing pool the "linguistic
--     average" is actually computed from.

-- ============================================================================
-- Review-time description / access-notes proposals
-- ============================================================================
alter table bathroom_reviews
  add column if not exists description text,
  add column if not exists access_notes text;

-- Widen the existing review_text firewall (0023) to cover the two new
-- columns with the same per-column "only re-check what actually changed"
-- guard it already uses.
create or replace function firewall_bathroom_reviews()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'INSERT' or new.review_text is distinct from old.review_text) and contains_blocked_term(new.review_text) then
    raise exception 'Submission rejected due to policy violations';
  end if;
  if (tg_op = 'INSERT' or new.description is distinct from old.description) and contains_blocked_term(new.description) then
    raise exception 'Submission rejected due to policy violations';
  end if;
  if (tg_op = 'INSERT' or new.access_notes is distinct from old.access_notes) and contains_blocked_term(new.access_notes) then
    raise exception 'Submission rejected due to policy violations';
  end if;
  return new;
end;
$$;

-- ============================================================================
-- Linguistic-average consensus
-- ============================================================================
-- No real LLM call here - that needs a hosted-model API key and a
-- provider/cost decision that belongs to a person, not something to wire up
-- silently in a migration. Instead: candidates are ranked by pg_trgm
-- similarity (already enabled, 0033) and the most "central" real submission
-- wins - the one with the highest total similarity to every other live
-- submission - which is a legitimate frequency/similarity-weighted
-- consensus technique, just an extractive one (picks an actual submitted
-- sentence) rather than a generative one (fabricates new prose). Swapping in
-- a real LLM call later is a reasonable follow-up, not done here.
--
-- Three tiers per field, matching the spec: 0 candidates -> leave the
-- bathroom's current value alone (nothing to summarize yet); 1-2 -> mode()
-- if two candidates happen to match exactly, else the most recent one; >=3
-- -> the trigram-medoid pick described above. contains_blocked_term()
-- filtering here is defense in depth - the firewall above already rejects a
-- blocked-term review outright - same belt-and-suspenders pattern as
-- get_verified_bathrooms_nearby's own column allowlist over its RLS policy.
create or replace function update_bathroom_linguistic_summary(target_bathroom_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  description_count integer;
  description_consensus text;
  access_notes_count integer;
  access_notes_consensus text;
begin
  select count(*) into description_count
  from bathroom_reviews
  where bathroom_id = target_bathroom_id
    and description is not null
    and trim(description) <> ''
    and not contains_blocked_term(description);

  if description_count = 0 then
    description_consensus := null;
  elsif description_count < 3 then
    select coalesce(
      (
        select trim(description) from bathroom_reviews
        where bathroom_id = target_bathroom_id and description is not null and trim(description) <> ''
          and not contains_blocked_term(description)
        group by trim(description)
        having count(*) > 1
        order by count(*) desc
        limit 1
      ),
      (
        select trim(description) from bathroom_reviews
        where bathroom_id = target_bathroom_id and description is not null and trim(description) <> ''
          and not contains_blocked_term(description)
        order by created_at desc
        limit 1
      )
    ) into description_consensus;
  else
    select c1.text_value into description_consensus
    from (
      select id, trim(description) as text_value
      from bathroom_reviews
      where bathroom_id = target_bathroom_id and description is not null and trim(description) <> ''
        and not contains_blocked_term(description)
    ) c1
    join (
      select id, trim(description) as text_value
      from bathroom_reviews
      where bathroom_id = target_bathroom_id and description is not null and trim(description) <> ''
        and not contains_blocked_term(description)
    ) c2 on c2.id <> c1.id
    group by c1.id, c1.text_value
    order by sum(similarity(lower(c1.text_value), lower(c2.text_value))) desc
    limit 1;
  end if;

  select count(*) into access_notes_count
  from bathroom_reviews
  where bathroom_id = target_bathroom_id
    and access_notes is not null
    and trim(access_notes) <> ''
    and not contains_blocked_term(access_notes);

  if access_notes_count = 0 then
    access_notes_consensus := null;
  elsif access_notes_count < 3 then
    select coalesce(
      (
        select trim(access_notes) from bathroom_reviews
        where bathroom_id = target_bathroom_id and access_notes is not null and trim(access_notes) <> ''
          and not contains_blocked_term(access_notes)
        group by trim(access_notes)
        having count(*) > 1
        order by count(*) desc
        limit 1
      ),
      (
        select trim(access_notes) from bathroom_reviews
        where bathroom_id = target_bathroom_id and access_notes is not null and trim(access_notes) <> ''
          and not contains_blocked_term(access_notes)
        order by created_at desc
        limit 1
      )
    ) into access_notes_consensus;
  else
    select c1.text_value into access_notes_consensus
    from (
      select id, trim(access_notes) as text_value
      from bathroom_reviews
      where bathroom_id = target_bathroom_id and access_notes is not null and trim(access_notes) <> ''
        and not contains_blocked_term(access_notes)
    ) c1
    join (
      select id, trim(access_notes) as text_value
      from bathroom_reviews
      where bathroom_id = target_bathroom_id and access_notes is not null and trim(access_notes) <> ''
        and not contains_blocked_term(access_notes)
    ) c2 on c2.id <> c1.id
    group by c1.id, c1.text_value
    order by sum(similarity(lower(c1.text_value), lower(c2.text_value))) desc
    limit 1;
  end if;

  -- description/access_notes aren't in guard_bathroom_update()'s pinned-back
  -- list (0012/0022/0034) - they're already treated as freely
  -- community-editable descriptive fields (see updateBathroomDetails /
  -- BathroomFillMissingPatch in bathrooms/api.ts), so no
  -- app.bypass_bathroom_guard flag is needed here the way
  -- sync_bathroom_overall_score/process_bathroom_verification need one for
  -- the columns they guard.
  update bathrooms
  set
    description = coalesce(description_consensus, description),
    access_notes = coalesce(access_notes_consensus, access_notes)
  where id = target_bathroom_id
    and (
      (description_consensus is not null and description_consensus is distinct from description)
      or (access_notes_consensus is not null and access_notes_consensus is distinct from access_notes)
    );
end;
$$;

-- Only recomputes when a description/access_notes proposal actually changed
-- - re-rating a place (overall_rating, star sub-scores) without touching
-- either text field doesn't need a fresh consensus pass. tg_op/old/new
-- comparisons are checked in the function body (matching
-- firewall_bathroom_reviews' own convention just above), not in a trigger
-- WHEN clause - WHEN conditions only have OLD/NEW bound, not TG_OP.
create or replace function update_bathroom_linguistic_summary_trigger_fn()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT'
     or new.description is distinct from old.description
     or new.access_notes is distinct from old.access_notes then
    perform update_bathroom_linguistic_summary(new.bathroom_id);
  end if;
  return new;
end;
$$;

create trigger update_bathroom_linguistic_summary_trigger
  after insert or update on bathroom_reviews
  for each row execute function update_bathroom_linguistic_summary_trigger_fn();

-- ============================================================================
-- bathroom_submissions: description/access_notes ride in the existing
-- `details` jsonb bag (0023), matching how access_type/cost_type/amenities/
-- photo_urls already work there - no schema change needed for a jsonb
-- column, just teaching the firewall and the admin-approval function about
-- the two new keys.
-- ============================================================================
create or replace function firewall_bathroom_submissions()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'INSERT' or new.name is distinct from old.name) and contains_blocked_term(new.name) then
    raise exception 'Submission rejected due to policy violations';
  end if;
  if (tg_op = 'INSERT' or new.details ->> 'description' is distinct from old.details ->> 'description')
     and contains_blocked_term(new.details ->> 'description') then
    raise exception 'Submission rejected due to policy violations';
  end if;
  if (tg_op = 'INSERT' or new.details ->> 'access_notes' is distinct from old.details ->> 'access_notes')
     and contains_blocked_term(new.details ->> 'access_notes') then
    raise exception 'Submission rejected due to policy violations';
  end if;
  return new;
end;
$$;

-- Same function as 0026, extended to also copy description/access_notes
-- from details onto the bathroom - everything else (photo handling, status
-- transitions, the is_admin() gate) is unchanged from that migration. This
-- matters more than it might for the other detail fields: this bulk
-- approval path is explicitly "no per-row review" (see 0026's own comment),
-- so the firewall widened above is the only content check description/
-- access_notes get before landing on a live bathroom via this path.
create or replace function public.admin_approve_all_pending_submissions()
returns table (
  submission_id uuid,
  bathroom_id uuid,
  action text
)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  sub record;
  target_bathroom_id uuid;
  photo_url text;
  storage_prefix constant text := '/storage/v1/object/public/bathroom_photos/';
begin
  if not is_admin(auth.uid()) then
    raise exception 'Only admins can approve bathroom submissions';
  end if;

  for sub in
    select * from bathroom_submissions where status = 'pending' order by created_at
  loop
    if sub.bathroom_id is null then
      insert into bathrooms (
        name, latitude, longitude, status,
        access_type, amenities, description, access_notes,
        submitted_by, verified_by, verified_at, last_verified_at
      )
      values (
        sub.name, sub.latitude, sub.longitude, 'verified',
        sub.details ->> 'access_type',
        coalesce(sub.details -> 'amenities', '{}'::jsonb),
        sub.details ->> 'description',
        sub.details ->> 'access_notes',
        sub.user_id, auth.uid(), now(), now()
      )
      returning id into target_bathroom_id;
    else
      update bathrooms b set
        name = coalesce(sub.name, b.name),
        access_type = coalesce(sub.details ->> 'access_type', b.access_type),
        amenities = b.amenities || coalesce(sub.details -> 'amenities', '{}'::jsonb),
        description = coalesce(sub.details ->> 'description', b.description),
        access_notes = coalesce(sub.details ->> 'access_notes', b.access_notes),
        last_verified_at = now()
      where b.id = sub.bathroom_id;
      target_bathroom_id := sub.bathroom_id;
    end if;

    for photo_url in
      select jsonb_array_elements_text(coalesce(sub.details -> 'photo_urls', '[]'::jsonb))
    loop
      insert into bathroom_images (bathroom_id, user_id, storage_path, public_url)
      values (
        target_bathroom_id,
        sub.user_id,
        regexp_replace(photo_url, '^.*' || storage_prefix, ''),
        photo_url
      );
    end loop;

    update bathroom_submissions
    set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
    where id = sub.id;

    submission_id := sub.id;
    bathroom_id := target_bathroom_id;
    action := case when sub.bathroom_id is null then 'created' else 'updated' end;
    return next;
  end loop;
end;
$$;

-- ============================================================================
-- Bathroom search: cover description too (people search "Starbucks 2nd
-- floor" style phrases that live in the description, not just name/venue).
-- ============================================================================
create index if not exists bathrooms_description_trgm_idx on bathrooms using gin (description gin_trgm_ops);

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
      or b.description ilike '%' || search_query || '%'
      or b.address ilike '%' || search_query || '%'
      or b.city ilike '%' || search_query || '%'
      or b.region ilike '%' || search_query || '%'
      or b.country ilike '%' || search_query || '%'
      or exists (select 1 from unnest(b.tags) tag where tag ilike '%' || search_query || '%')
    )
  order by
    case
      when b.name ilike search_query || '%' then 0
      when b.name ilike '%' || search_query || '%' then 1
      when b.venue_name ilike '%' || search_query || '%' then 2
      when b.description ilike '%' || search_query || '%' then 3
      else 4
    end,
    greatest(
      similarity(lower(b.name), lower(search_query)),
      similarity(lower(coalesce(b.venue_name, '')), lower(search_query))
    ) desc,
    b.overall_score desc nulls last,
    b.review_count desc
  limit 100;
$$;

comment on function search_verified_bathrooms is 'Public-safe text search over verified bathrooms (name/venue/description/address/tags), trigram-indexed and ranked by match quality before rating. Never returns private_access_code.';

revoke all on function search_verified_bathrooms(text) from public;
grant execute on function search_verified_bathrooms(text) to authenticated;
