-- ============================================================================
-- FRIENDSHIPS
-- ============================================================================
-- One row per pair, created by the requester (status='requested'), flipped
-- to 'accepted' by the recipient via UPDATE - not a second mirrored row, to
-- avoid the two rows drifting out of sync with each other. user_id/friend_id
-- reference profiles(id), not auth.users(id) directly, matching every other
-- FK in this schema (profiles.id already 1:1-references auth.users.id).
create table if not exists friendships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  friend_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'requested' check (status in ('requested', 'accepted')),
  created_at timestamptz not null default now(),
  check (user_id <> friend_id),
  unique (user_id, friend_id)
);

-- The unique constraint above already gives a (user_id, friend_id) b-tree for
-- "my outgoing requests/friends" lookups; this second index covers the
-- other direction ("who has requested/friended me") just as cheaply.
create index friendships_friend_id_idx on friendships (friend_id);

alter table friendships enable row level security;

-- Either side of a friendship can see the row - both the requester and the
-- recipient need to render it (pending outgoing / pending incoming / friend).
create policy friendships_select_involved on friendships
  for select to authenticated
  using (user_id = auth.uid() or friend_id = auth.uid());

create policy friendships_insert_own on friendships
  for insert to authenticated
  with check (user_id = auth.uid());

-- Only the recipient can accept - the requester already stated their intent
-- by inserting the row; only the person being asked gets to say yes.
create policy friendships_update_recipient_accepts on friendships
  for update to authenticated
  using (friend_id = auth.uid())
  with check (friend_id = auth.uid() and status = 'accepted');

-- Either side can remove the row - unfriending, or withdrawing/declining a
-- still-pending request.
create policy friendships_delete_involved on friendships
  for delete to authenticated
  using (user_id = auth.uid() or friend_id = auth.uid());

-- ============================================================================
-- CROWDSOURCED SUBMISSIONS MODERATION QUEUE
-- ============================================================================
-- A staging table, separate from the existing direct-write paths
-- (submitBathroom() inserts straight into bathrooms at status='pending';
-- updateBathroomDetails() writes straight to a bathroom's fillable fields,
-- guarded by guard_bathroom_update()). Nothing here changes those - this is
-- an additional, more deliberate "propose and wait for a human" path: either
-- a brand new pin (bathroom_id null, name/lat/lng required) or a proposed
-- amendment to an existing one (bathroom_id set, coordinates irrelevant).
-- bathroom_id is uuid, not bigint - bathrooms.id is uuid in this schema.
create table if not exists bathroom_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  bathroom_id uuid references bathrooms(id) on delete cascade,
  name text,
  latitude numeric,
  longitude numeric,
  details jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (bathroom_id is not null or (name is not null and latitude is not null and longitude is not null))
);

create index bathroom_submissions_user_id_idx on bathroom_submissions (user_id);
create index bathroom_submissions_bathroom_id_idx on bathroom_submissions (bathroom_id);
create index bathroom_submissions_status_idx on bathroom_submissions (status);

alter table bathroom_submissions enable row level security;

create policy bathroom_submissions_insert_own on bathroom_submissions
  for insert to authenticated
  with check (user_id = auth.uid());

create policy bathroom_submissions_select_own_or_admin on bathroom_submissions
  for select to authenticated
  using (user_id = auth.uid() or is_admin());

create policy bathroom_submissions_update_admin_only on bathroom_submissions
  for update to authenticated
  using (is_admin())
  with check (is_admin());

-- +5 for a fresh submission entering the queue, mirroring the "+5 per
-- fillable field" spirit for the direct-edit path (0020_gamification_points.sql)
-- without trying to guess a per-field count against unstructured `details`.
create or replace function award_points_on_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform award_points(new.user_id, 5);
  return new;
end;
$$;

create trigger award_points_on_submission_trigger
  after insert on bathroom_submissions
  for each row execute function award_points_on_submission();

-- ============================================================================
-- PROFANITY / OBSCENITY FIREWALL
-- ============================================================================
-- A small starter blacklist, not an exhaustive filter - meant to be extended
-- (`insert into blocked_terms (term) values (...)`) as real moderation needs
-- surface, not treated as a finished word list. Word-boundary matched
-- case-insensitively so it catches "shit" but not "shitake" or "Shithara".
create table if not exists blocked_terms (
  term text primary key
);

insert into blocked_terms (term) values
  ('fuck'), ('shit'), ('bitch'), ('asshole'), ('cunt'), ('nigger'), ('nigga'),
  ('faggot'), ('retard'), ('whore'), ('slut'), ('rape'), ('dick'), ('pussy'),
  ('bastard'), ('cock')
on conflict (term) do nothing;

create or replace function contains_blocked_term(input_text text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from blocked_terms bt
    where lower(coalesce(input_text, '')) ~* ('(^|[^a-zA-Z])' || bt.term || '($|[^a-zA-Z])')
  );
$$;

-- Only re-checks a column when it's actually part of this write (always on
-- INSERT; only if changed on UPDATE) - keeps this from re-scanning an
-- unrelated field on every unrelated write to the same row, e.g.
-- sync_bathroom_overall_score()'s (0022) updates to bathrooms.overall_score
-- never touch name/description, so they never re-trigger this check.
create or replace function firewall_bathrooms()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'INSERT' or new.name is distinct from old.name) and contains_blocked_term(new.name) then
    raise exception 'Submission rejected due to policy violations';
  end if;
  if (tg_op = 'INSERT' or new.description is distinct from old.description) and contains_blocked_term(new.description) then
    raise exception 'Submission rejected due to policy violations';
  end if;
  return new;
end;
$$;

create trigger firewall_bathrooms_trigger
  before insert or update on bathrooms
  for each row execute function firewall_bathrooms();

create or replace function firewall_bathroom_reviews()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'INSERT' or new.review_text is distinct from old.review_text) and contains_blocked_term(new.review_text) then
    raise exception 'Submission rejected due to policy violations';
  end if;
  return new;
end;
$$;

create trigger firewall_bathroom_reviews_trigger
  before insert or update on bathroom_reviews
  for each row execute function firewall_bathroom_reviews();

create or replace function firewall_bathroom_submissions()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'INSERT' or new.name is distinct from old.name) and contains_blocked_term(new.name) then
    raise exception 'Submission rejected due to policy violations';
  end if;
  return new;
end;
$$;

create trigger firewall_bathroom_submissions_trigger
  before insert or update on bathroom_submissions
  for each row execute function firewall_bathroom_submissions();
