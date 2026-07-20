-- Points are now server-awarded only. `authenticated` currently still holds
-- a column-level UPDATE grant on profiles.points left over from before -
-- RLS's profiles_update_own policy is row-scoped, not column-scoped, so
-- without this revoke a client could `update profiles set points = 999999
-- where id = auth.uid()` directly. Every award below runs through
-- award_points(), a SECURITY DEFINER function, which still works after this
-- revoke because it executes with its owner's privileges, not the caller's.
revoke update (points) on profiles from authenticated;

create or replace function award_points(target_user_id uuid, amount int)
returns void
language sql
security definer
set search_path = public
as $$
  update profiles set points = points + amount where id = target_user_id;
$$;

-- +10 for logging a rating. Only fires on a true INSERT, so re-rating an
-- already-reviewed bathroom (upsertBathroomReview's update path) doesn't
-- re-award points for the same review.
create or replace function award_points_on_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform award_points(new.user_id, 10);
  return new;
end;
$$;

create trigger award_points_on_review_trigger
  after insert on bathroom_reviews
  for each row execute function award_points_on_review();

-- +20 for submitting a brand new pin. Bulk-imported OSM rows never set
-- submitted_by, so the WHEN clause keeps this trigger a no-op for them.
create or replace function award_points_on_new_bathroom()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform award_points(new.submitted_by, 20);
  return new;
end;
$$;

create trigger award_points_on_new_bathroom_trigger
  after insert on bathrooms
  for each row
  when (new.submitted_by is not null)
  execute function award_points_on_new_bathroom();

-- +5 per fillable field actually changed by a community edit. Deliberately
-- the same field set as BathroomFillMissingPatch (src/features/bathrooms/
-- api.ts) - the only fields a non-admin edit can touch at all, since
-- guard_bathroom_update() (0012/0013) already reverts everything else back
-- to OLD before this AFTER trigger ever sees the row. Credited to auth.uid()
-- (the actual editor), not submitted_by/verified_by. Skips raw-SQL/system
-- contexts (auth.uid() is null) same as guard_bathroom_update does.
create or replace function award_points_on_bathroom_edit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  changed_fields int := 0;
begin
  if auth.uid() is null then
    return new;
  end if;

  if old.name is distinct from new.name then changed_fields := changed_fields + 1; end if;
  if old.venue_name is distinct from new.venue_name then changed_fields := changed_fields + 1; end if;
  if old.description is distinct from new.description then changed_fields := changed_fields + 1; end if;
  if old.floor is distinct from new.floor then changed_fields := changed_fields + 1; end if;
  if old.access_type is distinct from new.access_type then changed_fields := changed_fields + 1; end if;
  if old.access_notes is distinct from new.access_notes then changed_fields := changed_fields + 1; end if;
  if old.cost_type is distinct from new.cost_type then changed_fields := changed_fields + 1; end if;
  if old.gender_category is distinct from new.gender_category then changed_fields := changed_fields + 1; end if;
  if old.toilet_type is distinct from new.toilet_type then changed_fields := changed_fields + 1; end if;
  if old.amenities is distinct from new.amenities then changed_fields := changed_fields + 1; end if;

  if changed_fields > 0 then
    perform award_points(auth.uid(), changed_fields * 5);
  end if;

  return new;
end;
$$;

create trigger award_points_on_bathroom_edit_trigger
  after update on bathrooms
  for each row
  when (
    old.name is distinct from new.name or
    old.venue_name is distinct from new.venue_name or
    old.description is distinct from new.description or
    old.floor is distinct from new.floor or
    old.access_type is distinct from new.access_type or
    old.access_notes is distinct from new.access_notes or
    old.cost_type is distinct from new.cost_type or
    old.gender_category is distinct from new.gender_category or
    old.toilet_type is distinct from new.toilet_type or
    old.amenities is distinct from new.amenities
  )
  execute function award_points_on_bathroom_edit();

-- Level is purely derived from points - a generated column keeps it always
-- in sync with zero extra queries/writes, and it's selectable everywhere
-- profiles already are (Feed/Reviews author lookups, profile screens).
alter table profiles
  add column level integer generated always as (
    case
      when points >= 300 then 3
      when points >= 100 then 2
      else 1
    end
  ) stored;
