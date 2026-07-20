-- Lav: bulk-import columns
--
-- Captures schema drift: a 349k-row OpenStreetMap CSV was imported directly
-- into `bathrooms` via Supabase Studio's table editor, which auto-created
-- three columns to match the CSV's own shape (name, latitude, longitude,
-- wheelchair_accessible, has_changing_station, dataset_source) rather than
-- going through a migration. This file just formalizes what's already live
-- so a future `db reset` doesn't lose the column definitions - `if not
-- exists` throughout since the columns already exist on this database.
--
-- wheelchair_accessible / has_changing_station duplicate flags that already
-- live in the `amenities` jsonb map (see src/constants/amenities.ts) for
-- app-written rows - kept as their own columns here rather than immediately
-- folded into `amenities`, since that migration touches 349k rows and is a
-- separate decision from just not losing the columns on reset.
alter table bathrooms add column if not exists wheelchair_accessible boolean;
alter table bathrooms add column if not exists has_changing_station boolean;
alter table bathrooms add column if not exists dataset_source text;

create index if not exists bathrooms_dataset_source_idx on bathrooms (dataset_source);

comment on column bathrooms.wheelchair_accessible is 'Bulk-import flag (OpenStreetMap/NYC/Taiwan CSVs) - app-written rows use amenities.wheelchair_accessible instead.';
comment on column bathrooms.has_changing_station is 'Bulk-import flag (OpenStreetMap/NYC/Taiwan CSVs) - app-written rows use amenities.baby_changing instead.';
comment on column bathrooms.dataset_source is 'Provenance for bulk-imported rows, e.g. OpenStreetMap / NYC_OpenData / Taiwan_OpenData. Null for app-written rows.';
