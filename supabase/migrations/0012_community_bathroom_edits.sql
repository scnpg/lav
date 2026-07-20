-- Lav: public read + community editing for bathrooms
--
-- Two additions to 0006_rls.sql's "authenticated-only, admin-only-update"
-- model:
--
-- 1. Anonymous read. Table-level SELECT was already granted to anon back in
--    0008_grants.sql, but RLS (enabled on bathrooms) denies by default until
--    a policy names the role - and every existing bathrooms policy is
--    `to authenticated`, so anon has always gotten zero rows in practice.
--    This adds the missing policy. Scoped to verified rows only, same as the
--    authenticated policy's public-facing branch - anon never sees pending/
--    rejected/hidden submissions or who submitted them.
--
-- 2. Community editing ("fill in missing data"). Previously only
--    bathrooms_update_admin_only existed, so a signed-in user could never
--    edit a listing themselves. Postgres has no separate "admin" role to
--    grant against here (see the design note atop 0005_rpc_functions.sql -
--    admin is a profiles.role value, not a role authenticated is distinct
--    from), so column-level REVOKE can't say "admins may change status,
--    other authenticated users may not" the way it could for a genuinely
--    admin-only column. Instead: a new authenticated UPDATE policy opens the
--    row up, and a BEFORE UPDATE trigger pins every moderation/ownership/
--    scoring/location column back to its previous value unless the caller
--    is_admin() - so a crafted request can't use this new policy to
--    self-verify a submission, reassign submitted_by, edit someone else's
--    review-derived scores, or vandalize coordinates. Admin flows
--    (adminUpdateBathroom / adminSetBathroomStatus in api.ts) are unaffected
--    since is_admin() short-circuits the guard entirely for them.

create policy "bathrooms_select_verified_anon"
  on bathrooms for select
  to anon
  using (status = 'verified');

-- ---------------------------------------------------------------------------
-- guard_bathroom_update: see note (2) above. Runs before set_updated_at /
-- sync_bathroom_location (alphabetically first among this table's BEFORE ROW
-- triggers), so sync_bathroom_location recomputes `location` from whichever
-- latitude/longitude survive this guard - a non-admin's attempt to move a
-- pin is reverted before that recompute happens, not after.
-- ---------------------------------------------------------------------------
create or replace function guard_bathroom_update()
returns trigger
language plpgsql
as $$
begin
  if is_admin() then
    return new;
  end if;

  -- Non-admins may only edit descriptive/amenity fields. Everything below
  -- is pinned back to its prior value regardless of what the client sent.
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

comment on function guard_bathroom_update is 'Restricts non-admin UPDATEs on bathrooms to descriptive/amenity fields. Runs before the WITH CHECK of bathrooms_update_authenticated_fill_missing evaluates, so the pinned-back row is what gets checked.';

drop trigger if exists guard_bathroom_update on bathrooms;
create trigger guard_bathroom_update before update on bathrooms
  for each row execute function guard_bathroom_update();

create policy "bathrooms_update_authenticated_fill_missing"
  on bathrooms for update
  to authenticated
  using (status = 'verified' or submitted_by = auth.uid())
  with check (status = 'verified' or submitted_by = auth.uid());
