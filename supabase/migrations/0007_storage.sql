-- Lav: Storage buckets + policies
--
-- Upload flow (see README "Photo moderation"):
--   1. User uploads to bathroom-photo-quarantine/{user_id}/{uuid}.jpg (private).
--   2. moderate-photo Edge Function (service role) scans it and writes
--      moderation_status / moderation_result onto bathroom_photos.
--   3. Admin reviews in /admin. On approve, the admin client downloads the
--      quarantine object and re-uploads it to bathroom-photo-public, then
--      updates bathroom_photos.public_url + status='approved'. This is a
--      plain authenticated-admin storage call (RLS-checked), not a second
--      Edge Function - see src/features/admin in the mobile app.
--   4. On reject, the file is left in quarantine (never copied) and
--      bathroom_photos.status='rejected' / is_public=false.

insert into storage.buckets (id, name, public)
values ('bathroom-photo-quarantine', 'bathroom-photo-quarantine', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('bathroom-photo-public', 'bathroom-photo-public', true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- bathroom-photo-quarantine: private. Upload path convention is
-- {user_id}/{filename}, so storage.foldername(name)[1] is the owner's uid.
-- ---------------------------------------------------------------------------
create policy "quarantine_insert_own_folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'bathroom-photo-quarantine'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "quarantine_select_own_or_admin"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'bathroom-photo-quarantine'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

-- ---------------------------------------------------------------------------
-- bathroom-photo-public: readable by anyone signed in; only admins publish
-- to it (after moderation approval).
-- ---------------------------------------------------------------------------
create policy "public_photos_select_all"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'bathroom-photo-public');

create policy "public_photos_insert_admin_only"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'bathroom-photo-public' and public.is_admin());

create policy "public_photos_update_admin_only"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'bathroom-photo-public' and public.is_admin())
  with check (bucket_id = 'bathroom-photo-public' and public.is_admin());

create policy "public_photos_delete_admin_only"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'bathroom-photo-public' and public.is_admin());
