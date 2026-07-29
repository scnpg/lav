import { supabase } from "../../lib/supabase";
import type { BathroomLiveStatus } from "../../types/database";

// Thin layer over bathroom_status_checks / get_bathroom_live_status /
// get_bathrooms_recently_closed (0039_quick_checks_live_status_and_comparisons.sql).
// Powers the Quick Verification Sheet and the map's "Nearest Open" filter.

export interface SubmitQuickCheckInput {
  bathroom_id: string;
  user_id: string;
  is_open: boolean;
  is_clean: boolean;
  has_paper: boolean;
  closure_reason?: "out_of_order" | "cleaning" | "other" | null;
  line_length?: "none" | "short" | "long";
}

export async function submitQuickCheck(input: SubmitQuickCheckInput): Promise<void> {
  const { error } = await supabase.from("bathroom_status_checks").insert({
    bathroom_id: input.bathroom_id,
    user_id: input.user_id,
    is_open: input.is_open,
    is_clean: input.is_clean,
    has_paper: input.has_paper,
    closure_reason: input.is_open ? null : (input.closure_reason ?? "other"),
    line_length: input.line_length ?? "none",
  });
  if (error) throw new Error(error.message);
}

/** Null if nothing has been reported for this bathroom within the recency window. */
export async function getBathroomLiveStatus(
  bathroomId: string,
  recencyHours = 4
): Promise<BathroomLiveStatus | null> {
  const { data, error } = await supabase.rpc("get_bathroom_live_status", {
    target_bathroom_id: bathroomId,
    recency_hours: recencyHours,
  });
  if (error) throw new Error(error.message);
  return data?.[0] ?? null;
}

/** Of the given bathroom ids, which have a recent report of is_open = false. */
export async function getBathroomsRecentlyClosed(bathroomIds: string[], recencyHours = 4): Promise<Set<string>> {
  if (bathroomIds.length === 0) return new Set();
  const { data, error } = await supabase.rpc("get_bathrooms_recently_closed", {
    bathroom_ids: bathroomIds,
    recency_hours: recencyHours,
  });
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((row: { bathroom_id: string }) => row.bathroom_id));
}
