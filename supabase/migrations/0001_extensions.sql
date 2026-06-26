-- Lav: core extensions
-- PostGIS gives us geography(Point, 4326) + spatial indexing for "bathrooms near me".
-- pgcrypto gives us gen_random_uuid() for primary keys.

create extension if not exists "pgcrypto";
create extension if not exists "postgis";
