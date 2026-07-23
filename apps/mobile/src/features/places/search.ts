// Geocoding for "I don't know this city" search - streets, districts,
// neighborhoods, metro stations, landmarks, stores, hotels, etc. Bathrooms
// themselves are still searched locally (src/features/bathrooms/search.ts);
// this covers everything else, so someone unfamiliar with the area can type
// a place they know and get flown there, then let the map's own
// viewport-based fetch show whatever bathrooms are nearby.
//
// Nominatim (OpenStreetMap's free geocoder) - same "no API key, OSM-based"
// choice already made for map tiles (see src/lib/mapStyle.ts). Its usage
// policy (https://operations.osmfoundation.org/policies/nominatim/) asks for
// max ~1 request/second and a way to identify the calling application;
// browser fetch can't set a custom User-Agent (a forbidden header), so this
// relies on the browser's own Referer header, which is good enough for local
// development but not a production-scale integration - a real deployment
// should proxy this through a backend with a proper User-Agent, or move to
// a paid geocoding tier, the same disclaimer mapStyle.ts already makes about
// its own dev fallback.
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

export interface PlaceResult {
  id: string;
  label: string;
  sublabel: string;
  latitude: number;
  longitude: number;
  category: string;
}

// A short, mostly-cosmetic bucket for the result-row icon - not exhaustive,
// falls back to a generic pin for anything else.
function categoryFrom(osmClass: string, osmType: string): string {
  if (osmClass === "railway" || osmType === "station") return "train";
  if (osmClass === "highway") return "street";
  if (osmType === "hotel" || osmType === "hostel") return "hotel";
  if (osmClass === "shop") return "store";
  if (osmClass === "tourism" || osmClass === "historic") return "landmark";
  if (osmType === "neighbourhood" || osmType === "suburb") return "neighborhood";
  if (osmType === "city_district" || osmClass === "boundary") return "district";
  return "place";
}

// display_name is a long, comma-joined string like "Taipei 101, Xinyi Road,
// Xinyi District, Taipei, Taiwan" - only the first segment (the actual
// place) is the label; everything else, joined back with " · ", becomes a
// short subtitle like the bathroom list's own venue/access subtitle line.
function splitDisplayName(displayName: string): { label: string; sublabel: string } {
  const [label, ...rest] = displayName.split(",").map((part) => part.trim());
  return { label: label || displayName, sublabel: rest.slice(0, 2).join(" · ") };
}

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<PlaceResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const url = `${NOMINATIM_URL}?format=jsonv2&q=${encodeURIComponent(trimmed)}&limit=6&addressdetails=0`;
  const response = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Couldn't search places right now.");

  const rows = (await response.json()) as Array<{
    place_id: number;
    display_name: string;
    lat: string;
    lon: string;
    class: string;
    type: string;
  }>;

  return rows.map((row) => {
    const { label, sublabel } = splitDisplayName(row.display_name);
    return {
      id: String(row.place_id),
      label,
      sublabel,
      latitude: Number(row.lat),
      longitude: Number(row.lon),
      category: categoryFrom(row.class, row.type),
    };
  });
}
