import { haversineDistanceMeters } from "../../lib/geo";
import { supabase } from "../../lib/supabase";
import type { BathroomCluster, BathroomNearby, BathroomPrivateFields, BathroomPublic } from "../../types/database";
import type {
  AccessDifficulty,
  AccessType,
  AmenitiesMap,
  BathroomStatus,
  CostType,
  GenderCategory,
  OpenHours,
  ToiletType,
} from "../../types/enums";

// Explicit column list for every direct (non-RPC) read of `bathrooms`. Never
// add private_access_code / submission_latitude / submission_longitude here -
// those columns are SELECT-revoked for the authenticated role in
// 0006_rls.sql, so including them would make the whole query fail with a
// permission error for every non-admin caller. Admins read them separately
// via getBathroomPrivateFields() below.
export const BATHROOM_PUBLIC_COLUMNS = `
  id, name, venue_name, description, address, city, region, country, floor,
  latitude, longitude, status, access_type, purchase_required, purchase_note,
  access_difficulty, access_notes, access_code_public_allowed, cost_type, cost_amount,
  gender_category, toilet_type, amenities, tags, open_hours,
  cleanliness_score, safety_score, privacy_score, smell_score, prestige_score, overall_score,
  review_count, photo_count, submitted_by, verified_by, verified_at, last_verified_at,
  name_verified, name_verified_at, venue_id,
  created_at, updated_at
`;

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error("Not found");
  return result.data;
}

export interface MapBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

// Hard cap, not a page size - with 349k+ bathrooms imported (OpenStreetMap,
// global), a wide viewport can match tens of thousands of rows. The old
// version of this function paginated through *all* of them, which is
// exactly what was causing the map to lag: panning out even a little could
// trigger dozens of sequential 1000-row fetches and a supercluster rebuild
// over an ever-growing array. Capping at a flat 300 keeps every fetch (and
// the clustering pass on the result) fast regardless of how dense the
// viewport is - the map screen also refuses to fetch at all once the
// viewport is wider than roughly a city (see isViewportTooWide in
// app/(tabs)/index.tsx), so this limit is a backstop, not the primary
// defense against a huge result set.
const BOUNDS_QUERY_LIMIT = 300;

// The map's data source: queries only the current viewport every time the
// user stops panning/zooming (see MapView's onRegionChangeComplete),
// filtered on the plain latitude/longitude columns (bathrooms_latitude_idx /
// bathrooms_longitude_idx, 0009_bbox_indexes.sql) rather than the `location`
// geography column, which is indexed for the radius-search RPC below, not a
// rectangular bounds filter.
export async function getBathroomsInBounds(bounds: MapBounds): Promise<BathroomPublic[]> {
  let query = supabase
    .from("bathrooms")
    .select(BATHROOM_PUBLIC_COLUMNS)
    .eq("status", "verified")
    .gte("latitude", bounds.south)
    .lte("latitude", bounds.north);

  // A viewport panned across the antimeridian (e.g. dragging from Asia
  // toward the Americas) reports west > east - longitude.gte(west) AND
  // longitude.lte(east) would then match nothing, since no value is both.
  // The correct condition becomes an OR: east of `west` OR west of `east`.
  query =
    bounds.west <= bounds.east
      ? query.gte("longitude", bounds.west).lte("longitude", bounds.east)
      : query.or(`longitude.gte.${bounds.west},longitude.lte.${bounds.east}`);

  // A stable ORDER BY is required here, not optional - without one, Postgres
  // is free to return a *different* arbitrary 300-row subset of the matching
  // bathrooms on every identical call, which looked like pins reshuffling on
  // every pan. The first fix for that (ordering by latitude, then longitude)
  // was itself wrong: for any viewport with more than LIMIT matches, "order
  // by latitude" returns only the southernmost slice of the bbox, silently
  // dropping everything further north - confirmed directly against a dense
  // Taipei viewport (lat 24.90-25.20 full range) where that ordering only
  // ever returned rows from 24.90-25.01, missing the entire northern
  // two-thirds. Panning across whatever latitude the truncation happened to
  // land on made whole clusters of pins pop in/out of existence - the
  // reported "pins spaz all over the map".
  //
  // `id` is a random UUID (gen_random_uuid(), 0002_tables.sql) with no
  // spatial correlation, so ordering by it instead gives a sample spread
  // roughly evenly across the *whole* matching set - confirmed the same
  // Taipei query now covers 24.91-25.19, essentially the full range - while
  // staying just as deterministic (same bbox always returns the same rows)
  // and at least as cheap (primary key index scan).
  const { data, error } = await query.order("id", { ascending: true }).limit(BOUNDS_QUERY_LIMIT);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as BathroomPublic[];
}

