-- Lav: onboarding + avatars
--
-- Two additions to support a real post-signup setup step (choose a
-- username, optionally set a profile photo) instead of leaving users stuck
-- with handle_new_user()'s auto-generated username/display_name forever:
--
-- 1. profiles.onboarding_completed: flips true once the user finishes (or
--    explicitly skips the photo step of) app/auth/onboarding.tsx. The root
--    layout (app/_layout.tsx) routes signed-in users with this still false
--    to that screen instead of the tabs.
-- 2. avatars storage bucket: public read (profile photos aren't sensitive,
--    same reasoning as bathroom-photo-public), owner-only write. Path
--    convention is {user_id}/avatar.jpg, same {user_id}/... folder-ownership
--    pattern as bathroom-photo-quarantine in 0007_storage.sql.
alter table profiles add column if not exists onboarding_completed boolean not null default false;

comment on column profiles.onboarding_completed is 'True once the user has been through (or skipped) app/auth/onboarding.tsx. Existing rows default false so already-seeded/imported profiles would see onboarding once signed in - fine for this app, there are none left after the account wipe.';

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatars_select_all"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'avatars');

create policy "avatars_insert_own_folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_update_own_folder"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_delete_own_folder"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
