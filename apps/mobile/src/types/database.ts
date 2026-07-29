// Hand-written mirror of the Supabase schema (supabase/migrations). If you'd
// rather generate this from the live database, the Supabase CLI can do it:
//   supabase gen types typescript --local > src/types/database.ts
// Just re-add the AmenitiesMap/OpenHours/enum aliases below afterwards, since
// the generator emits `Json` for jsonb columns instead of these.
import type {
  AccessDifficulty,
  AccessType,
  AmenitiesMap,
  BathroomStatus,
  CostType,
  GenderCategory,
  ModerationStatus,
  OpenHours,
  PhotoStatus,
  ProfileRole,
  ReportStatus,
  ToiletType,
  Visibility,
} from "./enums";

export interface Profile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  role: ProfileRole;
  trust_score: number;
  points: number;
  /** Generated column (see 0020_gamification_points.sql) - always derived from points, never written directly. */
  level: number;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

// Public-safe bathroom shape: every field that's allowed to leave the
// database through get_verified_bathrooms_nearby / search_verified_bathrooms
// or a plain authenticated select against `bathrooms`. Never includes
// private_access_code, submission_latitude, or submission_longitude - those
// are column-revoked in 0006_rls.sql and only readable via
// admin_get_bathroom_private_fields().
export interface BathroomPublic {
  id: string;
  name: string;
  venue_name: string | null;
  description: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  floor: string | null;
  latitude: number;
  longitude: number;
  status: BathroomStatus;
  access_type: AccessType | null;
  purchase_required: boolean;
  purchase_note: string | null;
  access_difficulty: AccessDifficulty | null;
  access_notes: string | null;
  access_code_public_allowed: boolean;
  cost_type: CostType | null;
  cost_amount: number | null;
  gender_category: GenderCategory | null;
  toilet_type: ToiletType | null;
  amenities: AmenitiesMap;
  tags: string[];
  open_hours: OpenHours;
  cleanliness_score: number;
  safety_score: number;
  privacy_score: number;
  smell_score: number;
  prestige_score: number;
  overall_score: number;
  review_count: number;
  photo_count: number;
  submitted_by: string | null;
  verified_by: string | null;
  verified_at: string | null;
  last_verified_at: string | null;
  /** Crowd name-consensus signal (0034_postgis_clustering_and_name_verification.sql) - set by process_bathroom_verification(), never by admin action. Distinct from `status`: this says "5+ people agree on this name", not "an admin confirmed this listing". */
  name_verified: boolean;
  name_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Admin-only fields, fetched separately via admin_get_bathroom_private_fields(). */
export interface BathroomPrivateFields {
  private_access_code: string | null;
  submission_latitude: number | null;
  submission_longitude: number | null;
}

export interface BathroomNearby extends Omit<BathroomPublic, "submitted_by" | "verified_by" | "created_at" | "updated_at"> {
  distance_meters: number;
}

export interface BathroomPhoto {
  id: string;
  bathroom_id: string;
  user_id: string | null;
  storage_path: string;
  public_url: string | null;
  caption: string | null;
  status: PhotoStatus;
  moderation_status: ModerationStatus;
  moderation_provider: string | null;
  moderation_result: Record<string, unknown>;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  is_public: boolean;
  created_at: string;
}

export interface Review {
  id: string;
  bathroom_id: string;
  user_id: string;
  cleanliness: number | null;
  safety: number | null;
  privacy: number | null;
  smell: number | null;
  prestige: number | null;
  overall: number | null;
  caption: string | null;
  visibility: Visibility;
  created_at: string;
  updated_at: string;
}

export interface Checkin {
  id: string;
  bathroom_id: string;
  user_id: string;
  caption: string | null;
  visibility: Visibility;
  created_at: string;
}

export interface SavedBathroom {
  user_id: string;
  bathroom_id: string;
  created_at: string;
}

export interface BathroomList {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  visibility: Visibility;
  is_ranked: boolean;
  cover_photo_url: string | null;
  like_count: number;
  save_count: number;
  created_at: string;
  updated_at: string;
}

export interface BathroomListItem {
  id: string;
  list_id: string;
  bathroom_id: string;
  position: number;
  note: string | null;
  created_at: string;
}

export interface BathroomListLike {
  user_id: string;
  list_id: string;
  created_at: string;
}

export interface SavedBathroomList {
  user_id: string;
  list_id: string;
  created_at: string;
}

export interface Report {
  id: string;
  bathroom_id: string | null;
  review_id: string | null;
  list_id: string | null;
  photo_id: string | null;
  user_id: string | null;
  reason: string | null;
  details: string | null;
  status: ReportStatus;
  created_at: string;
}

export interface ModerationEvent {
  id: string;
  bathroom_id: string | null;
  photo_id: string | null;
  admin_id: string | null;
  action: string;
  notes: string | null;
  created_at: string;
}

// The 0.0-10.0 "Beli for bathrooms" rating engine - see
// supabase/migrations/0016_bathroom_reviews.sql for why this is a separate
// table from the older 1-5 scale `reviews` above.
export interface BathroomReview {
  id: string;
  user_id: string;
  bathroom_id: string;
  overall_rating: number;
  cleanliness_score: number | null;
  smell_score: number | null;
  ambience_score: number | null;
  privacy_score: number | null;
  review_text: string | null;
  /** Proposed description/access-notes update, one vote among all of a bathroom's reviews - see update_bathroom_linguistic_summary() (0035_review_details_and_tabbed_search.sql). Never displayed as-is; only the computed consensus on `bathrooms` is. */
  description: string | null;
  access_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BathroomReviewStats {
  review_count: number;
  avg_overall: number | null;
  avg_cleanliness: number | null;
  avg_smell: number | null;
  avg_ambience: number | null;
  avg_privacy: number | null;
}

export interface BathroomImage {
  id: string;
  bathroom_id: string;
  review_id: string | null;
  user_id: string;
  storage_path: string;
  public_url: string;
  created_at: string;
}

// Crowd-sourced consensus model (0021_consensus_suggestions.sql). field_name
// is 'name' or an AmenityKey (src/types/enums.ts); suggested_value is the
// literal name string, or 'true'/'false' for an amenity flag. No DB-level
// enum constraint on field_name - validated client-side, same convention as
// bathrooms.tags/amenities.
export interface BathroomSuggestion {
  id: string;
  bathroom_id: string;
  user_id: string;
  field_name: string;
  suggested_value: string;
  created_at: string;
  updated_at: string;
}

// One user's vote for a bathroom's name
// (0034_postgis_clustering_and_name_verification.sql). A dedicated table,
// not a reuse of bathroom_suggestions above - that one has no minimum-count/
// consensus-threshold gate and also drives amenity consensus off the same
// trigger, so bolting this feature's >=5-votes/>50%-majority rule onto it
// would change amenity consensus too. unique(bathroom_id, user_id) at the DB
// level means one row per voter; submit again to change your vote (upsert).
export interface BathroomNameSubmission {
  id: string;
  bathroom_id: string;
  user_id: string;
  submitted_name: string;
  created_at: string;
}

// One row per get_clustered_bathrooms() cluster - cluster_id is only unique
// within a single call's result set (recomputed fresh every call for
// whatever bbox was passed), never a stable id to persist across calls.
export interface BathroomClusterMember {
  id: string;
  name: string;
  floor: string | null;
}

export interface BathroomCluster {
  cluster_id: number;
  center_lat: number;
  center_lng: number;
  pin_count: number;
  bathrooms: BathroomClusterMember[];
}

// One row per pair (0023_social_and_submissions.sql) - created by user_id
// as 'requested', flipped to 'accepted' by an UPDATE from friend_id. A
// friendship is "mine" if I'm on either side, so most queries check both
// user_id = me and friend_id = me rather than assuming a direction.
export interface Friendship {
  id: string;
  user_id: string;
  friend_id: string;
  status: "requested" | "accepted";
  created_at: string;
}

// 0038_review_likes_replies_and_notifications.sql - a review's likes/replies,
// no admin gate on either (see that migration's own header comment for which
// two things in this app actually stay gated).
export interface ReviewLike {
  id: string;
  review_id: string;
  user_id: string;
  created_at: string;
}

export interface ReviewReply {
  id: string;
  review_id: string;
  user_id: string;
  body: string;
  created_at: string;
}

// System-populated only (see migration - no client insert policy). type
// determines which of review_id/friendship_id is set: friend_request/
// friend_accept carry friendship_id, review_like/review_reply carry review_id.
export interface Notification {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  type: "friend_request" | "friend_accept" | "review_like" | "review_reply";
  review_id: string | null;
  friendship_id: string | null;
  read: boolean;
  created_at: string;
}

// 0039_quick_checks_live_status_and_comparisons.sql - the Quick Verification
// Sheet's append-only check-in log. Never updated/deleted, only inserted.
export interface BathroomStatusCheck {
  id: string;
  bathroom_id: string;
  user_id: string;
  is_open: boolean;
  is_clean: boolean;
  has_paper: boolean;
  closure_reason: "out_of_order" | "cleaning" | "other" | null;
  line_length: "none" | "short" | "long";
  created_at: string;
}

/** get_bathroom_live_status() RPC result - null when nothing was reported recently. */
export interface BathroomLiveStatus {
  is_open: boolean;
  is_clean: boolean;
  has_paper: boolean;
  closure_reason: "out_of_order" | "cleaning" | "other" | null;
  line_length: "none" | "short" | "long";
  reported_at: string;
  checks_in_window: number;
}

// The moderation queue (0023_social_and_submissions.sql) - separate from the
// existing direct-write paths (submitBathroom/updateBathroomDetails).
// bathroom_id null + name/latitude/longitude set = a brand new pin proposal;
// bathroom_id set = a proposed amendment to that existing bathroom.
export interface BathroomSubmission {
  id: string;
  user_id: string;
  bathroom_id: string | null;
  name: string | null;
  latitude: number | null;
  longitude: number | null;
  details: Record<string, unknown>;
  status: "pending" | "approved" | "rejected";
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// supabase-js Database generic. Relationships is always [] - the app
// doesn't use PostgREST embedded resource expansion (every join here is a
// second explicit query) but postgrest-js's GenericTable type requires the
// field to be present to structurally match, even if empty.
//
// Flatten<T> looks redundant but isn't: createClient<Database>()'s generic
// defaults are several conditional types deep (SchemaName -> Schema ->
// ClientOptions, see node_modules/@supabase/supabase-js SupabaseClient
// type). With TypeScript ~6.0.3 + postgrest-js 2.108.2, passing a *named*
// interface reference straight through as Row/Insert/Update leaves it in a
// deferred form that fails the nested `extends GenericTable` check several
// layers up, silently collapsing the entire Schema default to `never` (every
// table, every column, every RPC arg). Forcing eager evaluation with a
// mapped type fixes it. Verified by isolated repro before/after this change
// - removing Flatten<> reintroduces `never[] | null` from every `.select()`.
// ---------------------------------------------------------------------------
type Flatten<T> = { [K in keyof T]: T[K] };
type TableDef<Row, Insert, Update = Partial<Insert>> = {
  Row: Flatten<Row>;
  Insert: Flatten<Insert>;
  Update: Flatten<Update>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      profiles: TableDef<
        Profile,
        Pick<Profile, "id"> & Partial<Omit<Profile, "id">>
      >;
      bathrooms: TableDef<
        BathroomPublic & BathroomPrivateFields,
        Pick<BathroomPublic, "name" | "latitude" | "longitude"> &
          Partial<Omit<BathroomPublic, "name" | "latitude" | "longitude">> &
          Partial<BathroomPrivateFields>
      >;
      bathroom_photos: TableDef<
        BathroomPhoto,
        Pick<BathroomPhoto, "bathroom_id" | "user_id" | "storage_path"> &
          Partial<Omit<BathroomPhoto, "bathroom_id" | "user_id" | "storage_path">>
      >;
      reviews: TableDef<
        Review,
        Pick<Review, "bathroom_id" | "user_id"> & Partial<Omit<Review, "bathroom_id" | "user_id">>
      >;
      checkins: TableDef<
        Checkin,
        Pick<Checkin, "bathroom_id" | "user_id"> & Partial<Omit<Checkin, "bathroom_id" | "user_id">>
      >;
      saved_bathrooms: TableDef<
        SavedBathroom,
        Pick<SavedBathroom, "user_id" | "bathroom_id"> & Partial<Omit<SavedBathroom, "user_id" | "bathroom_id">>
      >;
      bathroom_lists: TableDef<
        BathroomList,
        Pick<BathroomList, "creator_id" | "title"> & Partial<Omit<BathroomList, "creator_id" | "title">>
      >;
      bathroom_list_items: TableDef<
        BathroomListItem,
        Pick<BathroomListItem, "list_id" | "bathroom_id" | "position"> &
          Partial<Omit<BathroomListItem, "list_id" | "bathroom_id" | "position">>
      >;
      bathroom_list_likes: TableDef<
        BathroomListLike,
        Pick<BathroomListLike, "user_id" | "list_id"> & Partial<Omit<BathroomListLike, "user_id" | "list_id">>
      >;
      saved_bathroom_lists: TableDef<
        SavedBathroomList,
        Pick<SavedBathroomList, "user_id" | "list_id"> & Partial<Omit<SavedBathroomList, "user_id" | "list_id">>
      >;
      reports: TableDef<Report, Partial<Report>>;
      moderation_events: TableDef<
        ModerationEvent,
        Pick<ModerationEvent, "action"> & Partial<Omit<ModerationEvent, "action">>
      >;
      bathroom_reviews: TableDef<
        BathroomReview,
        Pick<BathroomReview, "user_id" | "bathroom_id" | "overall_rating"> &
          Partial<Omit<BathroomReview, "user_id" | "bathroom_id" | "overall_rating">>
      >;
      bathroom_images: TableDef<
        BathroomImage,
        Pick<BathroomImage, "bathroom_id" | "user_id" | "storage_path" | "public_url"> &
          Partial<Omit<BathroomImage, "bathroom_id" | "user_id" | "storage_path" | "public_url">>
      >;
      bathroom_suggestions: TableDef<
        BathroomSuggestion,
        Pick<BathroomSuggestion, "bathroom_id" | "user_id" | "field_name" | "suggested_value"> &
          Partial<Omit<BathroomSuggestion, "bathroom_id" | "user_id" | "field_name" | "suggested_value">>
      >;
      friendships: TableDef<
        Friendship,
        Pick<Friendship, "user_id" | "friend_id"> & Partial<Omit<Friendship, "user_id" | "friend_id">>
      >;
      bathroom_submissions: TableDef<
        BathroomSubmission,
        Pick<BathroomSubmission, "user_id"> & Partial<Omit<BathroomSubmission, "user_id">>
      >;
      bathroom_name_submissions: TableDef<
        BathroomNameSubmission,
        Pick<BathroomNameSubmission, "bathroom_id" | "user_id" | "submitted_name"> &
          Partial<Omit<BathroomNameSubmission, "bathroom_id" | "user_id" | "submitted_name">>
      >;
      review_likes: TableDef<
        ReviewLike,
        Pick<ReviewLike, "review_id" | "user_id"> & Partial<Omit<ReviewLike, "review_id" | "user_id">>
      >;
      review_replies: TableDef<
        ReviewReply,
        Pick<ReviewReply, "review_id" | "user_id" | "body"> & Partial<Omit<ReviewReply, "review_id" | "user_id" | "body">>
      >;
      notifications: TableDef<
        Notification,
        Pick<Notification, "recipient_id" | "type"> & Partial<Omit<Notification, "recipient_id" | "type">>
      >;
      bathroom_status_checks: TableDef<
        BathroomStatusCheck,
        Pick<BathroomStatusCheck, "bathroom_id" | "user_id" | "is_open" | "is_clean" | "has_paper"> &
          Partial<Omit<BathroomStatusCheck, "bathroom_id" | "user_id" | "is_open" | "is_clean" | "has_paper">>
      >;
    };
    Views: Record<string, never>;
    Functions: {
      get_verified_bathrooms_nearby: {
        Args: { lat: number; lng: number; radius_meters?: number };
        Returns: BathroomNearby[];
      };
      search_verified_bathrooms: {
        Args: { search_query: string };
        Returns: Omit<BathroomNearby, "distance_meters">[];
      };
      update_bathroom_scores: {
        Args: { target_bathroom_id: string };
        Returns: void;
      };
      find_nearby_duplicate_bathrooms: {
        Args: { lat: number; lng: number; radius_meters?: number };
        Returns: { id: string; name: string; status: BathroomStatus; distance_meters: number }[];
      };
      admin_get_bathroom_private_fields: {
        Args: { target_bathroom_id: string };
        Returns: BathroomPrivateFields[];
      };
      is_admin: {
        Args: { check_user_id?: string };
        Returns: boolean;
      };
      get_bathroom_review_stats: {
        Args: { target_bathroom_id: string };
        Returns: BathroomReviewStats[];
      };
      get_clustered_bathrooms: {
        Args: {
          min_lat: number;
          max_lat: number;
          min_lng: number;
          max_lng: number;
          cluster_radius_meters?: number;
        };
        Returns: BathroomCluster[];
      };
      resolve_username_to_email: {
        Args: { input_username: string };
        Returns: string;
      };
      get_bathroom_live_status: {
        Args: { target_bathroom_id: string; recency_hours?: number };
        Returns: BathroomLiveStatus[];
      };
      get_bathrooms_recently_closed: {
        Args: { bathroom_ids: string[]; recency_hours?: number };
        Returns: { bathroom_id: string }[];
      };
      submit_bathroom_comparison: {
        Args: { p_bathroom_id_a: string; p_bathroom_id_b: string; p_winner_bathroom_id: string };
        Returns: void;
      };
      get_my_ranked_bathroom_ids: {
        Args: { p_limit?: number };
        Returns: { bathroom_id: string; rank: number }[];
      };
      get_random_comparison_candidate: {
        Args: { p_exclude_bathroom_id: string };
        Returns: string | null;
      };
    };
  };
}
