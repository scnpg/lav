-- Lav: fix guard_bathroom_update() breaking system-level updates
--
-- Bug found while deleting all auth.users for a clean-slate test: deleting a
-- profile that bathrooms.verified_by pointed at should trigger Postgres's
-- own "on delete set null" referential action on bathrooms. Instead,
-- guard_bathroom_update() (0012_community_bathroom_edits.sql) fired on that
-- internal SET NULL update too - since it's a plain BEFORE UPDATE trigger,
-- not aware of *why* the update is happening - and its is_admin() check
-- evaluates false with no JWT in play (raw SQL, service_role, or a
-- system-driven referential action all have auth.uid() = null), so it pinned
-- verified_by right back to the about-to-be-orphaned id. Result: all 349k
-- bathrooms rows ended up with verified_by pointing at a deleted user.
--
-- Fix: skip the guard entirely whenever there's no authenticated end-user in
-- play (auth.uid() is null). This never weakens the protection the guard
-- exists for - anon has no UPDATE policy on bathrooms at all (blocked by RLS
-- before this trigger ever runs), and every genuine authenticated-role
-- request from the app always carries a JWT with a real auth.uid(). The
-- only callers that can reach this trigger with auth.uid() = null are
-- already fully trusted: service_role (bypasses RLS anyway), a superuser/
-- psql session, or - as here - Postgres's own referential integrity actions.
create or replace function guard_bathroom_update()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null or is_admin() then
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

-- One-time repair: null out the verified_by/submitted_by values the buggy
-- trigger incorrectly preserved after their owning profiles were deleted.
-- Safe now that the function above no longer interferes with this update.
update bathrooms set verified_by = null
where verified_by is not null and verified_by not in (select id from profiles);

update bathrooms set submitted_by = null
where submitted_by is not null and submitted_by not in (select id from profiles);
