import { supabase } from "./supabase";

export interface ProfileLite {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
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
    .select("id, username, display_name, avatar_url")
    .in("id", ids);
  if (error) throw new Error(error.message);

  const byId = new Map((data ?? []).map((p) => [p.id, p as ProfileLite]));
  return rows.map((r) => ({ ...r, author: r.user_id ? byId.get(r.user_id) ?? null : null }));
}
