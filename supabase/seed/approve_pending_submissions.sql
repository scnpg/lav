-- Paste into the Supabase Studio SQL editor and run.
-- Promotes every 'pending' row in bathroom_submissions to a live, verified
-- bathroom: creates a new one if bathroom_id is null, patches the existing
-- one otherwise, attaches any photo_urls to bathroom_images, and marks the
-- submission 'approved'. Not a saved function - a one-off admin action.

do $$
declare
  sub record;
  target_bathroom_id uuid;
  photo_url text;
  storage_prefix constant text := '/storage/v1/object/public/bathroom_photos/';
  operator_id constant uuid := 'cd524828-f31a-40e8-b691-3eff15c9630b'; -- Ian's profile id
begin
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
        sub.user_id, operator_id, now(), now()
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
    set status = 'approved', reviewed_by = operator_id, reviewed_at = now()
    where id = sub.id;

    raise notice 'Submission % -> bathroom % (%)', sub.id, target_bathroom_id,
      case when sub.bathroom_id is null then 'created' else 'updated' end;
  end loop;
end $$;

-- Review what happened:
select id, name, status, latitude, longitude, access_type, amenities, verified_at
from bathrooms
where verified_by = 'cd524828-f31a-40e8-b691-3eff15c9630b'
order by verified_at desc;
