import type {
  AccessDifficulty,
  AccessType,
  BathroomStatus,
  CostType,
  GenderCategory,
  ModerationStatus,
  ToiletType,
} from "../types/enums";

// These labels are the *entire* public-facing description of how access
// works for a bathroom. None of them ever reveal an actual code - see
// bathrooms.private_access_code in supabase/migrations and the "Important
// access-code rule" in README. If you add a new AccessType, add its label
// here as a short instruction a stranger could act on, never the secret itself.
export const ACCESS_TYPE_LABELS: Record<AccessType, string> = {
  public: "Open to the public",
  customer_only: "Customers only",
  purchase_required: "Purchase required",
  receipt_code: "Code on receipt",
  ask_staff: "Ask staff",
  key_required: "Key required",
  code_required: "Code required",
  employee_only: "Employees only",
  ticket_required: "Ticket required",
  hotel_guest_only: "Hotel guests only",
  event_only: "Event access only",
  private_rare: "Private / members only",
  unknown: "Access unknown",
};

export const ACCESS_DIFFICULTY_LABELS: Record<AccessDifficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  nearly_impossible: "Nearly impossible",
  invite_only: "Invite only",
  unknown: "Unknown",
};

export const COST_TYPE_LABELS: Record<CostType, string> = {
  free: "Free",
  purchase_required: "Purchase required",
  paid: "Paid",
  unknown: "Cost unknown",
};

export const GENDER_CATEGORY_LABELS: Record<GenderCategory, string> = {
  male: "Male",
  female: "Female",
  all_gender: "All gender",
  family: "Family",
  accessible: "Accessible",
  unknown: "Unknown",
};

export const TOILET_TYPE_LABELS: Record<ToiletType, string> = {
  sitting: "Sitting toilet",
  squat: "Squat toilet",
  bidet: "Bidet",
  urinal_only: "Urinal only",
  mixed: "Mixed",
  unknown: "Unknown",
};

export const BATHROOM_STATUS_LABELS: Record<BathroomStatus, string> = {
  pending: "Pending review",
  verified: "Verified",
  rejected: "Rejected",
  duplicate: "Duplicate",
  hidden: "Hidden",
};

export const MODERATION_STATUS_LABELS: Record<ModerationStatus, string> = {
  pending_scan: "Waiting on scan",
  scan_passed: "Scan passed",
  scan_failed: "Scan failed",
  needs_human_review: "Needs human review",
  approved: "Approved",
  rejected: "Rejected",
};
