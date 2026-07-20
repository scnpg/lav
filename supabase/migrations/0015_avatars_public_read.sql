-- Lav: avatars public read
--
-- 0014_onboarding_and_avatars.sql scoped the avatars SELECT policy to
-- `authenticated` only (matching bathroom-photo-public's existing
-- convention). Explicitly extending to anon too: profile photos aren't
-- sensitive, and the bucket is already public=true (so the direct public
-- URL bypasses RLS regardless) - this just makes storage.objects queries
-- (not only direct URL fetches) consistent with that.
create policy "avatars_select_anon"
  on storage.objects for select
  to anon
  using (bucket_id = 'avatars');
