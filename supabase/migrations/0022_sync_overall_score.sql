-- bathrooms.overall_score is the one field every screen built before the new
-- 0.0-10.0 rating engine already reads for a bathroom's headline score - map
-- pins/clusters, BathroomBottomCard, the Lists tab, collection detail
-- screens. None of them were ever wired to bathroom_reviews directly, so a
-- submitted rating only ever showed up in the screens built specifically for
-- the new engine (the detail screen, Feed, Profile) and reverted back to 0
-- the moment anything else re-fetched bathrooms from the database - a
-- reload, a map pan/zoom, or just revisiting the Map tab. This keeps
-- overall_score itself in sync with the live average, so every one of those
-- older screens is correct without having to touch each of them individually.
create or replace function sync_bathroom_overall_score()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_bathroom_id uuid;
begin
  target_bathroom_id := coalesce(new.bathroom_id, old.bathroom_id);

  -- guard_bathroom_update() (0012/0013) otherwise reverts this exact write
  -- right back to OLD - it can't tell "a trusted aggregate recompute
  -- triggered by the reviewer's own insert" apart from "that same reviewer
  -- directly editing bathrooms.overall_score themselves"; both see the same
  -- non-null, non-admin auth.uid(). This flag is the difference, and it's
  -- transaction-scoped (is_local = true) so it can never leak past the
  -- request that set it - nothing else ever sets this key.
  perform set_config('app.bypass_bathroom_guard', 'true', true);

  update bathrooms
  set overall_score = coalesce(
    (select round(avg(overall_rating), 2) from bathroom_reviews where bathroom_id = target_bathroom_id),
    0
  )
  where id = target_bathroom_id;

  return coalesce(new, old);
end;
$$;

create trigger sync_bathroom_overall_score_trigger
  after insert or update or delete on bathroom_reviews
  for each row execute function sync_bathroom_overall_score();

-- Teach the existing guard about the trusted bypass flag above - everything
-- else about guard_bathroom_update() (0012_community_bathroom_edits.sql,
-- 0013_fix_guard_trigger_system_updates.sql) is unchanged.
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

  return new;
end;
$$;

-- One-time backfill for every bathroom that already has reviews (e.g. Ian's
-- earlier McDonald's rating and the throwaway test ratings from this
-- session) - the trigger only fires for new activity going forward.
update bathrooms b
set overall_score = coalesce(
  (select round(avg(overall_rating), 2) from bathroom_reviews r where r.bathroom_id = b.id),
  0
)
where exists (select 1 from bathroom_reviews r where r.bathroom_id = b.id);
