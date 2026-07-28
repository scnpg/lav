-- Likes and replies on bathroom_reviews ("posts" in the Feed), plus a
-- notifications table backing the Profile screen's new Requests/Inbox
-- screens. None of this goes through any review/approval queue - deliberate:
-- the only two things in this app that stay admin-gated are new bathroom
-- submissions/amendments (bathroom_submissions, 0023) and name changes
-- (name_verification, 0034). Reviews were already instant (0016/0022);
-- likes, replies, and friend requests are built the same way - a direct
-- insert, restricted only by RLS ownership checks, never by is_admin().

-- ============================================================================
-- REVIEW LIKES
-- ============================================================================
create table if not exists review_likes (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references bathroom_reviews(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (review_id, user_id)
);

create index review_likes_review_id_idx on review_likes (review_id);
create index review_likes_user_id_idx on review_likes (user_id);

alter table review_likes enable row level security;

create policy review_likes_select_all on review_likes
  for select to authenticated
  using (true);

create policy review_likes_insert_own on review_likes
  for insert to authenticated
  with check (user_id = auth.uid());

-- Unlike - the only way a like ever goes away.
create policy review_likes_delete_own on review_likes
  for delete to authenticated
  using (user_id = auth.uid());

-- ============================================================================
-- REVIEW REPLIES
-- ============================================================================
create table if not exists review_replies (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references bathroom_reviews(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) > 0 and char_length(body) <= 500),
  created_at timestamptz not null default now()
);

create index review_replies_review_id_idx on review_replies (review_id);
create index review_replies_user_id_idx on review_replies (user_id);

alter table review_replies enable row level security;

create policy review_replies_select_all on review_replies
  for select to authenticated
  using (true);

create policy review_replies_insert_own on review_replies
  for insert to authenticated
  with check (user_id = auth.uid());

create policy review_replies_delete_own on review_replies
  for delete to authenticated
  using (user_id = auth.uid());

-- Same profanity firewall already applied to bathrooms/bathroom_reviews/
-- bathroom_submissions (0023) - free-text user content, not an admin-review
-- gate. A rejected reply just fails the insert with an error; it never sits
-- in a queue.
create or replace function firewall_review_replies()
returns trigger
language plpgsql
as $$
begin
  if contains_blocked_term(new.body) then
    raise exception 'Submission rejected due to policy violations';
  end if;
  return new;
end;
$$;

create trigger firewall_review_replies_trigger
  before insert or update on review_replies
  for each row execute function firewall_review_replies();

-- ============================================================================
-- NOTIFICATIONS (backs the Profile screen's Inbox)
-- ============================================================================
-- System-populated only - there is deliberately no insert policy for
-- `authenticated`, so a client can never write a notification directly (e.g.
-- fake a "so-and-so liked your review"). Every row here comes from a
-- SECURITY DEFINER trigger below, which bypasses RLS on insert the same way
-- sync_bathroom_overall_score() does for `bathrooms`.
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references profiles(id) on delete cascade,
  actor_id uuid references profiles(id) on delete set null,
  type text not null check (type in ('friend_request', 'friend_accept', 'review_like', 'review_reply')),
  review_id uuid references bathroom_reviews(id) on delete cascade,
  friendship_id uuid references friendships(id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_recipient_id_idx on notifications (recipient_id, created_at desc);

alter table notifications enable row level security;

create policy notifications_select_own on notifications
  for select to authenticated
  using (recipient_id = auth.uid());

-- Marking as read is the only client-side write this table ever gets.
create policy notifications_update_own on notifications
  for update to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

create policy notifications_delete_own on notifications
  for delete to authenticated
  using (recipient_id = auth.uid());

create or replace function notify_on_friend_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'requested' then
    insert into notifications (recipient_id, actor_id, type, friendship_id)
    values (new.friend_id, new.user_id, 'friend_request', new.id);
  end if;
  return new;
end;
$$;

create trigger notify_on_friend_request_trigger
  after insert on friendships
  for each row execute function notify_on_friend_request();

create or replace function notify_on_friend_accept()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    insert into notifications (recipient_id, actor_id, type, friendship_id)
    values (new.user_id, new.friend_id, 'friend_accept', new.id);
  end if;
  return new;
end;
$$;

create trigger notify_on_friend_accept_trigger
  after update on friendships
  for each row execute function notify_on_friend_accept();

-- Liking/replying to your own review is a real, common case (rating your
-- own log, replying to a comment on it) - it just never generates a
-- notification to yourself.
create or replace function notify_on_review_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  author_id uuid;
begin
  select user_id into author_id from bathroom_reviews where id = new.review_id;
  if author_id is not null and author_id <> new.user_id then
    insert into notifications (recipient_id, actor_id, type, review_id)
    values (author_id, new.user_id, 'review_like', new.review_id);
  end if;
  return new;
end;
$$;

create trigger notify_on_review_like_trigger
  after insert on review_likes
  for each row execute function notify_on_review_like();

create or replace function notify_on_review_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  author_id uuid;
begin
  select user_id into author_id from bathroom_reviews where id = new.review_id;
  if author_id is not null and author_id <> new.user_id then
    insert into notifications (recipient_id, actor_id, type, review_id)
    values (author_id, new.user_id, 'review_reply', new.review_id);
  end if;
  return new;
end;
$$;

create trigger notify_on_review_reply_trigger
  after insert on review_replies
  for each row execute function notify_on_review_reply();
