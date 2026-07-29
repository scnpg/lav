-- Lav: quick verification check-ins, crowd/live status, and a personal
-- pairwise-comparison ranking signal.
--
-- Three independent pieces sharing one migration:
--
-- 1. bathroom_status_checks - the "Quick Verification Sheet": a low-friction
--    check-in (open? clean? paper? + line length). Append-only log, never
--    updated/deleted by users - this is a point-in-time report, not a
--    review. get_bathroom_live_status() derives the detail screen's live
--    status badge from the single most recent check within a recency
--    window; get_bathrooms_recently_closed() is the bulk lookup the map
--    screen's "Nearest Open" filter uses to exclude bathrooms reported
--    closed, in one round-trip instead of one call per pin.
--
-- 2. user_bathroom_rankings / bathroom_comparisons - a personal
--    pairwise-comparison rating (Elo-style), entirely private to each user
--    (RLS restricts every SELECT to user_id = auth.uid(), unlike every other
--    table in this app) and never surfaced as a raw number or named as
--    "Elo" anywhere - see submit_bathroom_comparison and
--    get_my_ranked_bathroom_ids. Deliberately backend-only for now: no
--    client UI calls these yet, so this ships as a foundation without
--    exposing anything new to users in this pass.

-- ============================================================================
-- FEATURE 1: quick verification check-ins + live status
-- ============================================================================
create table if not exists bathroom_status_checks (
  id uuid primary key default gen_random_uuid(),
  bathroom_id uuid not null references bathrooms(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  is_open boolean not null,
  is_clean boolean not null,
  has_paper boolean not null,
  -- Only meaningful when is_open = false - lets the live-status badge tell
  -- "out of order" apart from "closed for cleaning" instead of collapsing
  -- both into a single is_open=false signal.
  closure_reason text check (closure_reason in ('out_of_order', 'cleaning', 'other')),
  line_length text not null default 'none' check (line_length in ('none', 'short', 'long')),
  created_at timestamptz not null default now()
);

comment on table bathroom_status_checks is 'Append-only Quick Verification check-ins (open/clean/paper/line length). Powers live status badges - never updated or deleted, only ever inserted.';

create index if not exists bathroom_status_checks_bathroom_id_created_at_idx
  on bathroom_status_checks (bathroom_id, created_at desc);

alter table bathroom_status_checks enable row level security;

create policy "bathroom_status_checks_select_all_authenticated"
  on bathroom_status_checks for select
  to authenticated
  using (true);

create policy "bathroom_status_checks_insert_own"
  on bathroom_status_checks for insert
  to authenticated
  with check (user_id = auth.uid());

create or replace function get_bathroom_live_status(target_bathroom_id uuid, recency_hours integer default 4)
returns table (
  is_open boolean,
  is_clean boolean,
  has_paper boolean,
  closure_reason text,
  line_length text,
  reported_at timestamptz,
  checks_in_window integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with recent as (
    select *
    from bathroom_status_checks
    where bathroom_id = target_bathroom_id
      and created_at >= now() - (recency_hours || ' hours')::interval
  )
  select
    recent.is_open, recent.is_clean, recent.has_paper, recent.closure_reason,
    recent.line_length, recent.created_at as reported_at,
    (select count(*)::integer from recent) as checks_in_window
  from recent
  order by recent.created_at desc
  limit 1;
$$;

comment on function get_bathroom_live_status is 'Most recent Quick Verification check-in within recency_hours - powers the detail screen''s live status badge. No rows if nothing was reported recently.';

revoke all on function get_bathroom_live_status(uuid, integer) from public;
grant execute on function get_bathroom_live_status(uuid, integer) to authenticated;

create or replace function get_bathrooms_recently_closed(bathroom_ids uuid[], recency_hours integer default 4)
returns table (bathroom_id uuid)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select latest.bathroom_id
  from (
    select distinct on (bsc.bathroom_id) bsc.bathroom_id, bsc.is_open
    from bathroom_status_checks bsc
    where bsc.bathroom_id = any(bathroom_ids)
      and bsc.created_at >= now() - (recency_hours || ' hours')::interval
    order by bsc.bathroom_id, bsc.created_at desc
  ) latest
  where latest.is_open = false;
$$;

comment on function get_bathrooms_recently_closed is 'Bulk check: of the given bathroom ids, which have a recent report of is_open=false. Powers the map''s "Nearest Open" filter in one round-trip.';

revoke all on function get_bathrooms_recently_closed(uuid[], integer) from public;
grant execute on function get_bathrooms_recently_closed(uuid[], integer) to authenticated;

-- ============================================================================
-- FEATURE 2: personal pairwise-comparison ranking (backend-only for now -
-- no client UI calls these functions yet; see the file header).
-- ============================================================================
create table if not exists user_bathroom_rankings (
  user_id uuid not null references profiles(id) on delete cascade,
  bathroom_id uuid not null references bathrooms(id) on delete cascade,
  rating numeric(7,2) not null default 1500,
  comparisons_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, bathroom_id)
);

comment on table user_bathroom_rankings is 'Per-user Elo-style rating per bathroom, derived only from bathroom_comparisons. Strictly private - never joined into any public-facing query, never shown as a raw number.';

alter table user_bathroom_rankings enable row level security;

-- Unlike every other table in this app, nobody but the owner can read this -
-- it is an internal ranking signal, not a public rating.
create policy "user_bathroom_rankings_select_own"
  on user_bathroom_rankings for select
  to authenticated
  using (user_id = auth.uid());

-- No insert/update policy for direct client writes - every write happens
-- inside submit_bathroom_comparison() (security definer) below, so the Elo
-- math can never be raced or spoofed by a client-side upsert.

create table if not exists bathroom_comparisons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  bathroom_id_a uuid not null references bathrooms(id) on delete cascade,
  bathroom_id_b uuid not null references bathrooms(id) on delete cascade,
  winner_bathroom_id uuid not null references bathrooms(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (bathroom_id_a <> bathroom_id_b),
  check (winner_bathroom_id in (bathroom_id_a, bathroom_id_b))
);

create index if not exists bathroom_comparisons_user_id_idx on bathroom_comparisons (user_id);

alter table bathroom_comparisons enable row level security;

create policy "bathroom_comparisons_select_own"
  on bathroom_comparisons for select
  to authenticated
  using (user_id = auth.uid());

-- Same reasoning as user_bathroom_rankings - writes only happen inside
-- submit_bathroom_comparison().

create or replace function submit_bathroom_comparison(
  p_bathroom_id_a uuid,
  p_bathroom_id_b uuid,
  p_winner_bathroom_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_rating_a numeric;
  v_rating_b numeric;
  v_expected_a numeric;
  v_expected_b numeric;
  v_score_a numeric;
  v_score_b numeric;
  k constant numeric := 32;
begin
  if v_user_id is null then
    raise exception 'Must be signed in to submit a comparison';
  end if;
  if p_bathroom_id_a = p_bathroom_id_b then
    raise exception 'Cannot compare a bathroom against itself';
  end if;
  if p_winner_bathroom_id not in (p_bathroom_id_a, p_bathroom_id_b) then
    raise exception 'Winner must be one of the two compared bathrooms';
  end if;

  insert into user_bathroom_rankings (user_id, bathroom_id)
    values (v_user_id, p_bathroom_id_a), (v_user_id, p_bathroom_id_b)
    on conflict (user_id, bathroom_id) do nothing;

  select rating into v_rating_a from user_bathroom_rankings where user_id = v_user_id and bathroom_id = p_bathroom_id_a;
  select rating into v_rating_b from user_bathroom_rankings where user_id = v_user_id and bathroom_id = p_bathroom_id_b;

  v_expected_a := 1.0 / (1.0 + power(10.0, (v_rating_b - v_rating_a) / 400.0));
  v_expected_b := 1.0 - v_expected_a;
  v_score_a := case when p_winner_bathroom_id = p_bathroom_id_a then 1.0 else 0.0 end;
  v_score_b := 1.0 - v_score_a;

  update user_bathroom_rankings
    set rating = v_rating_a + k * (v_score_a - v_expected_a),
        comparisons_count = comparisons_count + 1,
        updated_at = now()
    where user_id = v_user_id and bathroom_id = p_bathroom_id_a;

  update user_bathroom_rankings
    set rating = v_rating_b + k * (v_score_b - v_expected_b),
        comparisons_count = comparisons_count + 1,
        updated_at = now()
    where user_id = v_user_id and bathroom_id = p_bathroom_id_b;

  insert into bathroom_comparisons (user_id, bathroom_id_a, bathroom_id_b, winner_bathroom_id)
    values (v_user_id, p_bathroom_id_a, p_bathroom_id_b, p_winner_bathroom_id);
end;
$$;

comment on function submit_bathroom_comparison is 'Records a pairwise "which was better" comparison and updates both bathrooms'' personal rating for the caller server-side (so two rapid comparisons can''t race each other). Never returns the rating - see get_my_ranked_bathroom_ids for the only way this signal is consumed.';

revoke all on function submit_bathroom_comparison(uuid, uuid, uuid) from public;
grant execute on function submit_bathroom_comparison(uuid, uuid, uuid) to authenticated;

create or replace function get_my_ranked_bathroom_ids(p_limit integer default 200)
returns table (bathroom_id uuid, rank integer)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select bathroom_id, row_number() over (order by rating desc, comparisons_count desc)::integer as rank
  from user_bathroom_rankings
  where user_id = auth.uid()
  order by rating desc, comparisons_count desc
  limit p_limit;
$$;

comment on function get_my_ranked_bathroom_ids is 'Ordinal rank only - never the underlying rating - so a future client could render "Your ranked list" without ever exposing the comparison mechanism.';

revoke all on function get_my_ranked_bathroom_ids(integer) from public;
grant execute on function get_my_ranked_bathroom_ids(integer) to authenticated;

create or replace function get_random_comparison_candidate(p_exclude_bathroom_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select bathroom_id
  from bathroom_reviews
  where user_id = auth.uid()
    and bathroom_id <> p_exclude_bathroom_id
  order by random()
  limit 1;
$$;

comment on function get_random_comparison_candidate is 'Picks one of the caller''s other previously-logged bathrooms (bathroom_reviews) at random, to prompt "which was better?" against a freshly rated one. Draws from logged bathrooms, not user_bathroom_rankings, so this works even before the caller has ever compared anything.';

revoke all on function get_random_comparison_candidate(uuid) from public;
grant execute on function get_random_comparison_candidate(uuid) to authenticated;
