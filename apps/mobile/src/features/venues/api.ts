import { supabase } from "../../lib/supabase";
import type { MapBounds } from "../bathrooms/api";
import type { VenueWithStats } from "../../types/database";

// The map's pin-per-venue data source - one row per physical building
// (venue_id grouping, see 0042_venues.sql/0043_bathrooms_venue_id.sql), not
// per individual restroom. Same bounds shape as getBathroomsInBounds
// (src/features/bathrooms/api.ts), which stays in use for everything that
// still needs individual-restroom data (detail screen, search, submit
// wizard, reviews) - only the map's own pin rendering moves to this.
export async function getVenuesInBounds(bounds: MapBounds): Promise<VenueWithStats[]> {
  const { data, error } = await supabase.rpc("get_venues_in_bounds", {
    min_lat: bounds.south,
    max_lat: bounds.north,
    min_lng: bounds.west,
    max_lng: bounds.east,
  });
  if (error) throw new Error(error.message);
  return data ?? [];
}
