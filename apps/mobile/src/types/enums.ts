// Mirrors the check constraints in supabase/migrations/0002_tables.sql.
// Keep these in sync with the SQL - they're the single source of truth for
// every <select>/filter chip in the app.

export const ACCESS_TYPES = [
  "public",
  "customer_only",
  "purchase_required",
  "receipt_code",
  "ask_staff",
  "key_required",
  "code_required",
  "employee_only",
  "ticket_required",
  "hotel_guest_only",
  "event_only",
  "private_rare",
  "unknown",
] as const;
export type AccessType = (typeof ACCESS_TYPES)[number];

export const ACCESS_DIFFICULTIES = ["easy", "medium", "hard", "nearly_impossible", "invite_only", "unknown"] as const;
export type AccessDifficulty = (typeof ACCESS_DIFFICULTIES)[number];

export const COST_TYPES = ["free", "purchase_required", "paid", "unknown"] as const;
export type CostType = (typeof COST_TYPES)[number];

export const GENDER_CATEGORIES = ["male", "female", "all_gender", "family", "accessible", "unknown"] as const;
export type GenderCategory = (typeof GENDER_CATEGORIES)[number];

export const TOILET_TYPES = ["sitting", "squat", "bidet", "urinal_only", "mixed", "unknown"] as const;
export type ToiletType = (typeof TOILET_TYPES)[number];

export const BATHROOM_STATUSES = ["pending", "verified", "rejected", "duplicate", "hidden"] as const;
export type BathroomStatus = (typeof BATHROOM_STATUSES)[number];

export const PHOTO_STATUSES = ["pending", "approved", "rejected"] as const;
export type PhotoStatus = (typeof PHOTO_STATUSES)[number];

export const MODERATION_STATUSES = [
  "pending_scan",
  "scan_passed",
  "scan_failed",
  "needs_human_review",
  "approved",
  "rejected",
] as const;
export type ModerationStatus = (typeof MODERATION_STATUSES)[number];

export const VISIBILITIES = ["public", "friends", "private"] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const REPORT_STATUSES = ["open", "reviewed", "resolved", "dismissed"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const PROFILE_ROLES = ["user", "admin"] as const;
export type ProfileRole = (typeof PROFILE_ROLES)[number];

export const AMENITY_KEYS = [
  "paper_towels",
  "hand_dryer",
  "toilet_paper",
  "tampons",
  "pads",
  "soap",
  "bidet",
  "baby_changing",
  "wheelchair_accessible",
  "gender_neutral",
  "mirror",
  "outlet",
  "sharps_disposal",
  "coat_hook",
  "full_length_mirror",
  "touchless_sink",
  "touchless_flush",
] as const;
export type AmenityKey = (typeof AMENITY_KEYS)[number];
export type AmenitiesMap = Partial<Record<AmenityKey, boolean>>;

export const VIBE_TAGS = [
  "luxury",
  "cursed",
  "clean",
  "sketchy",
  "elite",
  "hidden_gem",
  "campus",
  "hotel",
  "event_only",
  "corporate",
  "airport",
  "mall",
  "restaurant",
  "emergency_save",
  "outfit_check",
  "bidet",
  "no_line",
  "private_rare",
] as const;
export type VibeTag = (typeof VIBE_TAGS)[number];

export interface OpenHours {
  is_24_hours?: boolean;
  open?: string;
  close?: string;
  notes?: string;
  [key: string]: unknown;
}
