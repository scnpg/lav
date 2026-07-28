import type { ProfileLite } from "../../lib/profiles";
import { supabase } from "../../lib/supabase";
import type { Notification, ReviewReply } from "../../types/database";

// Likes/replies/notifications on bathroom_reviews ("posts" in the Feed) -
// see 0038_review_likes_replies_and_notifications.sql. None of this is
// gated behind admin review; only new bathroom submissions/amendments and
// name changes stay admin-gated elsewhere in this app.

export interface ReviewLikeState {
  count: number;
  likedByMe: boolean;
}

/**
 * Batch version, not one query per card: a 20-item feed doing this per-review
 * would be 40 round trips. Fetches every like row across the whole set once
 * and reduces counts/membership client-side - fine at this app's scale, same
 * "fetch raw rows, join in JS" approach as attachAuthors() in lib/profiles.ts.
 */
export async function getLikeStatesForReviews(
  reviewIds: string[],
  userId?: string | null
): Promise<Map<string, ReviewLikeState>> {
  const result = new Map<string, ReviewLikeState>(reviewIds.map((id) => [id, { count: 0, likedByMe: false }]));
  if (reviewIds.length === 0) return result;

  const { data, error } = await supabase.from("review_likes").select("review_id, user_id").in("review_id", reviewIds);
  if (error) throw new Error(error.message);

  for (const like of data ?? []) {
    const state = result.get(like.review_id);
    if (!state) continue;
    state.count += 1;
    if (userId && like.user_id === userId) state.likedByMe = true;
  }
  return result;
}

export async function toggleReviewLike(reviewId: string, userId: string, currentlyLiked: boolean): Promise<void> {
  if (currentlyLiked) {
    const { error } = await supabase.from("review_likes").delete().eq("review_id", reviewId).eq("user_id", userId);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("review_likes").insert({ review_id: reviewId, user_id: userId });
    if (error) throw new Error(error.message);
  }
}

/** Same batching reasoning as getLikeStatesForReviews - one query for the whole feed's reply counts. */
export async function getReplyCountsForReviews(reviewIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>(reviewIds.map((id) => [id, 0]));
  if (reviewIds.length === 0) return counts;

  const { data, error } = await supabase.from("review_replies").select("review_id").in("review_id", reviewIds);
  if (error) throw new Error(error.message);

  for (const reply of data ?? []) {
    counts.set(reply.review_id, (counts.get(reply.review_id) ?? 0) + 1);
  }
  return counts;
}

/** Single-review fetch for the replies modal - not part of the batched feed load above. */
export async function getReviewReplies(reviewId: string): Promise<(ReviewReply & { author: ProfileLite | null })[]> {
  const { data, error } = await supabase
    .from("review_replies")
    .select("*")
    .eq("review_id", reviewId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const ids = [...new Set(rows.map((r) => r.user_id))];
  if (ids.length === 0) return rows.map((r) => ({ ...r, author: null }));

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, level")
    .in("id", ids);
  if (profilesError) throw new Error(profilesError.message);
  const byId = new Map((profiles ?? []).map((p) => [p.id, p as ProfileLite]));
  return rows.map((r) => ({ ...r, author: byId.get(r.user_id) ?? null }));
}

export async function addReviewReply(reviewId: string, userId: string, body: string): Promise<ReviewReply> {
  const { data, error } = await supabase
    .from("review_replies")
    .insert({ review_id: reviewId, user_id: userId, body: body.trim() })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteReviewReply(replyId: string): Promise<void> {
  const { error } = await supabase.from("review_replies").delete().eq("id", replyId);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Notifications (Profile > Inbox) - system-populated, see migration; there's
// no client insert path for these, only select/mark-read/delete on your own.
// ---------------------------------------------------------------------------

export type NotificationRow = Notification & { actor: ProfileLite | null; bathroom_id: string | null };

export async function getNotifications(userId: string): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("recipient_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const actorIds = [...new Set(rows.map((r) => r.actor_id).filter((id): id is string => !!id))];
  const reviewIds = [...new Set(rows.map((r) => r.review_id).filter((id): id is string => !!id))];

  const [profilesResult, reviewsResult] = await Promise.all([
    actorIds.length > 0
      ? supabase.from("profiles").select("id, username, display_name, avatar_url, level").in("id", actorIds)
      : Promise.resolve({ data: [], error: null }),
    reviewIds.length > 0
      ? supabase.from("bathroom_reviews").select("id, bathroom_id").in("id", reviewIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (profilesResult.error) throw new Error(profilesResult.error.message);
  if (reviewsResult.error) throw new Error(reviewsResult.error.message);

  const profileById = new Map((profilesResult.data ?? []).map((p) => [p.id, p as ProfileLite]));
  const bathroomIdByReviewId = new Map((reviewsResult.data ?? []).map((r) => [r.id, r.bathroom_id as string]));

  return rows.map((r) => ({
    ...r,
    actor: r.actor_id ? profileById.get(r.actor_id) ?? null : null,
    bathroom_id: r.review_id ? bathroomIdByReviewId.get(r.review_id) ?? null : null,
  }));
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("recipient_id", userId)
    .eq("read", false);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Called on opening the Inbox screen - clears the badge the same way most apps treat "you looked at the list" as "read", rather than tracking per-item taps. */
export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("recipient_id", userId)
    .eq("read", false);
  if (error) throw new Error(error.message);
}
