-- Lav: bathroom_reviews - the "Beli for bathrooms" 0.0-10.0 rating engine
--
-- Deliberately a new, parallel table rather than reusing the existing
-- `reviews` table (0002_tables.sql): that one is a 1-5 scale across
-- cleanliness/safety/privacy/smell/prestige with a visibility enum, wired to
-- bathrooms.*_score via update_bathroom_scores(). This is a different rating
-- shape entirely (0.0-10.0 overall, 1-5 sub-scores on a different set of
-- attributes: cleanliness/smell/ambience/privacy, no visibility concept -
-- every rating is visible app-wide, matching a Beli-style public log) driving
-- a completely separate set of screens (rating modal, detail-page header,
-- profile leaderboards, social feed). The old table/RPC are left untouched.
--
-- Two deviations from the literal spec, matching this schema's existing
-- conventions rather than introducing one-off inconsistencies:
--   - user_id references profiles(id), not auth.users(id) directly - every
--     other user-referencing column in this app does the same (profiles.id
--     already IS auth.users.id with on delete cascade, so integrity is
--     identical) so this can join straight to profiles for author info
--     without an extra hop, and Supabase's own guidance is to avoid app
--     tables holding a direct FK into the auth schema when a public mirror
--     exists.
--   - bathroom_id is uuid, matching bathrooms.id's actual type (not bigint).
--
-- unique(user_id, bathroom_id): not in the original ask, but required for
-- "Been There" (app/(tabs)/profile.tsx) to work as a true personal
-- leaderboard - one entry per bathroom, upsertable when you re-rate a place
-- instead of accumulating duplicate rows for the same visit.
create table if not exists bathroom_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  bathroom_id uuid not null references bathrooms(id) on delete cascade,
  overall_rating numeric(3,1) not null check (overall_rating >= 0.0 and overall_rating <= 10.0),
  cleanliness_score int check (cleanliness_score between 1 and 5),
  smell_score int check (smell_score between 1 and 5),
  ambience_score int check (ambience_score between 1 and 5),
  privacy_score int check (privacy_score between 1 and 5),
  review_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, bathroom_id)
);

comment on table bathroom_reviews is 'Beli-style 0.0-10.0 bathroom ratings - one per (user_id, bathroom_id), upserted on re-rate. Separate from the older 1-5 scale `reviews` table.';

drop trigger if exists set_updated_at on bathroom_reviews;
create trigger set_updated_at before update on bathroom_reviews
  for each row execute function set_updated_at();

-- bathroom_id alone (not just as the composite unique index's trailing
-- column, which Postgres can't use efficiently for a bathroom_id-only
-- filter) - this is what get_bathroom_review_stats() and the detail page's
-- "all reviews for this bathroom" queries filter on.
create index if not exists bathroom_reviews_bathroom_id_idx on bathroom_reviews (bathroom_id);
create index if not exists bathroom_reviews_user_id_idx on bathroom_reviews (user_id);
-- Powers the Feed tab's "20 most recent" query.
create index if not exists bathroom_reviews_created_at_idx on bathroom_reviews (created_at desc);

alter table bathroom_reviews enable row level security;

-- Every rating is visible to any signed-in user - no visibility/friends
-- concept here (unlike the older `reviews` table), matching a public
-- Beli-style log.
create policy "bathroom_reviews_select_all_authenticated"
  on bathroom_reviews for select
  to authenticated
  using (true);

create policy "bathroom_reviews_insert_own"
  on bathroom_reviews for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "bathroom_reviews_update_own"
  on bathroom_reviews for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "bathroom_reviews_delete_own"
  on bathroom_reviews for delete
  to authenticated
  using (user_id = auth.uid());

-- Live-computed averages for one bathroom - no denormalized columns needed
-- at this scale (a single indexed bathroom_id lookup is already fast
-- regardless of the 349k-row bathrooms table's size). Plain SQL function,
-- not security definer: bathroom_reviews' own SELECT policy already grants
-- every authenticated caller full read access, so there's nothing to bypass.
create or replace function get_bathroom_review_stats(target_bathroom_id uuid)
returns table (
  review_count int,
  avg_overall numeric,
  avg_cleanliness numeric,
  avg_smell numeric,
  avg_ambience numeric,
  avg_privacy numeric
)
language sql
stable
as $$
  select
    count(*)::int as review_count,
    avg(overall_rating)::numeric(3,1) as avg_overall,
    avg(cleanliness_score)::numeric(3,1) as avg_cleanliness,
    avg(smell_score)::numeric(3,1) as avg_smell,
    avg(ambience_score)::numeric(3,1) as avg_ambience,
    avg(privacy_score)::numeric(3,1) as avg_privacy
  from bathroom_reviews
  where bathroom_id = target_bathroom_id;
$$;

comment on function get_bathroom_review_stats is 'Live aggregate (count + averages) of bathroom_reviews for one bathroom - powers the detail screen''s rating header and sub-score breakdown.';

revoke all on function get_bathroom_review_stats(uuid) from public;
grant execute on function get_bathroom_review_stats(uuid) to authenticated;
