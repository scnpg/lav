import { supabase } from "../../lib/supabase";
import type { BathroomNameSubmission } from "../../types/database";

// Crowdsourced name-verification voting
// (0034_postgis_clustering_and_name_verification.sql). Every insert/update
// here is just casting or changing one vote - process_bathroom_verification()
// on the database side (fired by a trigger, not called from here) is what
// counts votes, checks the >=5/>50% threshold, and updates bathrooms.name +
// name_verified. Deliberately separate from src/features/submissions/api.ts
// (the admin-approved new-pin/amendment queue) - this is a lighter-weight,
// fully automatic path with no human review step.

/**
 * Casts or changes the caller's vote for what bathroomId should be named.
 * Upserts on (bathroom_id, user_id) - the DB's unique constraint means one
 * vote per user per bathroom, so submitting again just updates it (the
 * consensus trigger re-fires on that update too, but repeat voting doesn't
 * re-award the +5 gamification points - see award_points_on_name_submission
 * in the migration, which only fires on INSERT).
 */
export async function submitBathroomNameSuggestion(
  bathroomId: string,
  userId: string,
  submittedName: string
): Promise<BathroomNameSubmission> {
  const { data, error } = await supabase
    .from("bathroom_name_submissions")
    .upsert(
      { bathroom_id: bathroomId, user_id: userId, submitted_name: submittedName.trim() },
      { onConflict: "bathroom_id,user_id" }
    )
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/** Every live vote for a bathroom - e.g. to show "3 of 5 votes needed" progress in the UI. */
export async function getBathroomNameSubmissions(bathroomId: string): Promise<BathroomNameSubmission[]> {
  const { data, error } = await supabase
    .from("bathroom_name_submissions")
    .select("*")
    .eq("bathroom_id", bathroomId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}
