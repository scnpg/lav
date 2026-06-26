-- Lav: Row Level Security
--
-- Everything in this app requires sign-in (no anon policies) - this is a
-- small private tool for a 2-person team for now, so "authenticated" is the
-- only role we grant to. Re-introduce anon policies deliberately if/when
-- Lav needs logged-out browsing.
--
-- "friends" visibility note: there is no friend graph yet (see TODO in
-- profiles / feed). Until then, anything marked visibility='friends' is
-- treated as visible only to its author + admins - the conservative choice,
-- since showing it to "everyone" would defeat the point of a privacy
-- control. Replace the `is_admin() or user_id = auth.uid()` half of these
-- checks with a real "is_friend()" check once the friend graph exists.

-- ---------------------------------------------------------------------------
-- Column-level lockdown for the genuinely private bathroom fields. This is
-- enforced independently of every RLS policy below: even an admin's plain
-- `select *` will fail on these columns (admins read them through
-- admin_get_bathroom_private_fields() instead - see 0005_rpc_functions.sql).
-- ---------------------------------------------------------------------------
revoke select (private_access_code, submission_latitude, submission_longitude)
  on bathrooms from authenticated, anon;

-- Prevent privilege escalation: a user editing their own profile can never
-- grant themselves admin or alter their own trust score.
revoke update (role, trust_score) on profiles from authenticated;

alter table profiles enable row level security;
alter table bathrooms enable row level security;
alter table bathroom_photos enable row level security;
alter table reviews enable row level security;
alter table checkins enable row level security;
alter table saved_bathrooms enable row level security;
alter table bathroom_lists enable row level security;
alter table bathroom_list_items enable row level security;
alter table bathroom_list_likes enable row level security;
alter table saved_bathroom_lists enable row level security;
alter table reports enable row level security;
alter table moderation_events enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy "profiles_select_all_authenticated"
  on profiles for select
  to authenticated
  using (true);

create policy "profiles_update_own"
  on profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- No insert policy: rows are created exclusively by the handle_new_user()
-- trigger (SECURITY DEFINER, runs on auth.users insert).

-- ---------------------------------------------------------------------------
-- bathrooms
-- ---------------------------------------------------------------------------
create policy "bathrooms_select_verified_or_own_or_admin"
  on bathrooms for select
  to authenticated
  using (
    status = 'verified'
    or submitted_by = auth.uid()
    or is_admin()
  );

create policy "bathrooms_insert_own_pending"
  on bathrooms for insert
  to authenticated
  with check (
    submitted_by = auth.uid()
    and status = 'pending'
    and verified_by is null
    and verified_at is null
  );

create policy "bathrooms_update_admin_only"
  on bathrooms for update
  to authenticated
  using (is_admin())
  with check (is_admin());

-- No delete policy: admins soft-hide bathrooms via status = 'hidden' instead
-- of deleting rows (preserves reviews/checkins/history).

-- ---------------------------------------------------------------------------
-- bathroom_photos
-- ---------------------------------------------------------------------------
create policy "bathroom_photos_select_public_or_own_or_admin"
  on bathroom_photos for select
  to authenticated
  using (
    is_public = true
    or user_id = auth.uid()
    or is_admin()
  );

create policy "bathroom_photos_insert_own"
  on bathroom_photos for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and status = 'pending'
    and is_public = false
  );

create policy "bathroom_photos_update_admin_only"
  on bathroom_photos for update
  to authenticated
  using (is_admin())
  with check (is_admin());

-- No delete policy: rejected photos are retained (status = 'rejected',
-- is_public = false) rather than hard-deleted, for moderation history.
-- The automated scan step (moderation_status / moderation_result /
-- moderation_provider) is written by the moderate-photo Edge Function using
-- the service role key, which bypasses RLS entirely - see
-- supabase/functions/moderate-photo.

-- ---------------------------------------------------------------------------
-- reviews
-- ---------------------------------------------------------------------------
create policy "reviews_select_visible"
  on reviews for select
  to authenticated
  using (
    visibility = 'public'
    or user_id = auth.uid()
    or is_admin()
  );

create policy "reviews_insert_own_for_verified_bathroom"
  on reviews for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from bathrooms b where b.id = bathroom_id and b.status = 'verified')
  );

create policy "reviews_update_own"
  on reviews for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "reviews_delete_own_or_admin"
  on reviews for delete
  to authenticated
  using (user_id = auth.uid() or is_admin());

-- ---------------------------------------------------------------------------
-- checkins (never automatic - always an explicit user-initiated insert)
-- ---------------------------------------------------------------------------
create policy "checkins_select_visible"
  on checkins for select
  to authenticated
  using (
    visibility = 'public'
    or user_id = auth.uid()
    or is_admin()
  );

