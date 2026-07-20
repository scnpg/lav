import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BathroomBottomCard } from "../../src/components/map/BathroomBottomCard";
import { FilterChips, type FilterOption } from "../../src/components/map/FilterChips";
import { LocationGroupSheet } from "../../src/components/map/LocationGroupSheet";
import { MapView } from "../../src/components/map/MapView";
import { SearchBar } from "../../src/components/map/SearchBar";
import { SearchResultsDropdown } from "../../src/components/map/SearchResultsDropdown";
import { EditBathroomModal } from "../../src/components/bathroom/EditBathroomModal";
import { RateBathroomModal } from "../../src/components/bathroom/RateBathroomModal";
import { getBathroomById, getBathroomsInBounds, type MapBounds } from "../../src/features/bathrooms/api";
import { getBathroomReviewStats } from "../../src/features/bathrooms/ratingsApi";
import { searchBathrooms } from "../../src/features/bathrooms/search";
import { useLiveLocation } from "../../src/hooks/useLiveLocation";
import { useAuth } from "../../src/lib/auth";
import { haversineDistanceMeters } from "../../src/lib/geo";
import { cardShadow, colors, fontSize, radii, spacing } from "../../src/theme";
import type { BathroomNearby, BathroomPublic, BathroomReview } from "../../src/types/database";

const FILTER_OPTIONS: FilterOption[] = [
  { key: "free", label: "Free" },
  { key: "wheelchair", label: "Wheelchair accessible" },
  { key: "bidet", label: "Bidet" },
  { key: "public_only", label: "Public only" },
];

// Roughly "wider than a city" - 1 degree of latitude is ~111km/69mi
// everywhere, and 1 degree of longitude is at most that (less away from the
// equator), so a viewport spanning more than this in either direction is
// already state/country/global scale. At 349k+ bathrooms worldwide, a
// viewport that wide can match tens of thousands of rows - fetching (or
// clustering) that on every pan/zoom is exactly what was causing the lag.
const MAX_FETCH_SPAN_DEGREES = 1;

function isViewportTooWide(bounds: MapBounds): boolean {
  const latSpan = bounds.north - bounds.south;
  const lngSpan = bounds.west <= bounds.east ? bounds.east - bounds.west : 360 - bounds.west + bounds.east;
  return latSpan > MAX_FETCH_SPAN_DEGREES || lngSpan > MAX_FETCH_SPAN_DEGREES;
}

