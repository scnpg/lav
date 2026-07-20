import { attachAuthors, type ProfileLite } from "../../lib/profiles";
import { haversineDistanceMeters } from "../../lib/geo";
import { supabase } from "../../lib/supabase";
import type { BathroomImage, BathroomPublic, BathroomReview, BathroomReviewStats } from "../../types/database";

// The 0.0-10.0 "Beli for bathrooms" rating engine - see
// supabase/migrations/0016_bathroom_reviews.sql for the schema and why it's
// a separate table from the older 1-5 scale reviewsApi.ts/`reviews`.

export interface UpsertReviewInput {
  bathroom_id: string;
  user_id: string;
  overall_rating: number;
  cleanliness_score?: number | null;
  smell_score?: number | null;
  ambience_score?: number | null;
  privacy_score?: number | null;
  review_text?: string | null;
}

/** Insert-or-update: bathroom_reviews has a unique(user_id, bathroom_id), so re-rating a place updates your existing row instead of creating a second one. */
export async function upsertBathroomReview(input: UpsertReviewInput): Promise<BathroomReview> {
  const { data, error } = await supabase
    .from("bathroom_reviews")
    .upsert(input, { onConflict: "user_id,bathroom_id" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getMyReview(bathroomId: string, userId: string): Promise<BathroomReview | null> {
  const { data, error } = await supabase
    .from("bathroom_reviews")
    .select("*")
    .eq("bathroom_id", bathroomId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

const EMPTY_STATS: BathroomReviewStats = {
  review_count: 0,
  avg_overall: null,
  avg_cleanliness: null,
  avg_smell: null,
  avg_ambience: null,
  avg_privacy: null,
};

/** Live-computed averages (see get_bathroom_review_stats() in 0016) - never denormalized onto bathrooms, this is a single indexed-bathroom_id lookup regardless of table size. */
export async function getBathroomReviewStats(bathroomId: string): Promise<BathroomReviewStats> {
  const { data, error } = await supabase.rpc("get_bathroom_review_stats", { target_bathroom_id: bathroomId });
  if (error) throw new Error(error.message);
  return data?.[0] ?? EMPTY_STATS;
}

export type BathroomReviewWithAuthor = BathroomReview & { author: ProfileLite | null };

export async function getReviewsForBathroom(bathroomId: string): Promise<BathroomReviewWithAuthor[]> {
  const { data, error } = await supabase
    .from("bathroom_reviews")
    .select("*")
    .eq("bathroom_id", bathroomId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return attachAuthors(data ?? []);
}

/** A user's own logged bathrooms, most recently rated first - the raw feed behind "Been There" (app/(tabs)/profile.tsx sorts this by overall_rating for the actual leaderboard). */
export async function getMyReviews(userId: string): Promise<BathroomReview[]> {
  const { data, error } = await supabase
    .from("bathroom_reviews")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export interface LoggedBathroom extends BathroomReview {
  bathroom: Pick<BathroomPublic, "id" | "name" | "venue_name"> | null;
}

/** Powers Profile's "Been There" leaderboard - sorted by the rating itself (highest first), not recency. */
export async function getMyLoggedBathrooms(userId: string): Promise<LoggedBathroom[]> {
  const { data: reviewRows, error } = await supabase
    .from("bathroom_reviews")
    .select("*")
    .eq("user_id", userId)
    .order("overall_rating", { ascending: false });
  if (error) throw new Error(error.message);
  if (!reviewRows || reviewRows.length === 0) return [];

  const bathroomIds = [...new Set(reviewRows.map((r) => r.bathroom_id))];
  const { data: bathroomRows, error: bathroomError } = await supabase
    .from("bathrooms")
    .select("id, name, venue_name")
    .in("id", bathroomIds);
  if (bathroomError) throw new Error(bathroomError.message);
  const bathroomsById = new Map((bathroomRows ?? []).map((b) => [b.id, b]));

  return reviewRows.map((r) => ({ ...r, bathroom: bathroomsById.get(r.bathroom_id) ?? null }));
}

export interface RecentReviewFeedItem extends BathroomReviewWithAuthor {
  bathroom: Pick<BathroomPublic, "id" | "name" | "venue_name"> | null;
}

/**
 * Powers the Feed tab. Two extra queries (authors, bathrooms) instead of a
 * PostgREST embedded select, matching this codebase's existing convention
 * (see attachAuthors in lib/profiles.ts) - fine at a 20-row page size.
 */
export async function getRecentReviews(limit = 20): Promise<RecentReviewFeedItem[]> {
  const { data: reviewRows, error } = await supabase
    .from("bathroom_reviews")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  if (!reviewRows || reviewRows.length === 0) return [];

  const withAuthors = await attachAuthors(reviewRows);

  const bathroomIds = [...new Set(reviewRows.map((r) => r.bathroom_id))];
  const { data: bathroomRows, error: bathroomError } = await supabase
    .from("bathrooms")
    .select("id, name, venue_name")
    .in("id", bathroomIds);
  if (bathroomError) throw new Error(bathroomError.message);
  const bathroomsById = new Map((bathroomRows ?? []).map((b) => [b.id, b]));

  return withAuthors.map((r) => ({ ...r, bathroom: bathroomsById.get(r.bathroom_id) ?? null }));
}

/** Friends tab: same review/author/bathroom join as getRecentReviews, scoped to a set of user ids. Empty friend list = empty feed, not "show me everyone." */
export async function getFriendsFeed(friendIds: string[], limit = 20): Promise<RecentReviewFeedItem[]> {
  if (friendIds.length === 0) return [];
  const { data: reviewRows, error } = await supabase
    .from("bathroom_reviews")
    .select("*")
    .in("user_id", friendIds)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  if (!reviewRows || reviewRows.length === 0) return [];

  const withAuthors = await attachAuthors(reviewRows);
  const bathroomIds = [...new Set(reviewRows.map((r) => r.bathroom_id))];
  const { data: bathroomRows, error: bathroomError } = await supabase
    .from("bathrooms")
    .select("id, name, venue_name")
    .in("id", bathroomIds);
  if (bathroomError) throw new Error(bathroomError.message);
  const bathroomsById = new Map((bathroomRows ?? []).map((b) => [b.id, b]));

  return withAuthors.map((r) => ({ ...r, bathroom: bathroomsById.get(r.bathroom_id) ?? null }));
}

const POPULAR_RADIUS_METERS = 15_000;
const POPULAR_WINDOW_DAYS = 30;
// A generous candidate pool fetched by recency first, then narrowed by the
// real haversine distance - not the other way around (pre-sorting globally
// by rating before filtering by distance would starve this tab in any area
// that just doesn't have many top-rated reviews yet, even though it may
// have plenty of *recent, nearby* ones).
const POPULAR_CANDIDATE_POOL = 500;

/**
 * Popular Near Me: reviews within 15km of the caller's live position, from
 * the trailing 30 days, highest-rated first. The distance filter runs
 * client-side against bathrooms.latitude/longitude (haversineDistanceMeters)
 * rather than a PostGIS query, matching this codebase's existing
 * client-side-join convention - fine at this candidate-pool size.
 */
export async function getPopularNearMe(
  userLocation: { latitude: number; longitude: number },
  limit = 20
): Promise<RecentReviewFeedItem[]> {
  const since = new Date(Date.now() - POPULAR_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: reviewRows, error } = await supabase
    .from("bathroom_reviews")
    .select("*")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(POPULAR_CANDIDATE_POOL);
  if (error) throw new Error(error.message);
  if (!reviewRows || reviewRows.length === 0) return [];

  const bathroomIds = [...new Set(reviewRows.map((r) => r.bathroom_id))];
  const { data: bathroomRows, error: bathroomError } = await supabase
    .from("bathrooms")
    .select("id, name, venue_name, latitude, longitude")
    .in("id", bathroomIds);
  if (bathroomError) throw new Error(bathroomError.message);
  const bathroomsById = new Map((bathroomRows ?? []).map((b) => [b.id, b]));

  const withAuthors = await attachAuthors(reviewRows);
  const nearby = withAuthors
    .map((r) => ({ ...r, bathroom: bathroomsById.get(r.bathroom_id) ?? null }))
    .filter((r) => r.bathroom && haversineDistanceMeters(userLocation, r.bathroom) <= POPULAR_RADIUS_METERS)
    .sort((a, b) => b.overall_rating - a.overall_rating)
    .slice(0, limit);

  return nearby.map((r) => ({
    ...r,
    bathroom: r.bathroom ? { id: r.bathroom.id, name: r.bathroom.name, venue_name: r.bathroom.venue_name } : null,
  }));
}

export async function getBathroomImages(bathroomId: string): Promise<BathroomImage[]> {
  const { data, error } = await supabase
    .from("bathroom_images")
    .select("*")
    .eq("bathroom_id", bathroomId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * Straight to the public bathroom_photos bucket, no quarantine/moderation
 * step - see 0017_bathroom_images.sql for why this is deliberately simpler
 * than the admin-reviewed bathroom_photos table/bucket pair. reviewId is
 * optional: the detail screen's "Add Photo" action can attach a photo
 * without going through "Rate & Log".
 */
export async function uploadReviewPhoto(
  bathroomId: string,
  userId: string,
  localUri: string,
  reviewId?: string | null
): Promise<BathroomImage> {
  const response = await fetch(localUri);
  const blob = await response.blob();
  const path = `${userId}/${bathroomId}-${Date.now()}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from("bathroom_photos")
    .upload(path, blob, { contentType: "image/jpeg" });
  if (uploadError) throw new Error(uploadError.message);

  const {
    data: { publicUrl },
  } = supabase.storage.from("bathroom_photos").getPublicUrl(path);

  const { data, error } = await supabase
    .from("bathroom_images")
    .insert({
      bathroom_id: bathroomId,
      user_id: userId,
      review_id: reviewId ?? null,
      storage_path: path,
      public_url: publicUrl,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}
