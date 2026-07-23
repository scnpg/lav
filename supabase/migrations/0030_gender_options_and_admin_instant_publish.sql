-- Two independent changes bundled together:
--
-- 1. Adds 'male_female' to gender_category - a bathroom with separate men's
--    and women's rooms, distinct from 'all_gender' (one shared unisex room).
--
-- 2. Admins get instant publishing: refactors the pending-submission
--    approval logic (0026/0027) so a single submission can be processed on
--    its own (process_bathroom_submission), not just "all pending at once".
--    approve_pending_bathroom_submissions now loops by calling that per-row.
--    A new AFTER INSERT trigger on bathroom_submissions calls it immediately
--    for the row just inserted, but ONLY when the submitter is an admin -
--    critical to scope this to new.id specifically, not "approve everything
--    pending", so an admin's own submission doesn't accidentally also
--    fast-track some unrelated regular user's pending submission that
--    happened to already be sitting in the queue.

alter table bathrooms drop constraint bathrooms_gender_category_check;
alter table bathrooms add constraint bathrooms_gender_category_check
  check (gender_category in ('male', 'female', 'male_female', 'all_gender', 'family', 'accessible', 'unknown'));

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

  submission_id := sub.id;
  bathroom_id := target_bathroom_id;
  action := case when sub.bathroom_id is null then 'created' else 'updated' end;
  return next;
end;
$$;

create or replace function public.approve_pending_bathroom_submissions(operator_id uuid default null)
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
  pending_id uuid;
begin
  for pending_id in
    select id from bathroom_submissions where status = 'pending' order by created_at
  loop
    return query select * from process_bathroom_submission(pending_id, operator_id);
  end loop;
end;
$$;

revoke all on function public.process_bathroom_submission(uuid, uuid) from public, anon, authenticated;

create or replace function public.instant_approve_admin_submission()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if is_admin(new.user_id) then
    perform process_bathroom_submission(new.id, new.user_id);
  end if;
  return new;
end;
$$;

create trigger instant_approve_admin_submission_trigger
  after insert on bathroom_submissions
  for each row execute function instant_approve_admin_submission();
