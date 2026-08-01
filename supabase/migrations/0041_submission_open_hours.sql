-- Lets users propose hours through the same three paths as every other
-- bathroom fact (Edit Info, Rate & Log's "help us fill in details" section,
-- and the Submit/Suggest-an-edit wizard) - open_hours existed on `bathrooms`
-- already but was never exposed in any of those forms. The direct-write paths
-- (updateBathroomDetails) needed no schema change since bathrooms.open_hours
-- already exists and isn't guarded by guard_bathroom_update (0022). The
-- submit.tsx wizard writes to bathroom_submissions' free-form `details` jsonb
-- instead (0023), so this extends admin_approve_all_pending_submissions
-- (0026, last touched by 0035 for description/access_notes) to also copy
-- open_hours onto the bathroom on approval.
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
        access_type, amenities, description, access_notes, open_hours,
        submitted_by, verified_by, verified_at, last_verified_at
      )
      values (
        sub.name, sub.latitude, sub.longitude, 'verified',
        sub.details ->> 'access_type',
        coalesce(sub.details -> 'amenities', '{}'::jsonb),
        sub.details ->> 'description',
        sub.details ->> 'access_notes',
        coalesce(sub.details -> 'open_hours', '{}'::jsonb),
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
        open_hours = coalesce(sub.details -> 'open_hours', b.open_hours),
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
