-- get_bathroom_review_stats' avg_overall becomes overall_mode, computed
-- with mode() instead of avg() - keeps this RPC (used for the detail
-- screen's prominent "Global" figure) consistent with bathrooms.overall_score
-- (0028_mode_based_overall_score.sql), which switched to mode() already.
-- Without this, the map/list pins and the detail screen's headline number
-- would show two different "official" scores for the same bathroom. The
-- per-facet sub-scores (cleanliness/smell/ambience/privacy) stay averages -
-- only the headline 0-10 rating changes semantics, not the 1-5 breakdown.
-- Column names are part of a RETURNS TABLE signature, so CREATE OR REPLACE
-- can't just rename one in place - drop and recreate.
drop function if exists get_bathroom_review_stats(uuid);

create function get_bathroom_review_stats(target_bathroom_id uuid)
returns table (
  review_count integer,
  overall_mode numeric,
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
    (mode() within group (order by overall_rating))::numeric(3,1) as overall_mode,
    avg(cleanliness_score)::numeric(3,1) as avg_cleanliness,
    avg(smell_score)::numeric(3,1) as avg_smell,
    avg(ambience_score)::numeric(3,1) as avg_ambience,
    avg(privacy_score)::numeric(3,1) as avg_privacy
  from bathroom_reviews
  where bathroom_id = target_bathroom_id;
$$;
