-- Every 24 hours, automatically promote whatever's sitting in
-- bathroom_submissions at status='pending' into the live bathrooms table -
-- the same "create if new pin, patch if amendment, attach photos" logic as
-- admin_approve_all_pending_submissions (0026), just running on a schedule
-- instead of a human pasting a script.
--
-- Split into two functions rather than one:
--   - approve_pending_bathroom_submissions(operator_id) - the actual work,
--     no auth check. NOT reachable via the app's API (see revoke below) -
--     only pg_cron's internal scheduler (running as the postgres superuser)
--     or another SECURITY DEFINER function can call it.
--   - admin_approve_all_pending_submissions() - unchanged public surface,
--     still admin-gated, now just a thin wrapper that passes auth.uid() as
--     the operator so a real admin action still records who approved it.
-- Keeping the admin-only entry point admin-only was the whole point of
-- 0026 - a bare "remove the is_admin check so cron can call it" would have
-- also let any authenticated user approve arbitrary pending submissions via
-- PostgREST.
create extension if not exists pg_cron with schema extensions;

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
  sub record;
  target_bathroom_id uuid;
  photo_url text;
  storage_prefix constant text := '/storage/v1/object/public/bathroom_photos/';
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

    submission_id := sub.id;
    bathroom_id := target_bathroom_id;
    action := case when sub.bathroom_id is null then 'created' else 'updated' end;
    return next;
  end loop;
end;
$$;

revoke all on function public.approve_pending_bathroom_submissions(uuid) from public, anon, authenticated;

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
begin
  if not is_admin(auth.uid()) then
    raise exception 'Only admins can approve bathroom submissions';
  end if;

  return query select * from approve_pending_bathroom_submissions(auth.uid());
end;
$$;

select cron.schedule(
  'approve-pending-bathroom-submissions',
  '0 0 * * *', -- every 24 hours, midnight UTC
  $$select public.approve_pending_bathroom_submissions(null);$$
);