/**
 * Every verified restroom belonging to one venue (0042_venues.sql /
 * 0043_bathrooms_venue_id.sql) - fetched on demand when a multi-restroom
 * venue pin is tapped on the map (LocationGroupSheet's data source), rather
 * than relying on whatever happens to already be loaded in the map's own
 * windowed getBathroomsInBounds result, which isn't guaranteed to include
 * every member of a given venue.
 */
export async function getBathroomsByVenueId(venueId: string): Promise<BathroomNearby[]> {
  const { data, error } = await supabase
    .from("bathrooms")
    .select(BATHROOM_PUBLIC_COLUMNS)
    .eq("venue_id", venueId)
    .eq("status", "verified")
    .order("floor", { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as BathroomPublic[]).map((b) => ({ ...b, distance_meters: 0 }));
}

/**
 * Groups verified bathrooms within clusterRadiusMeters of each other (e.g.
 * several restrooms in the same building) via get_clustered_bathrooms()
 * (0034_postgis_clustering_and_name_verification.sql) - a ST_ClusterDBSCAN
 * pass server-side, not a client-side reclustering of getBathroomsInBounds's
 * result. Meant for a tight, building-scale viewport: the default 15m radius
 * doesn't mean much over a city-wide bbox.
 */
export async function getClusteredBathrooms(
  bounds: MapBounds,
  clusterRadiusMeters = 15
): Promise<BathroomCluster[]> {
  const { data, error } = await supabase.rpc("get_clustered_bathrooms", {
    min_lat: bounds.south,
    max_lat: bounds.north,
    min_lng: bounds.west,
    max_lng: bounds.east,
    cluster_radius_meters: clusterRadiusMeters,
  });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getNearbyBathrooms(
  lat: number,
  lng: number,
  radiusMeters = 3000
): Promise<BathroomNearby[]> {
  const { data, error } = await supabase.rpc("get_verified_bathrooms_nearby", {
    lat,
    lng,
    radius_meters: radiusMeters,
  });
  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * Global (not viewport-scoped) text search over every verified bathroom, via
 * search_verified_bathrooms() - unlike searchBathrooms() in ./search.ts,
 * which only filters whatever's already loaded into map state.
 * search_verified_bathrooms's own return shape doesn't include a distance
 * (it has no concept of "from where"), so distance_meters - required by
 * BathroomNearby - is computed here instead: real haversine distance when
 * the caller has a location to compare against, 0 otherwise (same
 * placeholder convention the Map screen's own getBathroomsInBounds call
 * site already uses).
 */
export async function searchBathroomsByText(
  query: string,
  userLocation?: { latitude: number; longitude: number } | null
): Promise<BathroomNearby[]> {
  if (!query.trim()) return [];
  const { data, error } = await supabase.rpc("search_verified_bathrooms", { search_query: query.trim() });
  if (error) throw new Error(error.message);
  return ((data ?? []) as BathroomNearby[]).map((b) => ({
    ...b,
    distance_meters: userLocation ? haversineDistanceMeters(userLocation, b) : 0,
  }));
}

export async function getBathroomById(id: string): Promise<BathroomPublic | null> {
  const { data, error } = await supabase
    .from("bathrooms")
    .select(BATHROOM_PUBLIC_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as unknown as BathroomPublic | null;
}

/** Admin-only. Throws if the caller isn't an admin (enforced in the DB function itself). */
export async function getBathroomPrivateFields(id: string): Promise<BathroomPrivateFields | null> {
  const { data, error } = await supabase.rpc("admin_get_bathroom_private_fields", {
    target_bathroom_id: id,
  });
  if (error) throw new Error(error.message);
  return data?.[0] ?? null;
}

export interface NearbyDuplicate {
  id: string;
  name: string;
  status: BathroomStatus;
  distance_meters: number;
}

export async function findNearbyDuplicates(
  lat: number,
  lng: number,
  radiusMeters = 50
): Promise<NearbyDuplicate[]> {
  const { data, error } = await supabase.rpc("find_nearby_duplicate_bathrooms", {
    lat,
    lng,
    radius_meters: radiusMeters,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as NearbyDuplicate[];
}

export interface SubmitBathroomInput {
  name: string;
  venue_name?: string | null;
  description?: string | null;
  address?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  floor?: string | null;
  latitude: number;
  longitude: number;
  access_type?: AccessType | null;
  purchase_required?: boolean;
  purchase_note?: string | null;
  access_difficulty?: AccessDifficulty | null;
  access_notes?: string | null;
  private_access_code?: string | null;
  cost_type?: CostType | null;
  cost_amount?: number | null;
  gender_category?: GenderCategory | null;
  toilet_type?: ToiletType | null;
  amenities?: AmenitiesMap;
  open_hours?: OpenHours;
  submission_latitude?: number | null;
  submission_longitude?: number | null;
  submitted_by: string;
}

export async function submitBathroom(input: SubmitBathroomInput): Promise<BathroomPublic> {
  const result = await supabase
    .from("bathrooms")
    .insert({ ...input, status: "pending" })
    .select(BATHROOM_PUBLIC_COLUMNS)
    .single();
  return unwrap(result) as unknown as BathroomPublic;
}

// The "fill in missing data" patch shape for the Edit Info form - deliberately
// narrower than AdminBathroomPatch below (no latitude/longitude/status/etc.).
// This isn't just a UI choice: 0012_community_bathroom_edits.sql's
// guard_bathroom_update() trigger silently reverts those columns for any
// non-admin caller, so a wider type here would let a caller believe a write
// succeeded when the database quietly discarded it.
export interface BathroomFillMissingPatch {
  name?: string;
  venue_name?: string | null;
  description?: string | null;
  floor?: string | null;
  access_type?: AccessType | null;
  access_notes?: string | null;
  cost_type?: CostType | null;
  cost_amount?: number | null;
  gender_category?: GenderCategory | null;
  toilet_type?: ToiletType | null;
  amenities?: AmenitiesMap;
  open_hours?: OpenHours;
}

/**
 * Community edit: any signed-in user filling in missing fields on a
 * verified bathroom (or their own still-pending submission) - never an
 * admin-only action. RLS (bathrooms_update_authenticated_fill_missing) and
 * the guard_bathroom_update trigger enforce the actual boundaries; this
 * function's narrower patch type just keeps the client from trying to send
 * fields that would be silently dropped.
 */
export async function updateBathroomDetails(id: string, patch: BathroomFillMissingPatch): Promise<BathroomPublic> {
  const result = await supabase.from("bathrooms").update(patch).eq("id", id).select(BATHROOM_PUBLIC_COLUMNS).single();
  return unwrap(result) as unknown as BathroomPublic;
}

export async function updateBathroomScores(bathroomId: string): Promise<void> {
  const { error } = await supabase.rpc("update_bathroom_scores", { target_bathroom_id: bathroomId });
  if (error) throw new Error(error.message);
}

export async function isBathroomSaved(bathroomId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("saved_bathrooms")
    .select("bathroom_id")
    .eq("bathroom_id", bathroomId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return !!data;
}

export async function saveBathroom(bathroomId: string, userId: string): Promise<void> {
  const { error } = await supabase.from("saved_bathrooms").insert({ bathroom_id: bathroomId, user_id: userId });
  if (error) throw new Error(error.message);
}

export async function unsaveBathroom(bathroomId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("saved_bathrooms")
    .delete()
    .eq("bathroom_id", bathroomId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

/**
 * Flips the bookmark - thin wrapper over saveBathroom/unsaveBathroom for
 * callers that already know the current state (e.g. a heart icon toggling
 * off its own last-known value) and don't want to re-fetch isBathroomSaved
 * just to decide which one to call. Returns the new saved state.
 */
export async function toggleBookmark(
  bathroomId: string,
  userId: string,
  currentlySaved: boolean
): Promise<boolean> {
  if (currentlySaved) {
    await unsaveBathroom(bathroomId, userId);
    return false;
  }
  await saveBathroom(bathroomId, userId);
  return true;
}

export async function getSavedBathrooms(userId: string): Promise<BathroomPublic[]> {
  const { data: saved, error: savedError } = await supabase
    .from("saved_bathrooms")
    .select("bathroom_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (savedError) throw new Error(savedError.message);
  if (!saved || saved.length === 0) return [];

  const ids = saved.map((row) => row.bathroom_id);
  const { data: bathrooms, error: bathroomsError } = await supabase
    .from("bathrooms")
    .select(BATHROOM_PUBLIC_COLUMNS)
    .in("id", ids);
  if (bathroomsError) throw new Error(bathroomsError.message);

  const byId = new Map((bathrooms ?? []).map((b) => [(b as unknown as BathroomPublic).id, b as unknown as BathroomPublic]));
  return ids.map((id) => byId.get(id)).filter((b): b is BathroomPublic => !!b);
}

export async function reportBathroom(bathroomId: string, userId: string, reason: string, details?: string): Promise<void> {
  const { error } = await supabase.from("reports").insert({
    bathroom_id: bathroomId,
    user_id: userId,
    reason,
    details: details ?? null,
  });
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Admin moderation
// ---------------------------------------------------------------------------
export async function adminListBathrooms(status?: BathroomStatus): Promise<BathroomPublic[]> {
  let q = supabase.from("bathrooms").select(BATHROOM_PUBLIC_COLUMNS).order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as BathroomPublic[];
}

export interface AdminBathroomPatch {
  name?: string;
  venue_name?: string | null;
  description?: string | null;
  address?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  floor?: string | null;
  latitude?: number;
  longitude?: number;
  access_type?: AccessType | null;
  purchase_required?: boolean;
  purchase_note?: string | null;
  access_difficulty?: AccessDifficulty | null;
  access_notes?: string | null;
  cost_type?: CostType | null;
  cost_amount?: number | null;
  gender_category?: GenderCategory | null;
  toilet_type?: ToiletType | null;
  amenities?: AmenitiesMap;
  open_hours?: OpenHours;
}

export async function adminUpdateBathroom(id: string, patch: AdminBathroomPatch): Promise<BathroomPublic> {
  const result = await supabase.from("bathrooms").update(patch).eq("id", id).select(BATHROOM_PUBLIC_COLUMNS).single();
  return unwrap(result) as unknown as BathroomPublic;
}

export async function adminSetBathroomStatus(
  id: string,
  status: BathroomStatus,
  adminId: string
): Promise<BathroomPublic> {
  const patch: Pick<BathroomPublic, "status"> &
    Partial<Pick<BathroomPublic, "verified_by" | "verified_at" | "last_verified_at">> = { status };
  if (status === "verified") {
    patch.verified_by = adminId;
    patch.verified_at = new Date().toISOString();
    patch.last_verified_at = new Date().toISOString();
  }
  const result = await supabase.from("bathrooms").update(patch).eq("id", id).select(BATHROOM_PUBLIC_COLUMNS).single();
  const bathroom = unwrap(result) as unknown as BathroomPublic;

  await supabase.from("moderation_events").insert({
    bathroom_id: id,
    admin_id: adminId,
    action: `set_status_${status}`,
  });

  return bathroom;
}
