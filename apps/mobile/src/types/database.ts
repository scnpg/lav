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
    };
  };
}
