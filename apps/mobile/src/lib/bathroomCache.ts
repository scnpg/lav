import AsyncStorage from "@react-native-async-storage/async-storage";

import type { MapBounds } from "../features/bathrooms/api";
import type { BathroomNearby } from "../types/database";

// A tiny "last viewport, offline" cache - not a general offline mode (writes,
// ratings, submissions all still require a live connection), just enough
// that the map isn't a blank screen with an error banner the moment
// connectivity drops. Client-only, same privacy posture as everything else
// here (see README "Security/privacy notes") - this never touches location,
// only the bathroom pins already fetched.
const CACHE_KEY = "lav:cached-bathrooms-v1";
const MAX_CACHED_ROWS = 500;

interface CachedBathrooms {
  bathrooms: BathroomNearby[];
  bounds: MapBounds;
  cachedAt: number;
}

export async function saveCachedBathrooms(bathrooms: BathroomNearby[], bounds: MapBounds): Promise<void> {
  try {
    const payload: CachedBathrooms = { bathrooms: bathrooms.slice(0, MAX_CACHED_ROWS), bounds, cachedAt: Date.now() };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Best-effort - a cache write failing (storage full, etc.) shouldn't
    // interrupt the map itself, which already has its data in memory.
  }
}

export async function loadCachedBathrooms(): Promise<CachedBathrooms | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as CachedBathrooms) : null;
  } catch {
    return null;
  }
}
