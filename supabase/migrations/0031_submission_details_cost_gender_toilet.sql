-- The map-pin submission wizard (app/bathrooms/submit.tsx) now collects
-- cost_type/gender_category/toilet_type alongside the access_type it already
-- sent, but process_bathroom_submission() (0030) never read those keys back
-- out of `details` - an admin approving (or an admin's own instant-publish
-- trigger firing on) a submission would silently drop them. Re-create the
-- function with the same insert/update shape as 0030, just extended to also
-- extract these three fields the same way access_type already is: direct on
-- insert (nothing to preserve yet), coalesced against the existing row on
-- update (an amendment that doesn't touch a field shouldn't blank it out).
create or replace function public.process_bathroom_submission(sub_id uuid, operator_id uuid)
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
  select * into sub from bathroom_submissions where id = sub_id and status = 'pending';
  if not found then
    return;
  end if;

  if sub.bathroom_id is null then
    insert into bathrooms (
      name, latitude, longitude, status,
      access_type, cost_type, gender_category, toilet_type, amenities,
      submitted_by, verified_by, verified_at, last_verified_at
    )
    values (
      sub.name, sub.latitude, sub.longitude, 'verified',
      sub.details ->> 'access_type',
      sub.details ->> 'cost_type',
      sub.details ->> 'gender_category',
      sub.details ->> 'toilet_type',
      coalesce(sub.details -> 'amenities', '{}'::jsonb),
      sub.user_id, operator_id, now(), now()
    )
    returning id into target_bathroom_id;
  else
    update bathrooms b set
      name = coalesce(sub.name, b.name),
      access_type = coalesce(sub.details ->> 'access_type', b.access_type),
      cost_type = coalesce(sub.details ->> 'cost_type', b.cost_type),
      gender_category = coalesce(sub.details ->> 'gender_category', b.gender_category),
      toilet_type = coalesce(sub.details ->> 'toilet_type', b.toilet_type),
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
  set status = 'approved', reviewed_by = operator_id, reviewed_at = now()
  where id = sub.id;

  submission_id := sub.id;
  bathroom_id := target_bathroom_id;
  action := case when sub.bathroom_id is null then 'created' else 'updated' end;
  return next;
end;
$$;

revoke all on function public.process_bathroom_submission(uuid, uuid) from public, anon, authenticated;
