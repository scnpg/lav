import { supabase } from "./supabase";
import type { Profile } from "../types/database";

export interface ProfileLite {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  level: number;
}

/** Read-only lookup for another user's public profile (cross-profile navigation). */
export async function getPublicProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Uploads a locally-picked photo (expo-image-picker's asset.uri - a file://
 * URI on native, blob:/data: on web) as the caller's avatar and points
 * profiles.avatar_url at it. Fixed filename (not one-per-upload) with
 * upsert: true, so re-uploading just replaces the previous photo instead of
 * accumulating orphaned files in the bucket - there's only ever one current
 * avatar per user, unlike bathroom_photos' full history/moderation lifecycle.
 * See supabase/migrations/0014_onboarding_and_avatars.sql for the bucket +
 * owner-only-write policies this relies on.
 */
export async function uploadAvatar(userId: string, localUri: string): Promise<string> {
  const response = await fetch(localUri);
  const blob = await response.blob();
  const path = `${userId}/avatar.jpg`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, blob, { contentType: "image/jpeg", upsert: true });
  if (uploadError) throw new Error(uploadError.message);

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(path);

  const { error: updateError } = await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", userId);
  if (updateError) throw new Error(updateError.message);

  return publicUrl;
}

/**
 * Batch-fetches lite profile info for a set of user ids and merges it onto
 * each row as `author`. We deliberately do this as a second query instead of
 * a PostgREST embedded select (`profiles(*)`) everywhere a user_id shows up -
 * one shared helper is simpler to reason about than relationship-hint syntax
 * scattered across every query.
 */
export async function attachAuthors<T extends { user_id: string | null }>(
  rows: T[]
): Promise<(T & { author: ProfileLite | null })[]> {
  const ids = [...new Set(rows.map((r) => r.user_id).filter((id): id is string => !!id))];
  if (ids.length === 0) {
    return rows.map((r) => ({ ...r, author: null }));
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, level")
    .in("id", ids);
  if (error) throw new Error(error.message);

  const byId = new Map((data ?? []).map((p) => [p.id, p as ProfileLite]));
  return rows.map((r) => ({ ...r, author: r.user_id ? byId.get(r.user_id) ?? null : null }));
}
