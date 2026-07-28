-- Reverts bathrooms.overall_score (the map pins/cards headline number and
-- the bathroom detail screen's "Global" figure) from the statistical mode
-- (0028_mode_based_overall_score.sql, 0029_rename_overall_stat_to_mode.sql)
-- back to the mean of bathroom_reviews.overall_rating - undoing 0028/0029,
-- not layering a third scheme on top. get_bathroom_review_stats' overall_mode
-- column reverts to its original avg_overall name (matching the sibling
-- avg_cleanliness/avg_smell/avg_ambience/avg_privacy columns, all of which
-- stayed averages the whole time) so the column name still says what it is.

create or replace function public.sync_bathroom_overall_score()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  target_bathroom_id uuid;
begin
  target_bathroom_id := coalesce(new.bathroom_id, old.bathroom_id);

  perform set_config('app.bypass_bathroom_guard', 'true', true);

  update bathrooms
  set overall_score = coalesce(
    (select round(avg(overall_rating), 2) from bathroom_reviews where bathroom_id = target_bathroom_id),
    0
  )
  where id = target_bathroom_id;

  return coalesce(new, old);
end;
$$;

-- One-time backfill, same reasoning as 0022/0028's own backfills: without
-- this, a bathroom stays showing its old mode-based score until the next
-- review event happens to re-fire the trigger.
update bathrooms b
set overall_score = coalesce(
  (select round(avg(overall_rating), 2) from bathroom_reviews where bathroom_id = b.id),
  0
)
where exists (select 1 from bathroom_reviews where bathroom_id = b.id);

drop function if exists get_bathroom_review_stats(uuid);

create function get_bathroom_review_stats(target_bathroom_id uuid)
returns table (
  review_count integer,
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
