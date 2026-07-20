import { BATHROOM_PUBLIC_COLUMNS } from "../bathrooms/api";
import { supabase } from "../../lib/supabase";
import type { BathroomList, BathroomPublic } from "../../types/database";

// "Custom collections" - a thin frontend layer over the pre-existing
// bathroom_lists / bathroom_list_items tables (see
// supabase/migrations/0019_default_collection_provisioning.sql for why this
// reuses that schema instead of a new parallel one). Every user gets a
// default "My Bathrooms" list the moment their profile is created; anything
// beyond that is created on the fly from the Save to Collection sheet.

/**
 * A user's lists. RLS (bathroom_lists_select_visible) already restricts this
 * to public lists plus whichever ones belong to the caller, so calling this
 * with someone else's id from their public profile naturally returns only
 * their public lists with zero extra filtering here.
 */
export async function getListsForUser(userId: string): Promise<BathroomList[]> {
  const { data, error } = await supabase
    .from("bathroom_lists")
    .select("*")
    .eq("creator_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createList(
  userId: string,
  title: string,
  description: string | null = null,
  isPublic = true
): Promise<BathroomList> {
  const { data, error } = await supabase
    .from("bathroom_lists")
    .insert({
      creator_id: userId,
      title,
      description,
      visibility: isPublic ? "public" : "private",
      is_ranked: false,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getListById(listId: string): Promise<BathroomList | null> {
  const { data, error } = await supabase.from("bathroom_lists").select("*").eq("id", listId).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function getListItems(listId: string): Promise<BathroomPublic[]> {
  const { data: items, error: itemsError } = await supabase
    .from("bathroom_list_items")
    .select("bathroom_id")
    .eq("list_id", listId)
    .order("position", { ascending: true });
  if (itemsError) throw new Error(itemsError.message);
  if (!items || items.length === 0) return [];

  const ids = items.map((row) => row.bathroom_id);
  const { data: bathrooms, error: bathroomsError } = await supabase
    .from("bathrooms")
    .select(BATHROOM_PUBLIC_COLUMNS)
    .in("id", ids);
  if (bathroomsError) throw new Error(bathroomsError.message);

  const byId = new Map((bathrooms ?? []).map((b) => [(b as unknown as BathroomPublic).id, b as unknown as BathroomPublic]));
  return ids.map((id) => byId.get(id)).filter((b): b is BathroomPublic => !!b);
}

/** Which of the user's own lists already contain this bathroom - powers the Save to Collection sheet's checkmarks. */
export async function getListsContainingBathroom(userId: string, bathroomId: string): Promise<Set<string>> {
  const { data: ownLists, error: listsError } = await supabase
    .from("bathroom_lists")
    .select("id")
    .eq("creator_id", userId);
  if (listsError) throw new Error(listsError.message);
  const ownListIds = (ownLists ?? []).map((l) => l.id);
  if (ownListIds.length === 0) return new Set();

  const { data: items, error: itemsError } = await supabase
    .from("bathroom_list_items")
    .select("list_id")
    .eq("bathroom_id", bathroomId)
    .in("list_id", ownListIds);
  if (itemsError) throw new Error(itemsError.message);
  return new Set((items ?? []).map((row) => row.list_id));
}

/** One grouped-count query instead of one per list - powers the item-count shown next to each collection. */
export async function getListItemCounts(listIds: string[]): Promise<Map<string, number>> {
  if (listIds.length === 0) return new Map();
  const { data, error } = await supabase.from("bathroom_list_items").select("list_id").in("list_id", listIds);
  if (error) throw new Error(error.message);
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    counts.set(row.list_id, (counts.get(row.list_id) ?? 0) + 1);
  }
  return counts;
}

async function nextPosition(listId: string): Promise<number> {
  const { count, error } = await supabase
    .from("bathroom_list_items")
    .select("id", { count: "exact", head: true })
    .eq("list_id", listId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function addBathroomToList(listId: string, bathroomId: string): Promise<void> {
  const position = await nextPosition(listId);
  const { error } = await supabase
    .from("bathroom_list_items")
    .insert({ list_id: listId, bathroom_id: bathroomId, position });
  if (error) throw new Error(error.message);
}

export async function removeBathroomFromList(listId: string, bathroomId: string): Promise<void> {
  const { error } = await supabase
    .from("bathroom_list_items")
    .delete()
    .eq("list_id", listId)
    .eq("bathroom_id", bathroomId);
  if (error) throw new Error(error.message);
}

export async function toggleBathroomInList(listId: string, bathroomId: string, currentlyIn: boolean): Promise<boolean> {
  if (currentlyIn) {
    await removeBathroomFromList(listId, bathroomId);
    return false;
  }
  await addBathroomToList(listId, bathroomId);
  return true;
}
