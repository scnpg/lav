import { supabase } from "../../lib/supabase";
import type { BathroomNearby, BathroomPrivateFields, BathroomPublic } from "../../types/database";
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
const BATHROOM_PUBLIC_COLUMNS = `
  id, name, venue_name, description, address, city, region, country, floor,
  latitude, longitude, status, access_type, purchase_required, purchase_note,
  access_difficulty, access_notes, access_code_public_allowed, cost_type, cost_amount,
  gender_category, toilet_type, amenities, tags, open_hours,
  cleanliness_score, safety_score, privacy_score, smell_score, prestige_score, overall_score,
  review_count, photo_count, submitted_by, verified_by, verified_at, last_verified_at,
  created_at, updated_at
`;

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error("Not found");
  return result.data;
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

export async function searchBathroomsByText(query: string): Promise<BathroomNearby[]> {
  if (!query.trim()) return [];
  const { data, error } = await supabase.rpc("search_verified_bathrooms", { search_query: query.trim() });
  if (error) throw new Error(error.message);
  return (data ?? []) as BathroomNearby[];
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
