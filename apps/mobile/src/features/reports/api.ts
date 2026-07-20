import { supabase } from "../../lib/supabase";

// Reuses the existing polymorphic `reports` table (bathroom_id/review_id/
// list_id/photo_id, exactly one required) rather than a new bathroom-only
// table - RLS already restricts SELECT to admins + the reporting user, and
// INSERT to the reporting user's own row (see 0002_tables.sql/0006_rls.sql).
export type BathroomReportReason =
  | "Permanently Closed"
  | "Wrong Location"
  | "Duplicate"
  | "Inappropriate Content"
  | "Other";

export interface SubmitBathroomReportInput {
  bathroomId: string;
  userId: string;
  reason: BathroomReportReason;
  description?: string | null;
}

export async function submitBathroomReport(input: SubmitBathroomReportInput): Promise<void> {
  const { error } = await supabase.from("reports").insert({
    bathroom_id: input.bathroomId,
    user_id: input.userId,
    reason: input.reason,
    details: input.description?.trim() || null,
  });
  if (error) throw new Error(error.message);
}
