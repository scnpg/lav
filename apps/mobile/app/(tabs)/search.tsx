import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ArabesqueLoader } from "../../src/components/ArabesqueLoader";
import { FloralBloom } from "../../src/components/ArabesquePattern";
import { LavLogo } from "../../src/components/LavLogo";
import { LevelBadge } from "../../src/components/LevelBadge";
import { SearchBar } from "../../src/components/map/SearchBar";
import { searchBathroomsByText } from "../../src/features/bathrooms/api";
import { searchPlaces, type PlaceResult } from "../../src/features/places/search";
import { useLiveLocation } from "../../src/hooks/useLiveLocation";
import { useAuth } from "../../src/lib/auth";
import { formatDistance, formatScore } from "../../src/lib/format";
import { searchUsers, type ProfileLite } from "../../src/lib/profiles";
import { cardShadow, colors, fontSize, fontWeight, radii, spacing } from "../../src/theme";
import type { BathroomNearby } from "../../src/types/database";

const PLACE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  train: "train-outline",
  street: "trail-sign-outline",
  hotel: "bed-outline",
  store: "storefront-outline",
  landmark: "flag-outline",
  neighborhood: "map-outline",
  district: "map-outline",
  place: "location-outline",
};

type SearchTab = "people" | "bathrooms" | "locations";

const TABS: { key: SearchTab; label: string }[] = [
  { key: "people", label: "People" },
  { key: "bathrooms", label: "Bathrooms" },
  { key: "locations", label: "Locations" },
];

