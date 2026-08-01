import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";

import { BathroomBottomCard } from "../../src/components/map/BathroomBottomCard";
import { FilterChips, type FilterOption } from "../../src/components/map/FilterChips";
import { LocationGroupSheet } from "../../src/components/map/LocationGroupSheet";
import { MapView } from "../../src/components/map/MapView";
import { SearchBar } from "../../src/components/map/SearchBar";
import { SearchResultsDropdown } from "../../src/components/map/SearchResultsDropdown";
import { EditBathroomModal } from "../../src/components/bathroom/EditBathroomModal";
import { RateBathroomModal } from "../../src/components/bathroom/RateBathroomModal";
import { ArabesqueLoader } from "../../src/components/ArabesqueLoader";
import { LavLogo } from "../../src/components/LavLogo";
import { PressableScale } from "../../src/components/PressableScale";
import { getBathroomById, getBathroomsInBounds, type MapBounds } from "../../src/features/bathrooms/api";
import { getBathroomReviewStats } from "../../src/features/bathrooms/ratingsApi";
import { searchBathrooms } from "../../src/features/bathrooms/search";
import { getBathroomsRecentlyClosed } from "../../src/features/bathrooms/statusApi";
import { searchPlaces, type PlaceResult } from "../../src/features/places/search";
import { useLiveLocation } from "../../src/hooks/useLiveLocation";
import { useAuth } from "../../src/lib/auth";
import { loadCachedBathrooms, saveCachedBathrooms } from "../../src/lib/bathroomCache";
import { haversineDistanceMeters } from "../../src/lib/geo";
import { cardShadow, fontSize, fontWeight, radii, spacing, useTheme, useThemedStyles } from "../../src/theme";
import type { BathroomNearby, BathroomPublic, BathroomReview } from "../../src/types/database";


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
  const { t } = useTranslation();
  const { colors, scheme } = useTheme();
  const styles = useThemedStyles((c) => ({
    container: {
      flex: 1,
      backgroundColor: c.background,
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
      position: "absolute" as const,
      bottom: spacing.lg,
      right: spacing.lg,
      width: 44,
      height: 44,
      borderRadius: radii.full,
      backgroundColor: c.surface,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    addButton: {
      position: "absolute" as const,
      bottom: spacing.lg,
      left: spacing.lg,
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 6,
      height: 40,
      paddingHorizontal: spacing.md,
      borderRadius: radii.md,
      backgroundColor: c.accent,
      borderWidth: 2,
      borderColor: c.surface,
    },
    addButtonText: {
      color: c.textOnAccent,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
    },
    overlayBanner: {
      position: "absolute" as const,
      top: spacing.md,
      left: spacing.md,
      right: spacing.md,
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: spacing.sm,
      backgroundColor: c.surface,
      borderRadius: radii.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    errorBanner: {
      backgroundColor: c.dangerMuted,
      justifyContent: "space-between" as const,
    },
    overlayBannerText: {
      color: c.textPrimary,
      fontSize: fontSize.sm,
      flexShrink: 1,
    },
    retryText: {
      color: c.accentStrong,
      fontSize: fontSize.sm,
      fontWeight: "600" as const,
    },
  }));
  const FILTER_OPTIONS: FilterOption[] = useMemo(
    () => [
      { key: "free", label: t("map.filters.free") },
      { key: "wheelchair", label: t("map.filters.wheelchair") },
      { key: "bidet", label: t("map.filters.bidet") },
      { key: "public_only", label: t("map.filters.publicOnly") },
      { key: "emergency", label: t("map.filters.emergency") },
    ],
    [t]
  );
  const [bathrooms, setBathrooms] = useState<BathroomNearby[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showingCachedBathrooms, setShowingCachedBathrooms] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [placeResults, setPlaceResults] = useState<PlaceResult[]>([]);
  const [placesLoading, setPlacesLoading] = useState(false);
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
  // "Nearest open" emergency filter: bathrooms with a recent (within
  // get_bathrooms_recently_closed's default 4h window) report of
  // is_open=false get excluded rather than trusted by default - see
  // filteredByChips below. Refetched whenever the filter is active and the
  // currently-loaded bathroom set changes (new viewport, or first turning
  // the filter on).
  const [recentlyClosedIds, setRecentlyClosedIds] = useState<Set<string>>(new Set());
  // Sequences a one-shot "fly to my location, then auto-select the nearest
  // match" the moment the emergency filter is turned on - consumed (cleared)
  // once a match is selected, so panning away afterward while the filter
  // stays active doesn't keep yanking the selection back.
  const emergencyAutoSelectRef = useRef(false);

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
  const { focusBathroomId, focusLat, focusLng } = useLocalSearchParams<{
    focusBathroomId?: string;
    focusLat?: string;
    focusLng?: string;
  }>();
  const { status: locationStatus, coords: userLocation } = useLiveLocation();

  // Paint something immediately from the last successful viewport fetch
  // (persisted across app restarts) instead of a blank map while the real
  // bounds-based fetch below is still in flight - most valuable on a slow
  // connection, where that first round-trip can take a while. Purely a
  // placeholder: the real fetch (scoped to whatever the map actually
  // reports as its viewport) always wins once it resolves, whether that's
  // success or the same-cache fallback inside loadBathroomsInBounds.
  useEffect(() => {
    let cancelled = false;
    loadCachedBathrooms().then((cached) => {
      if (cancelled || !cached || cached.bathrooms.length === 0) return;
      setBathrooms((prev) => (prev.length > 0 ? prev : cached.bathrooms));
    });
    return () => {
      cancelled = true;
    };
  }, []);

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

  // Same idea as focusBathroomId above, for a place tapped on the new
  // Search tab (see app/(tabs)/search.tsx) - a place has no bathroom row to
  // select, just somewhere to fly the camera to, so this skips straight to
  // setFlyToRequest instead of a fetch-then-select round-trip.
  useEffect(() => {
    if (!focusLat || !focusLng) return;
    router.setParams({ focusLat: undefined, focusLng: undefined });
    const latitude = Number(focusLat);
    const longitude = Number(focusLng);
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) return;
    setSearchText("");
    setActiveFilters(new Set());
    setGroupSheetIds(null);
    setSelectedId(null);
    setFlyToRequest({ latitude, longitude, token: Date.now() });
  }, [focusLat, focusLng, router]);

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
      const withDistance = inView.map((b) => ({ ...b, distance_meters: 0 }));
      setBathrooms(withDistance);
      setShowingCachedBathrooms(false);
      saveCachedBathrooms(withDistance, bounds);
    } catch (err) {
      // Poor/no connectivity: fall back to whatever this viewport last
      // successfully fetched (persisted to AsyncStorage, so it survives an
      // app restart too) rather than leaving the map blank. Only overrides
      // pins already on screen from an earlier successful fetch this
      // session - those stay put either way since nothing here clears them.
      const cached = await loadCachedBathrooms();
      if (cached && cached.bathrooms.length > 0) {
        setBathrooms(cached.bathrooms);
        setShowingCachedBathrooms(true);
      } else {
        setLoadError(err instanceof Error ? err.message : "Couldn't load bathrooms.");
      }
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
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
        if (key === "emergency") {
          if (!userLocation) {
            Alert.alert("Location needed", "Enable location access to find the nearest open restroom.");
            next.delete(key);
          } else {
            emergencyAutoSelectRef.current = true;
            setSelectedId(null);
            setLocateMeToken(Date.now());
          }
        }
      }
      return next;
    });
    setFitBoundsRequest(Date.now());
  }

  // Bulk-refreshes which of the currently-loaded pins have a recent
  // out-of-order/cleaning report, whenever the emergency filter is active.
  useEffect(() => {
    if (!activeFilters.has("emergency") || bathrooms.length === 0) return;
    getBathroomsRecentlyClosed(bathrooms.map((b) => b.id))
      .then(setRecentlyClosedIds)
      .catch(() => setRecentlyClosedIds(new Set()));
  }, [activeFilters, bathrooms]);

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
      if (activeFilters.has("emergency")) {
        if (!bathroom.amenities.wheelchair_accessible) return false;
        if (recentlyClosedIds.has(bathroom.id)) return false;
      }
      return true;
    });
  }, [bathrooms, activeFilters, recentlyClosedIds]);

  const trimmedQuery = searchText.trim();
  const isSearching = trimmedQuery.length > 0;

  // While searching, the dropdown and the map pins show the exact same set -
  // search narrows both at once instead of the dropdown being a separate
  // index into all bathrooms.
  const visibleBathrooms = useMemo(() => {
    return isSearching ? searchBathrooms(filteredByChips, trimmedQuery) : filteredByChips;
  }, [filteredByChips, isSearching, trimmedQuery]);

  // Consumes the one-shot auto-select queued by toggleFilter above, once the
  // camera's move to the user's location has actually brought matching pins
  // into `visibleBathrooms`. Ordered by distance (already computed once
  // userLocation is known - see the effect above) then overall_score as a
  // tiebreaker between two roughly-equidistant options.
  useEffect(() => {
    if (!emergencyAutoSelectRef.current || !activeFilters.has("emergency")) return;
    if (visibleBathrooms.length === 0) return;
    const nearest = [...visibleBathrooms].sort(
      (a, b) => a.distance_meters - b.distance_meters || b.overall_score - a.overall_score
    )[0];
    emergencyAutoSelectRef.current = false;
    if (nearest) selectBathroom(nearest.id);
  }, [visibleBathrooms, activeFilters]);

  // Debounced Nominatim lookup for streets/districts/landmarks/etc - see
  // src/features/places/search.ts. Debounced (not fired per keystroke) both
  // to respect Nominatim's rate-limit guidance and so a fast typist doesn't
  // pile up requests; the AbortController cancels a still-in-flight request
  // if the query changes again before it resolves, so a slow response for an
  // old query can never overwrite results for what's currently typed.
  useEffect(() => {
    if (!isSearching) {
      setPlaceResults([]);
      setPlacesLoading(false);
      return;
    }
    const controller = new AbortController();
    setPlacesLoading(true);
    const timer = setTimeout(() => {
      searchPlaces(trimmedQuery, controller.signal)
        .then((results) => {
          setPlaceResults(results);
          setPlacesLoading(false);
        })
        .catch((err) => {
          if (err instanceof Error && err.name === "AbortError") return;
          setPlaceResults([]);
          setPlacesLoading(false);
        });
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [isSearching, trimmedQuery]);

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

  // Unlike a bathroom result, a place isn't a pin already loaded in
  // `bathrooms` - there's nothing to select, just somewhere to fly the
  // camera to. The viewport-based fetch effect picks up from there once
  // MapView reports the new bounds, the same as panning there by hand would.
  function handleSelectPlace(place: PlaceResult) {
    setSearchText("");
    setSelectedId(null);
    setFlyToRequest({ latitude: place.latitude, longitude: place.longitude, token: Date.now() });
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
  // quiet reconciliation against the real multi-reviewer mean a moment later
  // (bathrooms.overall_score and this RPC are both the mean of
  // overall_rating - see 0022/0037). Neither step touches
  // selectedId/mapBounds/camera state, so this never triggers a refetch of
  // the viewport or a camera move.
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
        <LavLogo size={22} />
        <SearchBar value={searchText} onChangeText={handleSearchTextChange} />
        {isSearching ? (
          <SearchResultsDropdown
            results={visibleBathrooms}
            places={placeResults}
            placesLoading={placesLoading}
            onSelect={handleSelectFromDropdown}
            onSelectPlace={handleSelectPlace}
          />
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
            <Text style={styles.overlayBannerText}>{t("map.zoomToView")}</Text>
          </View>
        ) : loading ? (
          <View style={styles.overlayBanner} pointerEvents="none">
            <ArabesqueLoader size={20} color={colors.accentStrong} />
            <Text style={styles.overlayBannerText}>{t("map.loadingBathrooms")}</Text>
          </View>
        ) : loadError ? (
          <View style={[styles.overlayBanner, styles.errorBanner]}>
            <Text style={styles.overlayBannerText}>{loadError}</Text>
            <Pressable onPress={handleRetry}>
              <Text style={styles.retryText}>{t("common.retry")}</Text>
            </Pressable>
          </View>
        ) : showingCachedBathrooms ? (
          <View style={styles.overlayBanner} pointerEvents="none">
            <Ionicons name="cloud-offline-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.overlayBannerText}>{t("map.showingCached")}</Text>
          </View>
        ) : null}

        <Pressable
          style={[styles.locationButton, cardShadow("md", scheme)]}
          onPress={handleUseMyLocation}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t("map.locateMe")}
        >
          {locationStatus === "requesting" ? (
            <ArabesqueLoader size={18} color={colors.accentStrong} />
          ) : (
            <Ionicons
              name="locate"
              size={20}
              color={locationStatus === "denied" ? colors.textMuted : colors.accentStrong}
            />
          )}
        </Pressable>

        <PressableScale
          style={[styles.addButton, cardShadow("md", scheme)]}
          borderRadius={radii.md}
          onPress={() => {
            setSelectedId(null);
            setGroupSheetIds(null);
            handleOpenAddBathroom();
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t("map.addBathroom")}
        >
          <Ionicons name="add" size={18} color={colors.textOnAccent} />
          <Text style={styles.addButtonText}>{t("map.submitLabel")}</Text>
        </PressableScale>
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
          bathroom={ratingBathroom}
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

