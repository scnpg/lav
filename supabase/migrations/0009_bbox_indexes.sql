-- Lav: bounding-box query indexes
--
-- The map switched from "fetch every verified bathroom" to a server-side
-- bounding-box query (see getBathroomsInBounds in
-- src/features/bathrooms/api.ts) once the dataset grew past what's
-- reasonable to ship to a client in one request (350k+ rows from the
-- OpenStreetMap import). That query filters directly on the scalar
-- latitude/longitude columns rather than the existing `location` geography
-- column (bathrooms_location_gix in 0003_indexes.sql), so it needs its own
-- indexes - the GIST index on `location` doesn't help a plain
-- `latitude between ... and longitude between ...` query.
create index if not exists bathrooms_latitude_idx on bathrooms (latitude);
create index if not exists bathrooms_longitude_idx on bathrooms (longitude);