export default function MapScreen() {
  const [bathrooms, setBathrooms] = useState<BathroomNearby[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ id: string; token: number } | null>(null);
  const [locateMeToken, setLocateMeToken] = useState<number | null>(null);
  // Phase 4 micro-grouping: set when a pin representing multiple bathrooms
  // at one exact coordinate is tapped. Takes over the bottom-overlay slot
  // instead of BathroomBottomCard while open - see the render below.
  const [groupSheetIds, setGroupSheetIds] = useState<string[] | null>(null);
  // Bumped only on an intentional query change (typing, toggling a filter
  // chip) - never as a side effect of clearing the search box after
  // selecting a result, otherwise that clear would refit the camera to
  // everything currently loaded and cancel the focusRequest flyTo below.
  // See MapView's fitBoundsRequest prop comment.
  const [fitBoundsRequest, setFitBoundsRequest] = useState<number | null>(null);
  // The map's current visible region, reported by MapView on the initial
  // viewport and after every pan/zoom settles. `bathrooms` is always just
  // "whatever's in this box" - see loadBathroomsInBounds below for why the
  // old "fetch every verified bathroom" approach doesn't work anymore.
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);
  // True when the viewport is wider than MAX_FETCH_SPAN_DEGREES - fetching
  // is skipped entirely at that scale (see the mapBounds effect below) and
  // the "zoom in" banner takes over the loading/error banner slot.
  const [tooZoomedOut, setTooZoomedOut] = useState(false);
  // Phase 1/2 crowdsourcing: which bathroom (if any) is open in the "fill in
  // missing data" form, and whether the "Add New Bathroom" form is open.
  // Both are separate from selectedId/groupSheetIds below so opening one
  // doesn't fight the map's own selection state.
  const [editingBathroom, setEditingBathroom] = useState<BathroomNearby | null>(null);
  const [ratingBathroom, setRatingBathroom] = useState<BathroomNearby | null>(null);

  const [flyToRequest, setFlyToRequest] = useState<{
    latitude: number;
    longitude: number;
    token: number;
  } | null>(null);
  // Set once a Lists-tab focus target's coordinate is known, cleared once
  // it actually shows up in `bathrooms` (see the effect below) - kept
  // separate from selectedId specifically so it does NOT pause the
  // bounds-fetch effect above (selectedId being set is what pauses that,
  // to avoid a card getting yanked out from under someone already looking
  // at it - here we're waiting for the opposite: the fetch that will
  // actually bring this bathroom in).
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);

  const { user } = useAuth();
  const router = useRouter();
  const { focusBathroomId } = useLocalSearchParams<{ focusBathroomId?: string }>();
  const { status: locationStatus, coords: userLocation } = useLiveLocation();

  // Jumps the camera to a bathroom tapped on the Lists tab (see
  // app/(tabs)/lists.tsx) - fetches its coordinate directly rather than
  // relying on it already being in the current viewport's `bathrooms`
  // (unlike focusRequest below, which only works for a bathroom already
  // loaded). Clears any active search/filters first so a chip like
  // "wheelchair accessible" can't hide the very bathroom being focused.
  useEffect(() => {
    if (!focusBathroomId) return;
    let cancelled = false;
    getBathroomById(focusBathroomId).then((bathroom) => {
      if (cancelled) return;
      // Clearing the param re-triggers this effect (focusBathroomId is a
      // dependency) - only doing that now, after the fetch already
      // resolved, not before. Clearing it synchronously up front used to
      // cause React to run this same run's cleanup (cancelled = true)
      // before the fetch had a chance to finish, silently dropping every
      // focus request.
      router.setParams({ focusBathroomId: undefined });
      if (!bathroom) return;
      setSearchText("");
      setActiveFilters(new Set());
      setGroupSheetIds(null);
      setSelectedId(null);
      setFlyToRequest({ latitude: bathroom.latitude, longitude: bathroom.longitude, token: Date.now() });
      setPendingFocusId(bathroom.id);
    });
    return () => {
      cancelled = true;
    };
  }, [focusBathroomId, router]);

  // Once the bounds-fetch triggered by the flyTo above actually brings the
  // target bathroom into `bathrooms`, select it so its card opens - can't
  // do this in the effect above since the bathroom isn't loaded yet at that
  // point. Gives up after a while rather than waiting forever if it never
  // comes back in a fetch (e.g. a very dense area past the 300-row cap -
  // see getBathroomsInBounds).
  useEffect(() => {
    if (!pendingFocusId) return;
    if (bathrooms.some((b) => b.id === pendingFocusId)) {
      setSelectedId(pendingFocusId);
      setPendingFocusId(null);
      return;
    }
    const timeout = setTimeout(() => setPendingFocusId(null), 8000);
    return () => clearTimeout(timeout);
  }, [pendingFocusId, bathrooms]);

  // Auto-centers the camera on the user's position exactly once, the first
  // time a GPS fix comes in after app load - reuses the same locateMeToken
  // mechanism as tapping the "Locate Me" button. Deliberately a ref, not
  // state: useLiveLocation keeps updating userLocation as the user moves,
  // and re-centering on every one of those updates would yank the map back
  // under someone who's deliberately panned away to look at another area.
  const hasAutoCenteredRef = useRef(false);
  useEffect(() => {
    if (userLocation && !hasAutoCenteredRef.current) {
      hasAutoCenteredRef.current = true;
      setLocateMeToken(Date.now());
    }
  }, [userLocation]);

  // With 350k+ bathrooms imported (OpenStreetMap, worldwide), fetching
  // everything on load the way earlier phases did would ship the entire
  // table to every client on every app open. Instead this re-queries only
  // the current viewport every time MapView reports a new one - so
  // `bathrooms` (and therefore search/filter/clustering, all of which just
  // read this same state) only ever covers what's on screen right now, not
  // the whole database.
  const loadBathroomsInBounds = useCallback(async (bounds: MapBounds) => {
    setLoading(true);
    setLoadError(null);
    try {
      const inView = await getBathroomsInBounds(bounds);
      setBathrooms(inView.map((b) => ({ ...b, distance_meters: 0 })));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Couldn't load bathrooms.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!mapBounds) return;

    // Pause entirely while a bathroom or location-group is focused. A
    // fetch mid-focus can drop the very row the user has open - its
    // coordinate may fall outside the freshly-queried viewport - which
    // instantly closes the card/sheet out from under them and reads as the
    // map "spazzing out". Resumes with whatever bounds are current once
    // they close it (selectedId/groupSheetIds below are dependencies, so
    // closing either re-runs this effect even if mapBounds didn't change
    // while paused).
    if (selectedId || groupSheetIds) return;

    if (isViewportTooWide(mapBounds)) {
      setTooZoomedOut(true);
      setLoading(false);
      setLoadError(null);
      setBathrooms([]); // clear stale pins from before the user zoomed out
      return;
    }
    setTooZoomedOut(false);

    // Debounced so a fast pan/zoom settling into several quick stops
    // (inertial scrolling routinely fires a few "moveend"s in quick
    // succession) triggers one fetch - and one supercluster rebuild - for
    // the final position, not one per intermediate stop.
    const timer = setTimeout(() => loadBathroomsInBounds(mapBounds), 300);
    return () => clearTimeout(timer);
  }, [mapBounds, loadBathroomsInBounds, selectedId, groupSheetIds]);

  function handleRegionChangeComplete(bounds: MapBounds) {
    setMapBounds(bounds);
  }

  function handleRetry() {
    if (mapBounds && !isViewportTooWide(mapBounds)) loadBathroomsInBounds(mapBounds);
  }

  // Once we have a live position (Phase 2), every bathroom's distance_meters
  // becomes real instead of the 0 stub - this is what search.ts's
  // proximity-first sort actually sorts by, so search results only get
  // properly distance-ranked after location comes in.
  useEffect(() => {
    if (!userLocation) return;
    setBathrooms((prev) =>
      prev.map((b) => ({ ...b, distance_meters: haversineDistanceMeters(userLocation, b) }))
    );
  }, [userLocation]);

  function toggleFilter(key: string) {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setFitBoundsRequest(Date.now());
  }

  function handleSearchTextChange(text: string) {
    setSearchText(text);
    setFitBoundsRequest(Date.now());
  }

  const filteredByChips = useMemo(() => {
    return bathrooms.filter((bathroom) => {
      if (activeFilters.has("free") && bathroom.cost_type !== "free") return false;
      if (activeFilters.has("wheelchair") && !bathroom.amenities.wheelchair_accessible) return false;
      if (activeFilters.has("bidet") && bathroom.toilet_type !== "bidet" && !bathroom.tags.includes("bidet")) {
        return false;
      }
      if (activeFilters.has("public_only") && bathroom.access_type !== "public") return false;
      return true;
    });
  }, [bathrooms, activeFilters]);

  const trimmedQuery = searchText.trim();
  const isSearching = trimmedQuery.length > 0;

  // While searching, the dropdown and the map pins show the exact same set -
  // search narrows both at once instead of the dropdown being a separate
  // index into all bathrooms.
  const visibleBathrooms = useMemo(() => {
    return isSearching ? searchBathrooms(filteredByChips, trimmedQuery) : filteredByChips;
  }, [filteredByChips, isSearching, trimmedQuery]);

  const selectedBathroom = visibleBathrooms.find((b) => b.id === selectedId) ?? null;
  const groupSheetBathrooms = groupSheetIds
    ? visibleBathrooms.filter((b) => groupSheetIds.includes(b.id))
    : [];

  function selectBathroom(id: string) {
    setSelectedId(id);
    setFocusRequest({ id, token: Date.now() });
  }

  function handleSelectFromDropdown(id: string) {
    selectBathroom(id);
    setSearchText("");
  }

  function handleSelectFromGroup(id: string) {
    selectBathroom(id);
    setGroupSheetIds(null);
  }

  function handleUseMyLocation() {
    if (locationStatus === "denied") {
      Alert.alert(
        "Location access is off",
        "Enable location permission for Lav in your device settings to see your position on the map."
      );
      return;
    }
    if (locationStatus === "error") {
      Alert.alert("Couldn't get your location", "Please try again in a moment.");
      return;
    }
    if (!userLocation) return; // still requesting/waiting on a first fix
    setLocateMeToken(Date.now());
  }

  // The wizard (app/bathrooms/submit.tsx) picks its own starting point (GPS
  // fix, falling back to a default center) and lets the user drag the map
  // to fine-tune from there, so the FAB doesn't need to capture a coordinate
  // itself the way the old AddBathroomModal sheet did.
  //
  // Signed-out is handled separately from "not ready yet": the FAB stays
  // tappable and sends a logged-out tap to sign-in (a stale/expired session
  // can land here even though every screen normally requires sign-in - see
  // src/lib/auth.tsx's loadProfile) rather than just sitting there greyed
  // out with no explanation.
  function handleOpenAddBathroom() {
    if (!user) {
      router.push("/auth/sign-in");
      return;
    }
    router.push("/bathrooms/submit");
  }

  function handleBathroomUpdated(updated: BathroomPublic) {
    setBathrooms((prev) => prev.map((b) => (b.id === updated.id ? { ...b, ...updated } : b)));
  }

  // Rate & Log submits straight to bathroom_reviews - it never touches
  // bathrooms.overall_score itself, so without this the pin/card score was
  // stuck at whatever it loaded with until the next viewport refetch. Two
  // steps: an instant optimistic bump to the just-submitted score (so the
  // badge updates the moment the sheet closes, no round-trip wait), then a
  // quiet reconciliation against the real multi-reviewer average a moment
  // later. Neither step touches selectedId/mapBounds/camera state, so this
  // never triggers a refetch of the viewport or a camera move.
  function handleReviewSaved(bathroomId: string, review: BathroomReview) {
    setBathrooms((prev) => prev.map((b) => (b.id === bathroomId ? { ...b, overall_score: review.overall_rating } : b)));
    getBathroomReviewStats(bathroomId).then((stats) => {
      if (stats.avg_overall === null) return;
      setBathrooms((prev) =>
        prev.map((b) => (b.id === bathroomId ? { ...b, overall_score: stats.avg_overall! } : b))
      );
    });
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.topControls}>
        <SearchBar value={searchText} onChangeText={handleSearchTextChange} />
        {isSearching ? (
          <SearchResultsDropdown results={visibleBathrooms} onSelect={handleSelectFromDropdown} />
        ) : (
          <View style={styles.filtersRow}>
            <FilterChips options={FILTER_OPTIONS} activeKeys={activeFilters} onToggle={toggleFilter} />
          </View>
        )}
      </View>

      <View style={styles.mapArea}>
        <MapView
          bathrooms={visibleBathrooms}
          selectedId={selectedId}
          onSelectPin={(id) => {
            setGroupSheetIds(null);
            setSelectedId(id);
          }}
          onSelectGroup={(ids) => {
            setSelectedId(null);
            setGroupSheetIds(ids);
          }}
          onPressBackground={() => setSelectedId(null)}
          onRegionChangeComplete={handleRegionChangeComplete}
          focusRequest={focusRequest}
          userLocation={userLocation}
          locateMeToken={locateMeToken}
          fitBoundsRequest={fitBoundsRequest}
          flyToRequest={flyToRequest}
        />

        {tooZoomedOut ? (
          <View style={styles.overlayBanner} pointerEvents="none">
            <Ionicons name="search-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.overlayBannerText}>Zoom in to view restrooms</Text>
          </View>
        ) : loading ? (
          <View style={styles.overlayBanner} pointerEvents="none">
            <ActivityIndicator color={colors.accentStrong} />
            <Text style={styles.overlayBannerText}>Loading bathrooms...</Text>
          </View>
        ) : loadError ? (
          <View style={[styles.overlayBanner, styles.errorBanner]}>
            <Text style={styles.overlayBannerText}>{loadError}</Text>
            <Pressable onPress={handleRetry}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        <Pressable
          style={[styles.locationButton, cardShadow("md")]}
          onPress={handleUseMyLocation}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Center map on my location"
        >
          {locationStatus === "requesting" ? (
            <ActivityIndicator size="small" color={colors.accentStrong} />
          ) : (
            <Ionicons
              name="locate"
              size={20}
              color={locationStatus === "denied" ? colors.textMuted : colors.accentStrong}
            />
          )}
        </Pressable>

        <Pressable
          style={[styles.addButton, cardShadow("md")]}
          onPress={() => {
            setSelectedId(null);
            setGroupSheetIds(null);
            handleOpenAddBathroom();
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Add a new bathroom"
        >
          <Ionicons name="add" size={26} color={colors.textOnAccent} />
        </Pressable>
      </View>

      {groupSheetIds ? (
        <LocationGroupSheet
          bathrooms={groupSheetBathrooms}
          onSelectBathroom={handleSelectFromGroup}
          onClose={() => setGroupSheetIds(null)}
        />
      ) : editingBathroom ? (
        <EditBathroomModal
          bathroom={editingBathroom}
          onClose={() => setEditingBathroom(null)}
          onSaved={handleBathroomUpdated}
        />
      ) : ratingBathroom ? (
        <RateBathroomModal
          bathroomId={ratingBathroom.id}
          bathroomName={ratingBathroom.name}
          onClose={() => setRatingBathroom(null)}
          onSaved={(review) => handleReviewSaved(ratingBathroom.id, review)}
        />
      ) : selectedBathroom ? (
        <BathroomBottomCard
          bathroom={selectedBathroom}
          onClose={() => setSelectedId(null)}
          onEditPress={() => setEditingBathroom(selectedBathroom)}
          onRatePress={() => setRatingBathroom(selectedBathroom)}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topControls: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  filtersRow: {
    marginBottom: spacing.xs,
  },
  mapArea: {
    flex: 1,
    marginTop: spacing.sm,
  },
  locationButton: {
    position: "absolute",
    bottom: spacing.lg,
    right: spacing.lg,
    width: 44,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  addButton: {
    position: "absolute",
    bottom: spacing.lg,
    left: spacing.lg,
    width: 52,
    height: 52,
    borderRadius: radii.full,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  overlayBanner: {
    position: "absolute",
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  errorBanner: {
    backgroundColor: colors.dangerMuted,
    justifyContent: "space-between",
  },
  overlayBannerText: {
    color: colors.textPrimary,
    fontSize: fontSize.sm,
    flexShrink: 1,
  },
  retryText: {
    color: colors.accentStrong,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
});