create policy "checkins_insert_own_for_verified_bathroom"
  on checkins for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from bathrooms b where b.id = bathroom_id and b.status = 'verified')
  );

create policy "checkins_update_own"
  on checkins for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "checkins_delete_own_or_admin"
  on checkins for delete
  to authenticated
  using (user_id = auth.uid() or is_admin());

-- ---------------------------------------------------------------------------
-- saved_bathrooms (private to the saver)
-- ---------------------------------------------------------------------------
create policy "saved_bathrooms_select_own"
  on saved_bathrooms for select
  to authenticated
  using (user_id = auth.uid());

create policy "saved_bathrooms_insert_own"
  on saved_bathrooms for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "saved_bathrooms_delete_own"
  on saved_bathrooms for delete
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- bathroom_lists
-- ---------------------------------------------------------------------------
create policy "bathroom_lists_select_visible"
  on bathroom_lists for select
  to authenticated
  using (
    visibility = 'public'
    or creator_id = auth.uid()
    or is_admin()
  );

create policy "bathroom_lists_insert_own"
  on bathroom_lists for insert
  to authenticated
  with check (creator_id = auth.uid());

create policy "bathroom_lists_update_own_or_admin"
  on bathroom_lists for update
  to authenticated
  using (creator_id = auth.uid() or is_admin())
  with check (creator_id = auth.uid() or is_admin());

create policy "bathroom_lists_delete_own_or_admin"
  on bathroom_lists for delete
  to authenticated
  using (creator_id = auth.uid() or is_admin());

-- ---------------------------------------------------------------------------
-- bathroom_list_items (visibility follows the parent list)
-- ---------------------------------------------------------------------------
create policy "bathroom_list_items_select_via_list"
  on bathroom_list_items for select
  to authenticated
  using (
    exists (
      select 1 from bathroom_lists l
      where l.id = list_id
        and (l.visibility = 'public' or l.creator_id = auth.uid() or is_admin())
    )
  );

create policy "bathroom_list_items_insert_via_own_list"
  on bathroom_list_items for insert
  to authenticated
  with check (
    exists (select 1 from bathroom_lists l where l.id = list_id and l.creator_id = auth.uid())
  );

create policy "bathroom_list_items_update_via_own_list"
  on bathroom_list_items for update
  to authenticated
  using (
    exists (select 1 from bathroom_lists l where l.id = list_id and l.creator_id = auth.uid())
  )
  with check (
    exists (select 1 from bathroom_lists l where l.id = list_id and l.creator_id = auth.uid())
  );

create policy "bathroom_list_items_delete_via_own_list"
  on bathroom_list_items for delete
  to authenticated
  using (
    exists (select 1 from bathroom_lists l where l.id = list_id and l.creator_id = auth.uid())
    or is_admin()
  );

-- ---------------------------------------------------------------------------
-- bathroom_list_likes
-- ---------------------------------------------------------------------------
create policy "bathroom_list_likes_select_own"
  on bathroom_list_likes for select
  to authenticated
  using (user_id = auth.uid());

create policy "bathroom_list_likes_insert_own_visible_list"
  on bathroom_list_likes for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from bathroom_lists l
      where l.id = list_id and (l.visibility = 'public' or l.creator_id = auth.uid())
    )
  );

create policy "bathroom_list_likes_delete_own"
  on bathroom_list_likes for delete
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- saved_bathroom_lists ("users can save public lists")
-- ---------------------------------------------------------------------------
create policy "saved_bathroom_lists_select_own"
  on saved_bathroom_lists for select
  to authenticated
  using (user_id = auth.uid());

create policy "saved_bathroom_lists_insert_own_public_list"
  on saved_bathroom_lists for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from bathroom_lists l
      where l.id = list_id and (l.visibility = 'public' or l.creator_id = auth.uid())
    )
  );

create policy "saved_bathroom_lists_delete_own"
  on saved_bathroom_lists for delete
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- reports
-- ---------------------------------------------------------------------------
create policy "reports_select_own_or_admin"
  on reports for select
  to authenticated
  using (user_id = auth.uid() or is_admin());

create policy "reports_insert_own"
  on reports for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "reports_update_admin_only"
  on reports for update
  to authenticated
  using (is_admin())
  with check (is_admin());

-- ---------------------------------------------------------------------------
-- moderation_events (admin audit log)
-- ---------------------------------------------------------------------------
create policy "moderation_events_select_admin_only"
  on moderation_events for select
  to authenticated
  using (is_admin());

create policy "moderation_events_insert_admin_only"
  on moderation_events for insert
  to authenticated
  with check (is_admin() and admin_id = auth.uid());
