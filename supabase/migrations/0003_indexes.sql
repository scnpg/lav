-- Lav: indexes
-- Spatial index is the one that matters most: it's what makes
-- get_verified_bathrooms_nearby() fast instead of a full table scan.

create index if not exists bathrooms_location_gix on bathrooms using gist (location);

create index if not exists bathrooms_status_idx on bathrooms (status);
create index if not exists bathrooms_city_idx on bathrooms (city);
create index if not exists bathrooms_tags_gin on bathrooms using gin (tags);
create index if not exists bathrooms_submitted_by_idx on bathrooms (submitted_by);
create index if not exists bathrooms_created_at_idx on bathrooms (created_at desc);

-- Trigram-ish fallback for ILIKE search across text fields used by
-- search_verified_bathrooms(). pg_trgm isn't enabled by default on all
-- Supabase projects, so we keep the search RPC on ILIKE + btree for MVP and
-- just index the common equality/sort paths here.
create index if not exists bathrooms_name_idx on bathrooms (name);

create index if not exists bathroom_photos_bathroom_id_idx on bathroom_photos (bathroom_id);
create index if not exists bathroom_photos_user_id_idx on bathroom_photos (user_id);
create index if not exists bathroom_photos_status_idx on bathroom_photos (status);
create index if not exists bathroom_photos_moderation_status_idx on bathroom_photos (moderation_status);
create index if not exists bathroom_photos_created_at_idx on bathroom_photos (created_at desc);

create index if not exists reviews_bathroom_id_idx on reviews (bathroom_id);
create index if not exists reviews_user_id_idx on reviews (user_id);
create index if not exists reviews_created_at_idx on reviews (created_at desc);

create index if not exists checkins_bathroom_id_idx on checkins (bathroom_id);
create index if not exists checkins_user_id_idx on checkins (user_id);
create index if not exists checkins_created_at_idx on checkins (created_at desc);

create index if not exists saved_bathrooms_bathroom_id_idx on saved_bathrooms (bathroom_id);

create index if not exists bathroom_lists_creator_id_idx on bathroom_lists (creator_id);
create index if not exists bathroom_lists_visibility_idx on bathroom_lists (visibility);
create index if not exists bathroom_lists_created_at_idx on bathroom_lists (created_at desc);

create index if not exists bathroom_list_items_list_id_idx on bathroom_list_items (list_id);
create index if not exists bathroom_list_items_bathroom_id_idx on bathroom_list_items (bathroom_id);

create index if not exists saved_bathroom_lists_list_id_idx on saved_bathroom_lists (list_id);

create index if not exists reports_status_idx on reports (status);
create index if not exists reports_bathroom_id_idx on reports (bathroom_id);
create index if not exists reports_review_id_idx on reports (review_id);
create index if not exists reports_list_id_idx on reports (list_id);
create index if not exists reports_photo_id_idx on reports (photo_id);
create index if not exists reports_created_at_idx on reports (created_at desc);

create index if not exists moderation_events_bathroom_id_idx on moderation_events (bathroom_id);
create index if not exists moderation_events_photo_id_idx on moderation_events (photo_id);
create index if not exists moderation_events_created_at_idx on moderation_events (created_at desc);
