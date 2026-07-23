-- Admin bulk-approval for the bathroom_submissions moderation queue
-- (0023_social_and_submissions.sql). Promotes every 'pending' row straight
-- to a live, verified bathroom in one call - no per-row review. Two shapes,
-- same as the wizard that creates them (app/bathrooms/submit.tsx):
--   - bathroom_id is null  -> a brand new bathroom, created status='verified'.
--   - bathroom_id is set   -> an amendment, patched onto the existing row
--                             (only fields the submission actually carried;
--                             everything else on the bathroom is untouched).
-- Any photo_urls ride along into bathroom_images so they show up on the
-- bathroom's detail-screen carousel once live, same as any other photo.
--
-- SECURITY DEFINER + admin-only check mirrors admin_get_bathroom_private_fields
-- (0002_tables.sql) - the function owner (postgres locally) bypasses RLS, so
-- the internal is_admin(auth.uid()) check is what actually gates this, not
-- table policies. Admins are also exempt from guard_bathroom_update
-- (0004_triggers.sql) already, so no app.bypass_bathroom_guard flag is
-- needed here the way sync_bathroom_overall_score (0022) needed one for
-- non-admin-triggered writes.
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
        access_type, amenities,
        submitted_by, verified_by, verified_at, last_verified_at
      )
      values (
        sub.name, sub.latitude, sub.longitude, 'verified',
        sub.details ->> 'access_type',
        coalesce(sub.details -> 'amenities', '{}'::jsonb),
        sub.user_id, auth.uid(), now(), now()
      )
      returning id into target_bathroom_id;
    else
      update bathrooms b set
        name = coalesce(sub.name, b.name),
        access_type = coalesce(sub.details ->> 'access_type', b.access_type),
        amenities = b.amenities || coalesce(sub.details -> 'amenities', '{}'::jsonb),
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