// One search bar, three parallel sources - other users (profiles, by
// username/display name), bathrooms (search_verified_bathrooms - a global
// text search, unlike the Map screen's own searchBathrooms() which only
// filters whatever's currently loaded into its viewport), and locations
// (Nominatim, same free OSM geocoder the Map and Submit screens already use -
// covers streets/landmarks/businesses/neighborhoods, not just bathrooms).
// Results are tabbed rather than stacked so a query that matches all three
// (e.g. someone's username that's also a place name) doesn't turn into one
// long scroll - the tab bar's counts tell you where to look before you switch.
// Replaces the old Submit tab slot - submitting a new bathroom is still
// reachable via the map's FAB and a bathroom's "Suggest edit" action, just no
// longer has its own tab shortcut.
export default function SearchScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { coords: userLocation } = useLiveLocation();

  const [query, setQuery] = useState("");
  const trimmedQuery = query.trim();
  const isSearching = trimmedQuery.length > 0;
  const [activeTab, setActiveTab] = useState<SearchTab>("bathrooms");

  const [users, setUsers] = useState<ProfileLite[]>([]);
  const [places, setPlaces] = useState<PlaceResult[]>([]);
  const [bathrooms, setBathrooms] = useState<BathroomNearby[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounced (people/bathrooms are local DB round-trips, locations is a
  // third-party geocoder with its own rate-limit ask - see
  // src/features/places/search.ts) and cancellable, same pattern already
  // proven on the Map and Submit screens' own search bars.
  useEffect(() => {
    if (!isSearching) {
      setUsers([]);
      setPlaces([]);
      setBathrooms([]);
      setLoading(false);
      setError(null);
      return;
    }
    const controller = new AbortController();
    let cancelled = false;
    setLoading(true);
    setError(null);
    const timer = setTimeout(() => {
      Promise.all([
        searchUsers(trimmedQuery, user?.id).catch(() => [] as ProfileLite[]),
        searchPlaces(trimmedQuery, controller.signal).catch((err) => {
          if (err instanceof Error && err.name === "AbortError") throw err;
          return [] as PlaceResult[];
        }),
        searchBathroomsByText(trimmedQuery, userLocation).catch(() => [] as BathroomNearby[]),
      ])
        .then(([userResults, placeResults, bathroomResults]) => {
          if (cancelled) return;
          setUsers(userResults);
          setPlaces(placeResults);
          setBathrooms(bathroomResults);
        })
        .catch((err) => {
          if (cancelled || (err instanceof Error && err.name === "AbortError")) return;
          setError("Couldn't search right now.");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [isSearching, trimmedQuery, user?.id, userLocation]);

  function handleSelectUser(id: string) {
    router.push(`/profile/${id}`);
  }

  function handleSelectBathroom(id: string) {
    router.push(`/bathrooms/${id}`);
  }

  // No bathroom/profile to open for a location - flies the Map tab there
  // instead, same "somewhere to look," not "something to open" distinction
  // the Map screen's own place search already draws (see its
  // handleSelectPlace comment). Mirrors the existing focusBathroomId
  // cross-tab pattern (app/(tabs)/index.tsx) with its own param pair.
  function handleSelectPlace(place: PlaceResult) {
    router.push({
      pathname: "/",
      params: { focusLat: String(place.latitude), focusLng: String(place.longitude) },
    });
  }

  const hasAnyResults = users.length > 0 || places.length > 0 || bathrooms.length > 0;
  const activeCount = activeTab === "people" ? users.length : activeTab === "bathrooms" ? bathrooms.length : places.length;

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <LavLogo size={22} />
      </View>
      <View style={styles.searchArea}>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search bathrooms, people, or places..." />
      </View>

      {!isSearching ? (
        <View style={styles.emptyState}>
          <FloralBloom size={40} color={colors.borderStrong} />
          <Text style={styles.emptyText}>Search for a bathroom, another user, or a street or landmark.</Text>
        </View>
      ) : loading && !hasAnyResults ? (
        <View style={styles.loadingBlock}>
          <ArabesqueLoader size={32} color={colors.accentStrong} />
        </View>
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : !hasAnyResults ? (
        <Text style={styles.emptyText}>No results for &quot;{trimmedQuery}&quot;.</Text>
      ) : (
        <>
          <View style={styles.tabRow}>
            {TABS.map((tab) => {
              const count = tab.key === "people" ? users.length : tab.key === "bathrooms" ? bathrooms.length : places.length;
              const isActive = activeTab === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  style={[styles.tab, isActive && styles.tabActive]}
                  onPress={() => setActiveTab(tab.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  accessibilityLabel={`${tab.label}, ${count} results`}
                >
                  <Text style={[styles.tabText, isActive && styles.tabTextActive]} numberOfLines={1}>
                    {tab.label}
                    {count > 0 ? ` (${count})` : ""}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <ScrollView contentContainerStyle={styles.resultsContent} keyboardShouldPersistTaps="handled">
            {activeCount === 0 ? (
              <Text style={styles.emptyText}>No {TABS.find((t) => t.key === activeTab)?.label.toLowerCase()} found.</Text>
            ) : activeTab === "people" ? (
              users.map((u) => (
                <Pressable
                  key={u.id}
                  style={[styles.row, cardShadow("sm")]}
                  onPress={() => handleSelectUser(u.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`View ${u.display_name || u.username}'s profile`}
                >
                  <View style={styles.avatar}>
                    {u.avatar_url ? (
                      <Image source={{ uri: u.avatar_url }} style={styles.avatarImage} />
                    ) : (
                      <Text style={styles.avatarInitial}>
                        {(u.display_name || u.username || "?").charAt(0).toUpperCase()}
                      </Text>
                    )}
                  </View>
                  <View style={styles.rowMain}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {u.display_name || u.username}
                    </Text>
                    <Text style={styles.rowSubtitle} numberOfLines={1}>
                      {[u.username ? `@${u.username}` : null, u.bio].filter(Boolean).join(" · ") || "No bio yet"}
                    </Text>
                  </View>
                  <LevelBadge level={u.level} />
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </Pressable>
              ))
            ) : activeTab === "bathrooms" ? (
              bathrooms.map((b) => (
                <Pressable
                  key={b.id}
                  style={[styles.row, cardShadow("sm")]}
                  onPress={() => handleSelectBathroom(b.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${b.name}, rated ${formatScore(b.overall_score)}`}
                >
                  <View style={styles.rowMain}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {b.name}
                    </Text>
                    <Text style={styles.rowSubtitle} numberOfLines={1}>
                      {[b.venue_name ?? b.city, userLocation ? formatDistance(b.distance_meters) : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                  </View>
                  <View style={styles.scoreBadge}>
                    <Ionicons name="star" size={12} color={colors.gold} />
                    <Text style={styles.scoreText}>{formatScore(b.overall_score)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </Pressable>
              ))
            ) : (
              places.map((place) => (
                <Pressable
                  key={place.id}
                  style={[styles.row, cardShadow("sm")]}
                  onPress={() => handleSelectPlace(place)}
                  accessibilityRole="button"
                  accessibilityLabel={`${place.label}, ${place.sublabel}`}
                  accessibilityHint="Recenters the map on this location"
                >
                  <Ionicons
                    name={PLACE_ICONS[place.category] ?? PLACE_ICONS.place}
                    size={20}
                    color={colors.accentStrong}
                  />
                  <View style={styles.rowMain}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {place.label}
                    </Text>
                    {place.sublabel ? (
                      <Text style={styles.rowSubtitle} numberOfLines={1}>
                        {place.sublabel}
                      </Text>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </Pressable>
              ))
            )}
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  searchArea: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    paddingHorizontal: spacing["2xl"],
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.xl,
  },
  errorText: {
    fontSize: fontSize.sm,
    color: colors.danger,
    textAlign: "center",
    marginTop: spacing.xl,
  },
  loadingBlock: {
    alignItems: "center",
    paddingTop: spacing["3xl"],
  },
  tabRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  tabText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.textOnAccent,
  },
  resultsContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing["2xl"],
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
  },
  rowName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  rowSubtitle: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: colors.accentMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
  },
  avatarInitial: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.accentStrong,
  },
  scoreBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.goldMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  scoreText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
});
