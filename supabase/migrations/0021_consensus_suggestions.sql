-- Crowd-sourced consensus: raw per-user suggestions for a bathroom's name or
-- a specific amenity flag. field_name is intentionally unconstrained at the
-- DB level (no check constraint) - it's either the literal 'name' or one of
-- the AmenityKey values from src/types/enums.ts, validated client-side,
-- matching this schema's existing convention for bathrooms.tags/amenities
-- (also no DB-level enum constraint). suggested_value is always text: the
-- literal name string, or 'true'/'false' for an amenity flag.
create table if not exists bathroom_suggestions (
  id uuid primary key default gen_random_uuid(),
  bathroom_id uuid not null references bathrooms(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  field_name text not null,
  suggested_value text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bathroom_id, user_id, field_name)
);

create index bathroom_suggestions_bathroom_id_idx on bathroom_suggestions (bathroom_id);
create index bathroom_suggestions_user_id_idx on bathroom_suggestions (user_id);

create trigger set_updated_at
  before update on bathroom_suggestions
  for each row execute function set_updated_at();

alter table bathroom_suggestions enable row level security;

create policy bathroom_suggestions_select_all_authenticated on bathroom_suggestions
  for select to authenticated using (true);

create policy bathroom_suggestions_insert_own on bathroom_suggestions
  for insert to authenticated with check (user_id = auth.uid());

create policy bathroom_suggestions_update_own on bathroom_suggestions
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy bathroom_suggestions_delete_own on bathroom_suggestions
  for delete to authenticated using (user_id = auth.uid());

-- +5 for submitting a suggestion, same rate as a direct field edit. Only on
-- INSERT - changing your mind on an existing suggestion (UPDATE) doesn't
-- re-award.
create or replace function award_points_on_suggestion()
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

create trigger award_points_on_suggestion_trigger
  after insert on bathroom_suggestions
  for each row execute function award_points_on_suggestion();

-- The consensus itself: statistical mode across every live suggestion for a
-- bathroom, one field at a time. SECURITY DEFINER because the writing user
-- (whoever just submitted the suggestion that triggered this) may not be the
-- author of the winning value - the whole point is that the *group's* most
-- common answer wins, not just the caller's own.
create or replace function recalculate_bathroom_consensus(target_bathroom_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  consensus_name text;
  rec record;
begin
  select mode() within group (order by suggested_value)
  into consensus_name
  from bathroom_suggestions
  where bathroom_id = target_bathroom_id and field_name = 'name';

  if consensus_name is not null then
    update bathrooms
    set name = consensus_name
    where id = target_bathroom_id and name is distinct from consensus_name;
  end if;

  for rec in
    select field_name, mode() within group (order by suggested_value) as consensus_value
    from bathroom_suggestions
    where bathroom_id = target_bathroom_id and field_name <> 'name'
    group by field_name
  loop
    update bathrooms
    set amenities = jsonb_set(
      coalesce(amenities, '{}'::jsonb),
      array[rec.field_name],
      to_jsonb(rec.consensus_value = 'true')
    )
    where id = target_bathroom_id;
  end loop;
end;
$$;

create or replace function recalculate_bathroom_consensus_trigger_fn()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform recalculate_bathroom_consensus(new.bathroom_id);
  return new;
end;
$$;

create trigger recalculate_bathroom_consensus_trigger
  after insert or update on bathroom_suggestions
  for each row execute function recalculate_bathroom_consensus_trigger_fn();
