-- Lav: trigger functions

-- ---------------------------------------------------------------------------
-- Generic updated_at maintenance, applied to every table that has the column.
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at on profiles;
create trigger set_updated_at before update on profiles
  for each row execute function set_updated_at();

drop trigger if exists set_updated_at on bathrooms;
create trigger set_updated_at before update on bathrooms
  for each row execute function set_updated_at();

drop trigger if exists set_updated_at on reviews;
create trigger set_updated_at before update on reviews
  for each row execute function set_updated_at();

drop trigger if exists set_updated_at on bathroom_lists;
create trigger set_updated_at before update on bathroom_lists
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Auto-create a profiles row whenever someone signs up via Supabase Auth.
-- MVP assumption: username defaults to the local part of their email plus a
-- short random suffix to avoid collisions; users can change it later from
-- Profile > Settings (settings UI is a placeholder for MVP).
-- ---------------------------------------------------------------------------
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text;
  final_username text;
begin
  base_username := lower(regexp_replace(split_part(new.email, '@', 1), '[^a-zA-Z0-9_]', '', 'g'));
  if base_username is null or length(base_username) = 0 then
    base_username := 'lav_user';
  end if;
  final_username := base_username || '_' || substr(replace(new.id::text, '-', ''), 1, 6);

  insert into public.profiles (id, username, display_name)
  values (new.id, final_username, base_username)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- Keep bathrooms.location in sync with latitude/longitude if either is
-- updated directly (e.g. an admin edits coordinates in the moderation UI).
-- ---------------------------------------------------------------------------
create or replace function sync_bathroom_location()
returns trigger
language plpgsql
as $$
begin
  if new.latitude is not null and new.longitude is not null then
    new.location = geography(st_setsrid(st_makepoint(new.longitude, new.latitude), 4326));
  end if;
  return new;
end;
$$;

drop trigger if exists sync_bathroom_location on bathrooms;
create trigger sync_bathroom_location before insert or update on bathrooms
  for each row execute function sync_bathroom_location();

-- ---------------------------------------------------------------------------
-- Keep bathrooms.photo_count in sync with public photo approvals.
-- ---------------------------------------------------------------------------
create or replace function sync_bathroom_photo_count()
returns trigger
language plpgsql
as $$
declare
  target_bathroom_id uuid;
begin
  target_bathroom_id := coalesce(new.bathroom_id, old.bathroom_id);

  update bathrooms
  set photo_count = (
    select count(*) from bathroom_photos
    where bathroom_id = target_bathroom_id and is_public = true
  )
  where id = target_bathroom_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists sync_bathroom_photo_count on bathroom_photos;
create trigger sync_bathroom_photo_count
  after insert or update or delete on bathroom_photos
  for each row execute function sync_bathroom_photo_count();

-- ---------------------------------------------------------------------------
-- Derive bathroom_photos.is_public from status, so an admin UI bug can never
-- leak an unapproved photo just by forgetting to also flip is_public.
-- ---------------------------------------------------------------------------
create or replace function sync_photo_public_flag()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'approved' then
    new.is_public = true;
  else
    new.is_public = false;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_photo_public_flag on bathroom_photos;
create trigger sync_photo_public_flag before insert or update on bathroom_photos
  for each row execute function sync_photo_public_flag();

-- ---------------------------------------------------------------------------
-- Keep bathroom_lists.like_count / save_count denormalized counters in sync.
-- ---------------------------------------------------------------------------
create or replace function sync_list_like_count()
returns trigger
language plpgsql
as $$
declare
  target_list_id uuid;
begin
  target_list_id := coalesce(new.list_id, old.list_id);
  update bathroom_lists
  set like_count = (select count(*) from bathroom_list_likes where list_id = target_list_id)
  where id = target_list_id;
  return coalesce(new, old);
end;
$$;

drop trigger if exists sync_list_like_count on bathroom_list_likes;
create trigger sync_list_like_count
  after insert or delete on bathroom_list_likes
  for each row execute function sync_list_like_count();

create or replace function sync_list_save_count()
returns trigger
language plpgsql
as $$
declare
  target_list_id uuid;
begin
  target_list_id := coalesce(new.list_id, old.list_id);
  update bathroom_lists
  set save_count = (select count(*) from saved_bathroom_lists where list_id = target_list_id)
  where id = target_list_id;
  return coalesce(new, old);
end;
$$;

drop trigger if exists sync_list_save_count on saved_bathroom_lists;
create trigger sync_list_save_count
  after insert or delete on saved_bathroom_lists
  for each row execute function sync_list_save_count();
