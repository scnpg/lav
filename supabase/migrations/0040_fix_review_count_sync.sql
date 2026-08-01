-- bathrooms.review_count was never actually wired to the current 0-10 rating
-- engine (bathroom_reviews). The only thing that ever set it was the legacy
-- MVP update_bathroom_scores() RPC (0005_rpc_functions.sql) against an old
-- `reviews` table the client stopped writing to once bathroom_reviews shipped
-- (0016). sync_bathroom_overall_score() (0022) kept overall_score correct off
-- bathroom_reviews but forgot review_count, so every bathroom with real
-- ratings still reads review_count = 0 - which map pins/pin coloring use as
-- the "has this been rated" signal, so rated bathrooms were silently showing
-- as unrated everywhere. This extends that same trigger to also maintain
-- review_count, and backfills every bathroom that already has reviews.
create or replace function sync_bathroom_overall_score()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_bathroom_id uuid;
begin
  target_bathroom_id := coalesce(new.bathroom_id, old.bathroom_id);

  perform set_config('app.bypass_bathroom_guard', 'true', true);

  update bathrooms
  set
    overall_score = coalesce(
      (select round(avg(overall_rating), 2) from bathroom_reviews where bathroom_id = target_bathroom_id),
      0
    ),
    review_count = (select count(*) from bathroom_reviews where bathroom_id = target_bathroom_id)
  where id = target_bathroom_id;

  return coalesce(new, old);
end;
$$;

-- One-time backfill - the trigger only fires for new activity going forward.
update bathrooms b
set review_count = (select count(*) from bathroom_reviews r where r.bathroom_id = b.id)
where review_count <> (select count(*) from bathroom_reviews r where r.bathroom_id = b.id);
