import { attachAuthors, type ProfileLite } from "../../lib/profiles";
import { supabase } from "../../lib/supabase";
import type { Checkin, Review } from "../../types/database";
import type { Visibility } from "../../types/enums";
import { updateBathroomScores } from "./api";

export type ReviewWithAuthor = Review & { author: ProfileLite | null };
export type CheckinWithAuthor = Checkin & { author: ProfileLite | null };

export async function getReviewsForBathroom(bathroomId: string): Promise<ReviewWithAuthor[]> {
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("bathroom_id", bathroomId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return attachAuthors(data ?? []);
}

export async function getCheckinsForBathroom(bathroomId: string): Promise<CheckinWithAuthor[]> {
  const { data, error } = await supabase
    .from("checkins")
    .select("*")
    .eq("bathroom_id", bathroomId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return attachAuthors(data ?? []);
}

export interface CreateReviewInput {
  bathroom_id: string;
  user_id: string;
  cleanliness?: number | null;
  safety?: number | null;
  privacy?: number | null;
  smell?: number | null;
  prestige?: number | null;
  overall?: number | null;
  caption?: string | null;
  visibility?: Visibility;
}

export async function createReview(input: CreateReviewInput): Promise<Review> {
  const { data, error } = await supabase.from("reviews").insert(input).select("*").single();
  if (error) throw new Error(error.message);
  // TODO(scores): see update_bathroom_scores in supabase/migrations/0005 -
  // MVP recomputes synchronously on every write from the client. Move to a
  // trigger/scheduled job once write volume makes that unreliable.
  await updateBathroomScores(input.bathroom_id);
  return data;
}

export async function deleteReview(id: string, bathroomId: string): Promise<void> {
  const { error } = await supabase.from("reviews").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await updateBathroomScores(bathroomId);
}

export interface CreateCheckinInput {
  bathroom_id: string;
  user_id: string;
  caption?: string | null;
  visibility?: Visibility;
}

// Check-ins are always an explicit user action - this function is only ever
// called from a deliberate "Check in" button tap, never automatically.
export async function createCheckin(input: CreateCheckinInput): Promise<Checkin> {
  const { data, error } = await supabase.from("checkins").insert(input).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteCheckin(id: string): Promise<void> {
  const { error } = await supabase.from("checkins").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
