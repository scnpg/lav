import { supabase } from "../../lib/supabase";
import type { BathroomSubmission } from "../../types/database";
import type { AccessType, AmenitiesMap } from "../../types/enums";

// The moderation queue (0023_social_and_submissions.sql) - deliberately
// separate from submitBathroom()/updateBathroomDetails() in
// features/bathrooms/api.ts, which still write straight to `bathrooms` (a
// new pin at status='pending', or a fillable-field edit on an existing row).
// This is the "propose and wait for a human" path: nothing here ever
// touches `bathrooms` directly - an admin actions the row later.
//
// `details` is a free-form jsonb bag (see 0023) - this module is the only
// writer, so it's the one place that has to agree with itself on its shape:
// amenities/access_type/photo_urls, all optional since a submission might
// only touch one of them (e.g. an amendment that's just "add a photo").

export interface SubmissionDetails {
  amenities?: AmenitiesMap;
  access_type?: AccessType | null;
  photo_urls?: string[];
  [key: string]: unknown;
}

export interface NewPinSubmissionInput {
  userId: string;
  name: string;
  latitude: number;
  longitude: number;
  amenities?: AmenitiesMap;
  accessType?: AccessType | null;
  photoUrls?: string[];
}

export async function submitNewBathroom(input: NewPinSubmissionInput): Promise<BathroomSubmission> {
  const details: SubmissionDetails = {
    amenities: input.amenities ?? {},
    access_type: input.accessType ?? null,
    photo_urls: input.photoUrls ?? [],
  };
  const { data, error } = await supabase
    .from("bathroom_submissions")
    .insert({
      user_id: input.userId,
      bathroom_id: null,
      name: input.name,
      latitude: input.latitude,
      longitude: input.longitude,
      details,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export interface BathroomAmendmentInput {
  userId: string;
  bathroomId: string;
  name?: string;
  amenities?: AmenitiesMap;
  accessType?: AccessType | null;
  photoUrls?: string[];
}

export async function submitBathroomAmendment(input: BathroomAmendmentInput): Promise<BathroomSubmission> {
  const details: SubmissionDetails = {
    amenities: input.amenities ?? {},
    access_type: input.accessType,
    photo_urls: input.photoUrls ?? [],
  };
  const { data, error } = await supabase
    .from("bathroom_submissions")
    .insert({
      user_id: input.userId,
      bathroom_id: input.bathroomId,
      name: input.name ?? null,
      details,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Reuses the bathroom_photos bucket (0017_bathroom_images.sql) - its RLS
 * only checks that the first path segment is the uploader's own id, so a
 * submission-scoped filename (no real bathroom_id to key off yet) fits the
 * same policy without a new bucket or migration. Deliberately does NOT
 * insert into bathroom_images: that table backs the live detail screen's
 * carousel, and a submission's photos shouldn't be publicly attached to a
 * bathroom until an admin approves it - the URL just rides along in
 * `details.photo_urls` until then.
 */
export async function uploadSubmissionPhoto(userId: string, localUri: string): Promise<string> {
  const response = await fetch(localUri);
  const blob = await response.blob();
  const path = `${userId}/submission-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from("bathroom_photos")
    .upload(path, blob, { contentType: "image/jpeg" });
  if (uploadError) throw new Error(uploadError.message);

  const {
    data: { publicUrl },
  } = supabase.storage.from("bathroom_photos").getPublicUrl(path);
  return publicUrl;
}

export async function getMySubmissions(userId: string): Promise<BathroomSubmission[]> {
  const { data, error } = await supabase
    .from("bathroom_submissions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}
