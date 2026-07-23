-- Switches the displayed bathrooms.overall_score from the mean of
-- bathroom_reviews.overall_rating to the statistical mode - the most
-- commonly given rating wins, rather than an average that a single extreme
-- outlier can drag around. Same mode() within group (order by ...) ordered-
-- set aggregate already used for bathroom_suggestions consensus
-- (0021_consensus_suggestions.sql), just applied to a numeric column instead
-- of text. Ties resolve to whichever value mode() encounters first for that
-- group - acceptable here since the UI rating slider snaps to 0.5
-- increments (see RateBathroomModal.tsx), so real ties are common and
-- meaningful, not a rare edge case to special-case around.
create or replace function public.sync_bathroom_overall_score()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  target_bathroom_id uuid;
begin
  target_bathroom_id := coalesce(new.bathroom_id, old.bathroom_id);

  perform set_config('app.bypass_bathroom_guard', 'true', true);

  update bathrooms
  set overall_score = coalesce(
    (select mode() within group (order by overall_rating) from bathroom_reviews where bathroom_id = target_bathroom_id),
    0
  )
  where id = target_bathroom_id;

  return coalesce(new, old);
end;
$$;

-- One-time backfill: every bathroom with at least one review currently
-- carries an average-based score from before this migration. Without this,
-- it would stay stale (showing the old average) until its next review event
-- happens to re-fire the trigger - a real, user-visible inconsistency
-- between bathrooms that happen to get rated again soon and ones that don't.
-- No app.bypass_bathroom_guard flag needed here - migrations run with
-- auth.uid() null (no JWT/session), which guard_bathroom_update() already
-- treats as a bypass condition on its own.
update bathrooms b
set overall_score = coalesce(
  (select mode() within group (order by overall_rating) from bathroom_reviews where bathroom_id = b.id),
  0
)
where exists (select 1 from bathroom_reviews where bathroom_id = b.id);
