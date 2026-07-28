import type { ProfileLite } from "../../lib/profiles";
import { supabase } from "../../lib/supabase";
import type { Friendship } from "../../types/database";

// Thin layer over friendships (0023_social_and_submissions.sql). One row per
// pair: user_id is always the original requester, friend_id the recipient,
// status flips from 'requested' to 'accepted' via an UPDATE (RLS restricts
// that UPDATE to friend_id = auth.uid() - only the person asked can accept).
// A friendship is "mine" if I'm on either side, so lookups check both.

export type FriendshipState = "none" | "outgoing" | "incoming" | "friends";

/** Every accepted friend, on either side of the pair. */
export async function getFriends(userId: string): Promise<ProfileLite[]> {
  const { data, error } = await supabase
    .from("friendships")
    .select("user_id, friend_id")
    .eq("status", "accepted")
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`);
  if (error) throw new Error(error.message);

  const otherIds = (data ?? []).map((f) => (f.user_id === userId ? f.friend_id : f.user_id));
  if (otherIds.length === 0) return [];

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, level")
    .in("id", otherIds);
  if (profilesError) throw new Error(profilesError.message);
  return profiles ?? [];
}

/** Just the ids - the shape the Friends feed query needs for its `.in("user_id", ...)` filter. */
export async function getFriendIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("friendships")
    .select("user_id, friend_id")
    .eq("status", "accepted")
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`);
  if (error) throw new Error(error.message);
  return (data ?? []).map((f) => (f.user_id === userId ? f.friend_id : f.user_id));
}

/** Requests sitting in my inbox, awaiting my accept. */
export async function getIncomingRequests(userId: string): Promise<(Friendship & { requester: ProfileLite | null })[]> {
  const { data, error } = await supabase
    .from("friendships")
    .select("*")
    .eq("friend_id", userId)
    .eq("status", "requested");
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  if (rows.length === 0) return [];

  const requesterIds = [...new Set(rows.map((r) => r.user_id))];
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, level")
    .in("id", requesterIds);
  if (profilesError) throw new Error(profilesError.message);
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  return rows.map((r) => ({ ...r, requester: byId.get(r.user_id) ?? null }));
}

/** Requests I've sent that are still awaiting the other person - the Requests screen's "Sent" section. */
export async function getOutgoingRequests(userId: string): Promise<(Friendship & { recipient: ProfileLite | null })[]> {
  const { data, error } = await supabase
    .from("friendships")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "requested");
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  if (rows.length === 0) return [];

  const recipientIds = [...new Set(rows.map((r) => r.friend_id))];
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, level")
    .in("id", recipientIds);
  if (profilesError) throw new Error(profilesError.message);
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  return rows.map((r) => ({ ...r, recipient: byId.get(r.friend_id) ?? null }));
}

/** How userId and otherUserId relate, from userId's point of view - drives the button shown on a public profile. */
export async function getFriendshipState(userId: string, otherUserId: string): Promise<FriendshipState> {
  const { data, error } = await supabase
    .from("friendships")
    .select("user_id, friend_id, status")
    .or(`and(user_id.eq.${userId},friend_id.eq.${otherUserId}),and(user_id.eq.${otherUserId},friend_id.eq.${userId})`)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return "none";
  if (data.status === "accepted") return "friends";
  return data.user_id === userId ? "outgoing" : "incoming";
}

export async function sendFriendRequest(userId: string, friendId: string): Promise<void> {
  const { error } = await supabase.from("friendships").insert({ user_id: userId, friend_id: friendId });
  if (error) throw new Error(error.message);
}

export async function acceptFriendRequest(userId: string, requesterId: string): Promise<void> {
  const { error } = await supabase
    .from("friendships")
    .update({ status: "accepted" })
    .eq("user_id", requesterId)
    .eq("friend_id", userId);
  if (error) throw new Error(error.message);
}

/** Unfriend, withdraw a sent request, or decline a received one - all the same delete, just from different sides. */
export async function removeFriendship(userId: string, otherUserId: string): Promise<void> {
  const { error } = await supabase
    .from("friendships")
    .delete()
    .or(`and(user_id.eq.${userId},friend_id.eq.${otherUserId}),and(user_id.eq.${otherUserId},friend_id.eq.${userId})`);
  if (error) throw new Error(error.message);
}
