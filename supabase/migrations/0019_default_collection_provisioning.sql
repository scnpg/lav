-- "Custom collections" reuses the existing bathroom_lists / bathroom_list_items
-- schema (see \d bathroom_lists) instead of a new parallel table - that
-- schema already has an owner, title, description, visibility (public/
-- friends/private), RLS scoping writes to the owner, and a public-select
-- policy, i.e. everything a "collections" feature needs, and it shipped with
-- zero rows and no frontend ever built against it. Every new user gets one
-- default list named 'My Bathrooms' the moment their profile is created.
create or replace function provision_default_collection()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into bathroom_lists (creator_id, title, description, visibility, is_ranked)
  values (new.id, 'My Bathrooms', 'Your personal collection of bathrooms.', 'public', false);
  return new;
end;
$$;

create trigger provision_default_collection_trigger
  after insert on profiles
  for each row execute function provision_default_collection();

-- Backfill for any profile that predates this trigger (e.g. Ian's existing
-- account) - skips anyone who (somehow) already has a list with this exact
-- title so this migration stays safe to reason about if it's ever re-run.
insert into bathroom_lists (creator_id, title, description, visibility, is_ranked)
select p.id, 'My Bathrooms', 'Your personal collection of bathrooms.', 'public', false
from profiles p
where not exists (
  select 1 from bathroom_lists l where l.creator_id = p.id and l.title = 'My Bathrooms'
);
