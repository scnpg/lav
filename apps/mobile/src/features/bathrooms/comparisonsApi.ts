import { supabase } from "../../lib/supabase";

// Thin layer over submit_bathroom_comparison / get_my_ranked_bathroom_ids /
// get_random_comparison_candidate (0039_quick_checks_live_status_and_comparisons.sql).
//
// Backend-only for now: nothing in the app calls these yet. This is the
// pairwise "which was better" personal ranking signal - deliberately not
// wired into any screen in this pass, so it stays entirely invisible to
// users (no prompt, no ranked list, no rating number anywhere) until a
// future pass decides how to surface it.

/** One of the caller's other previously-logged bathrooms, or null if they've only logged this one. */
export async function getRandomComparisonCandidate(excludeBathroomId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_random_comparison_candidate", {
    p_exclude_bathroom_id: excludeBathroomId,
  });
  if (error) throw new Error(error.message);
  return data ?? null;
}

export async function submitBathroomComparison(
  bathroomIdA: string,
  bathroomIdB: string,
  winnerBathroomId: string
): Promise<void> {
  const { error } = await supabase.rpc("submit_bathroom_comparison", {
    p_bathroom_id_a: bathroomIdA,
    p_bathroom_id_b: bathroomIdB,
    p_winner_bathroom_id: winnerBathroomId,
  });
  if (error) throw new Error(error.message);
}

/** Ordinal rank only - the RPC never returns the underlying rating. */
export async function getMyRankedBathroomIds(limit = 200): Promise<{ bathroom_id: string; rank: number }[]> {
  const { data, error } = await supabase.rpc("get_my_ranked_bathroom_ids", { p_limit: limit });
  if (error) throw new Error(error.message);
  return data ?? [];
}
