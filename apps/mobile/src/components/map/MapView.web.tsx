import { useCallback, useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LngLatBounds, Marker, MapLibreMap, NavigationControl, setRTLTextPlugin } from "maplibre-gl";
import Supercluster from "supercluster";

import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, IS_USING_FALLBACK_MAP_STYLE, MAP_STYLE_URL } from "../../lib/mapStyle";
import { applyLavMapTheme } from "../../lib/mapTheme";
import { PIN, pinFill } from "../../lib/pinColor";
import { colors, fontSize, fontWeight, radii } from "../../theme";
import type { BathroomNearby, VenueWithStats } from "../../types/database";

interface MapViewProps {
  // The map's own pin-rendering data source - one point per physical
  // building (see 0042_venues.sql/get_venues_in_bounds), already
  // deduplicated server-side. `bathrooms` is kept separately, purely for
  // focusRequest/fitBoundsRequest coordinate lookups (search selection,
  // filter-driven refit) - it is NOT what pins are drawn from anymore.
  venues: VenueWithStats[];
  bathrooms: BathroomNearby[];
  selectedId: string | null;
  onSelectPin: (id: string) => void;
  onPressBackground?: () => void;
  // Bumping `token` (even for the same `id`) re-triggers the camera flyTo -
  // e.g. from a search dropdown selection. Plain pin taps don't need this,
  // the pin is already on screen.
  focusRequest?: { id: string; token: number } | null;
  // Live position from useLiveLocation (Phase 2) - null until permission is
  // granted and a first fix comes in. Rendered as a dot, separate from the
  // bathroom pins/clusters above.
  userLocation?: { latitude: number; longitude: number } | null;
  // Bumping this token (the "Locate Me" button) flies the camera to
  // userLocation - same token-bump pattern as focusRequest.
  locateMeToken?: number | null;
  // Bumping this token fits the camera to the current `bathrooms` set - the
  // parent bumps it on an intentional query change (typing a search, toggling
  // a filter chip, the initial load), never as a side effect of clearing the
  // search box after a selection. Keeping this decoupled from "bathrooms
  // changed" is what stops a stray refit from cancelling a focusRequest flyTo.
  fitBoundsRequest?: number | null;
  // Called instead of onSelectPin when a tapped venue pin has more than one
  // restroom (restroom_count > 1, e.g. every floor inside one mall) - the
  // parent fetches that venue's restrooms (getBathroomsByVenueId) and opens
  // a sheet/modal listing them.
  onSelectVenue?: (venueId: string) => void;
  // Called once the map settles after any pan/zoom (and once for the
  // initial viewport) with the current visible bounds. The dataset is too
  // large to fetch in full (350k+ imported bathrooms), so the parent uses
  // this to re-query only what's on screen instead. Inline shape (not an
  // exported type) so it doesn't need to survive the .native/.web platform
  // split - MapView.native.tsx re-exports MockMapView, which declares the
  // same shape independently rather than importing it from here.
  onRegionChangeComplete?: (bounds: { west: number; south: number; east: number; north: number }) => void;
  // Same token-bump pattern as locateMeToken, but for an arbitrary
  // coordinate instead of the user's own position - e.g. the Lists tab
  // jumping the map to a saved bathroom that may be well outside the
  // current viewport (unlike focusRequest, which only works for a bathroom
  // already present in the loaded `bathrooms` array).
  flyToRequest?: { latitude: number; longitude: number; token: number } | null;
}

// One point per venue (building) - venues are already deduplicated
// server-side (get_venues_in_bounds), so no client-side coordinate grouping
// is needed the way the old per-bathroom rendering required. restroomCount >
// 1 means this venue has more than one restroom (e.g. every floor inside one
// mall) and renders as a group badge instead of a plain score pin. score is
// the venue's max_overall_score - undefined when none of its restrooms are
// rated yet (an unrated pin). singleBathroomId mirrors
// VenueWithStats.single_bathroom_id - the restroom to navigate straight to
// when restroomCount === 1.
interface ClusterPointProps {
  venueId: string;
  restroomCount: number;
  singleBathroomId: string | null;
  score?: number;
}

// What supercluster aggregates a leaf's properties into when several points
// merge into one spatial cluster (via the `map`/`reduce` options below) -
// tracks a running sum/count of only the RATED leaves so a cluster's average
// score never gets dragged down by unrated bathrooms mixed in.
interface ClusterAggProps {
  scoreSum: number;
  ratedCount: number;
}

const MAPLIBRE_CSS_HREF = "https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.css";

// maplibre-gl ships its CSS as a separate file; Metro's web bundler isn't
// guaranteed to resolve a static `import "maplibre-gl/dist/maplibre-gl.css"`
// the way a webpack/vite app would, so we inject the stylesheet ourselves -
// same CDN build/version as the JS we import, loaded once per page.
function ensureMaplibreCss() {
  if (document.getElementById("maplibre-gl-css")) return;
  const link = document.createElement("link");
  link.id = "maplibre-gl-css";
  link.rel = "stylesheet";
  link.href = MAPLIBRE_CSS_HREF;
  document.head.appendChild(link);
}

// Bug fix: Arabic/Hebrew base-map labels were rendering backward and with
// disconnected letterforms (each character shaped in isolation instead of
// joined) - this is complex-text-layout shaping that MapLibre GL JS (like
// Mapbox GL JS, which it's forked from) doesn't do on its own. It only
// appears once real RTL-script places are in view - which now happens
// whenever the world-zoom fit (computeBounds, below) spans a region with
// Arabic/Hebrew place names, not just NYC/Taipei. setRTLTextPlugin loads the
// official shaping plugin; it must be called before any Map is constructed.
//
// IMPORTANT: maplibre-gl only allows this to be called once per page and
// throws "setRTLTextPlugin cannot be called multiple times" on a second
// call - and a duplicate call doesn't just log-and-continue, it appears to
// leave maplibre-gl's internal plugin-status state broken badly enough that
// every subsequent style never finishes loading (map.loaded() stays false
// forever, confirmed while testing this fix). A plain module-level `let`
// guard isn't reliable protection: Metro Fast Refresh re-evaluates this
// module (resetting the `let` back to false) without maplibre-gl's own
// internal one-time guard resetting, so the very next remount would call it
// again and wedge the map. Guarding on `window` instead survives Fast
// Refresh of this file (only a real page navigation resets it, which is
// exactly when maplibre-gl's internal state also resets) - and the whole
// call is wrapped so an unexpected duplicate-call error is swallowed
// silently instead of risking the broken-map-forever failure mode above.
function ensureRTLTextPlugin() {
  const w = window as unknown as { __lavRTLPluginRequested?: boolean };
  if (w.__lavRTLPluginRequested) return;
  w.__lavRTLPluginRequested = true;
  try {
    setRTLTextPlugin(
      "https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.3.0/dist/mapbox-gl-rtl-text.js",
      true // lazy: only fetched the first time a style actually needs RTL shaping
    ).catch((err) => {
      console.warn("Failed to load the RTL text plugin - Arabic/Hebrew map labels may render incorrectly.", err);
    });
  } catch (err) {
    console.warn("setRTLTextPlugin threw synchronously - skipping.", err);
  }
}

// Single-bathroom marker - a plain circle colored by the shared score
// gradient (pinFill, see lib/pinColor.ts) with the score itself as its
// label. Reverted to this original, simpler shape after a taller pill+icon
// version was implicated in a pin-positioning bug on zoom (per explicit
// user request) - keeps the score color, drops the extra visual layers.
// Unrated (no reviews yet) gets a white/hairline-border/em-dash treatment
// instead of a score color.
function createPinElement(): HTMLDivElement {
  const el = document.createElement("div");
  el.style.width = "32px";
  el.style.height = "32px";
  el.style.borderRadius = "999px";
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  el.style.fontSize = "11px";
  el.style.fontWeight = "700";
  el.style.cursor = "pointer";
  updatePinElement(el, undefined);
  return el;
}

// Refreshes a pin's score-dependent look in place (fill/border/label)
// without rebuilding its DOM structure - called on every render for the
// leaf (single-bathroom) case, since a bathroom's score can change between
// fetches (a new rating coming in) even when its marker element is reused.
function updatePinElement(el: HTMLDivElement, score: number | undefined) {
  const unrated = score === undefined;
  el.style.backgroundColor = unrated ? PIN.unratedFill : pinFill(score);
  el.style.border = unrated ? `1px solid ${PIN.unratedBorder}` : "2px solid rgba(37, 40, 36, 0.15)";
  el.style.color = unrated ? PIN.unratedText : "#FFFFFF";
  el.textContent = unrated ? "—" : score.toFixed(1);
}

// Selection is shown as an accent ring around whatever fill the pin already
// has (score color, or the white/hairline unrated look) - never by
// overriding the fill itself, since the fill's whole purpose is to
// communicate score at a glance.
function applySelectedStyle(el: HTMLDivElement, isSelected: boolean) {
  el.style.boxShadow = isSelected
    ? `0 0 0 3px ${colors.accentStrong}, 0 2px 4px rgba(37, 40, 36, 0.25)`
    : "0 2px 4px rgba(37, 40, 36, 0.25)";
}

// Cluster bubbles - a plain circle sized by point_count, colored by the
// cluster's average score (mean of only its rated members) instead of a
// flat accent fill, so "several bathrooms" reads on the same green-to-red
// scale as a single one.
function createClusterElement(count: number, avgScore: number | undefined): HTMLDivElement {
  const size = count >= 100 ? 64 : count >= 25 ? 52 : 40;
  const unrated = avgScore === undefined;
  const el = document.createElement("div");
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.borderRadius = "999px";
  el.style.backgroundColor = unrated ? PIN.unratedFill : pinFill(avgScore);
  el.style.border = unrated ? `1px solid ${PIN.unratedBorder}` : "2px solid rgba(37, 40, 36, 0.15)";
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  el.style.fontSize = size >= 64 ? "16px" : size >= 52 ? "14px" : "12px";
  el.style.fontWeight = "700";
  el.style.color = unrated ? PIN.unratedText : "#FFFFFF";
  el.style.cursor = "pointer";
  el.style.boxShadow = "0 2px 6px rgba(37, 40, 36, 0.3)";
  el.textContent = count >= 1000 ? `${Math.round(count / 100) / 10}k` : String(count);
  return el;
}

// Phase 4 micro-grouping: a rounded-square badge (not a circle) so it's
// visually distinct at a glance from both the circular individual pin and
// the larger circular cluster bubble - "several bathrooms stacked at one
// spot" reads differently from either "one bathroom" or "a cluster of
// nearby-but-distinct locations". Same avg-score coloring as everything else.
function createGroupPinElement(count: number, avgScore: number | undefined): HTMLDivElement {
  const unrated = avgScore === undefined;
  const el = document.createElement("div");
  el.style.width = "34px";
  el.style.height = "34px";
  el.style.borderRadius = "10px";
  el.style.backgroundColor = unrated ? PIN.unratedFill : pinFill(avgScore);
  el.style.border = unrated ? `1px solid ${PIN.unratedBorder}` : "2px solid rgba(37, 40, 36, 0.15)";
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  el.style.fontSize = "13px";
  el.style.fontWeight = "700";
  el.style.color = unrated ? PIN.unratedText : "#FFFFFF";
  el.style.cursor = "pointer";
  el.style.boxShadow = "0 2px 4px rgba(37, 40, 36, 0.25)";
  el.textContent = `×${count}`;
  return el;
}

// A plain min/max longitude bounding box breaks once points span more than
// half the globe east-west (exactly Lav's NYC + Taipei launch cities: -74
// and 121.5 degrees) - naive min/max treats that as a ~195deg box the "long
// way" through Europe/Asia, centering the camera on Central Asia.
//
// The fix is NOT "build a west > east box and let fitBounds figure out it
// wraps" - tried that first, and confirmed by direct testing that MapLibre's
// fitBounds resolves a west > east box inconsistently (it centered on the
// Pacific in some runs and on Turkey - the naive long-way midpoint - in
// others, same input, no code change between runs). Instead: find the
// largest circular gap between longitudes (the empty region, e.g. the
// Pacific for NYC+Taipei), then shift every point on the "wrapped" side of
// that gap by +360 degrees so the whole set becomes one contiguous,
// non-wrapping range - e.g. Taipei stays ~121, NYC's -74 becomes ~286, both
// west of east numerically, no ambiguity for fitBounds to mis-resolve.
function computeBounds(points: { latitude: number; longitude: number }[]): LngLatBounds {
  const south = Math.min(...points.map((p) => p.latitude));
  const north = Math.max(...points.map((p) => p.latitude));

  const lngs = [...new Set(points.map((p) => p.longitude))].sort((a, b) => a - b);
  if (lngs.length === 1) {
    return new LngLatBounds([lngs[0]!, south], [lngs[0]!, north]);
  }

  let largestGap = -Infinity;
  let gapStartIndex = 0;
  for (let i = 0; i < lngs.length; i++) {
    const next = lngs[(i + 1) % lngs.length]!;
    const gap = i === lngs.length - 1 ? 360 - lngs[i]! + next : next - lngs[i]!;
    if (gap > largestGap) {
      largestGap = gap;
      gapStartIndex = i;
    }
  }

  const west = lngs[(gapStartIndex + 1) % lngs.length]!;
  const normalizedLngs = lngs.map((lng) => (lng >= west ? lng : lng + 360));
  const east = Math.max(...normalizedLngs);
  return new LngLatBounds([west, south], [east, north]);
}

// A white ring + teal fill + soft halo - the standard "you are here" dot
// convention, deliberately distinct from the cream/sky bathroom pins and
// teal cluster bubbles above so it reads as a different kind of marker.
function createUserLocationElement(): HTMLDivElement {
  const el = document.createElement("div");
  el.style.width = "18px";
  el.style.height = "18px";
  el.style.borderRadius = "999px";
  el.style.backgroundColor = colors.accentStrong;
  el.style.border = "3px solid #FFFFFF";
  el.style.boxShadow = `0 0 0 4px ${colors.accentMuted}, 0 2px 6px rgba(37, 40, 36, 0.35)`;
  el.style.pointerEvents = "none";
  return el;
}

function isClusterFeature(
  feature: Supercluster.ClusterFeature<ClusterAggProps> | Supercluster.PointFeature<ClusterPointProps>
): feature is Supercluster.ClusterFeature<ClusterAggProps> {
  return (feature.properties as { cluster?: boolean }).cluster === true;
}

// Real, interactive MapLibre GL JS map for web only - see MapView.native.tsx
// for the native (iOS/Android) counterpart, which still renders the mock
// map layout until real native MapLibre is wired up.
export function MapView({
  venues,
  bathrooms,
  selectedId,
  onSelectPin,
  onPressBackground,
  focusRequest,
  userLocation,
  locateMeToken,
  fitBoundsRequest,
  onSelectVenue,
  onRegionChangeComplete,
  flyToRequest,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<globalThis.Map<string, Marker>>(new globalThis.Map());
  const clusterIndexRef = useRef<Supercluster<ClusterPointProps, ClusterAggProps> | null>(null);
  const userLocationMarkerRef = useRef<Marker | null>(null);
  // The rounded zoom level the currently loaded `venues`/clusterIndexRef was
  // fetched/clustered for - see the moveend handler below for why this
  // exists.
  const lastRenderedZoomRef = useRef<number | null>(null);
  const onSelectPinRef = useRef(onSelectPin);
  const onPressBackgroundRef = useRef(onPressBackground);
  const onSelectVenueRef = useRef(onSelectVenue);
  const onRegionChangeCompleteRef = useRef(onRegionChangeComplete);
  onSelectPinRef.current = onSelectPin;
  onPressBackgroundRef.current = onPressBackground;
  onSelectVenueRef.current = onSelectVenue;
  onRegionChangeCompleteRef.current = onRegionChangeComplete;

  // Reads the current viewport and reports it upward - called once the
  // initial map settles and again after every pan/zoom (see "moveend"
  // below). Kept separate from renderClusters (which re-lays-out markers
  // from whatever data is already loaded) since this is what triggers an
  // actual server round-trip for the new viewport's data.
  const reportRegion = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const b = map.getBounds();
    onRegionChangeCompleteRef.current?.({
      west: b.getWest(),
      south: b.getSouth(),
      east: b.getEast(),
      north: b.getNorth(),
    });
  }, []);

  // Re-reads the current map viewport, asks supercluster for clusters/leaves
  // in it, and diffs markers against what's already on the map. Called on
  // every camera move (pan/zoom) so clusters split/merge as you zoom, and
  // whenever the underlying bathroom list or index changes.
  const renderClusters = useCallback(() => {
    const map = mapRef.current;
    const index = clusterIndexRef.current;
    if (!map || !index) return;

    const bounds = map.getBounds();
    const bbox: [number, number, number, number] = [
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth(),
    ];
    const zoom = Math.round(map.getZoom());
    const features = index.getClusters(bbox, zoom);

    const seenKeys = new Set<string>();

    for (const feature of features) {
      const [longitude, latitude] = feature.geometry.coordinates;

      if (isClusterFeature(feature)) {
        const clusterId = feature.properties.cluster_id;
        const count = feature.properties.point_count;
        const avgScore = feature.properties.ratedCount > 0 ? feature.properties.scoreSum / feature.properties.ratedCount : undefined;
        const key = `cluster:${clusterId}`;
        seenKeys.add(key);

        let marker = markersRef.current.get(key);
        if (!marker) {
          const el = createClusterElement(count, avgScore);
          el.addEventListener("click", (event) => {
            event.stopPropagation();
            const expansionZoom = Math.min(index.getClusterExpansionZoom(clusterId), 20);
            map.easeTo({ center: [longitude, latitude], zoom: expansionZoom, duration: 400 });
          });
          marker = new Marker({ element: el }).setLngLat([longitude, latitude]).addTo(map);
          markersRef.current.set(key, marker);
        } else {
          marker.setLngLat([longitude, latitude]);
        }
      } else if (feature.properties.restroomCount > 1) {
        // A multi-restroom venue (e.g. every floor inside one mall) renders
        // as a group badge, same visual as the old exact-coordinate
        // micro-group case - "several restrooms stacked at one spot" reads
        // differently from either a single pin or a spatial cluster. Keyed
        // on venueId, stable across re-renders.
        const { venueId, restroomCount, score } = feature.properties;
        const key = `venue-group:${venueId}`;
        seenKeys.add(key);

        let marker = markersRef.current.get(key);
        if (!marker) {
          const el = createGroupPinElement(restroomCount, score);
          el.addEventListener("click", (event) => {
            event.stopPropagation();
            onSelectVenueRef.current?.(venueId);
          });
          marker = new Marker({ element: el }).setLngLat([longitude, latitude]).addTo(map);
          markersRef.current.set(key, marker);
        } else {
          marker.setLngLat([longitude, latitude]);
        }
      } else {
        const bathroomId = feature.properties.singleBathroomId!;
        const key = bathroomId;
        seenKeys.add(key);

        let marker = markersRef.current.get(key);
        if (!marker) {
          const el = createPinElement();
          el.addEventListener("click", (event) => {
            event.stopPropagation();
            onSelectPinRef.current(bathroomId);
          });
          marker = new Marker({ element: el }).setLngLat([longitude, latitude]).addTo(map);
          markersRef.current.set(key, marker);
        } else {
          marker.setLngLat([longitude, latitude]);
        }
        const el = marker.getElement() as HTMLDivElement;
        updatePinElement(el, feature.properties.score);
        applySelectedStyle(el, bathroomId === selectedId);
      }
    }

    for (const [key, marker] of markersRef.current) {
      if (!seenKeys.has(key)) {
        marker.remove();
        markersRef.current.delete(key);
      }
    }
    // selectedId is read for leaf-marker styling above but intentionally
    // isn't a dependency - selection changes are handled by the dedicated
    // effect below (re-styling existing markers) instead of a full re-cluster.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    ensureMaplibreCss();
    ensureRTLTextPlugin();
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    // Bug fix: the map could get permanently stuck with zero pins and a
    // non-interactive canvas - no thrown error, tiles/basemap tiles fetched
    // fine over the network, but MapLibre's own internal
    // `.maplibregl-canvas-container` element never got its expected
    // `position: absolute` sizing (confirmed via computed style - it was
    // stuck at `position: static; height: 0px` while its own parent
    // measured correctly). Root cause: MapLibre reads the container's size
    // once, synchronously, at construction time, and React Native Web's
    // flex layout hasn't necessarily finished sizing this container yet on
    // that first pass. Calling `map.resize()` *after* construction was not
    // a reliable fix - confirmed by direct testing that a map constructed
    // against a zero-size container can stay wedged even after later
    // resize() calls once the container is properly sized. The robust fix
    // is to never construct the map until the container has a real,
    // non-zero size in the first place.
    //
    // ResizeObserver is the "real" mechanism for this (fires once layout
    // settles, and again on any later resize), but its own initial-callback
    // guarantee isn't reliable in every environment - confirmed directly
    // against a bare, independently-created div that ResizeObserver simply
    // never fired for at all in one test run. An immediate synchronous
    // check plus a few short-interval fallback timers make this correct
    // even if ResizeObserver's callback never comes.
    let map: MapLibreMap | null = null;
    let cancelled = false;

    function createMap() {
      if (cancelled || map) return;
      map = new MapLibreMap({
        container: container!,
        style: MAP_STYLE_URL,
        center: [DEFAULT_MAP_CENTER.longitude, DEFAULT_MAP_CENTER.latitude],
        zoom: DEFAULT_MAP_ZOOM,
        // Flat 2D only - this is a pin-browsing map, not a 3D navigation
        // app. Locking pitch/rotation out at construction time (rather than
        // just leaving pitch at its 0 default) means a stray two-finger
        // twist or right-click-drag can never tilt/rotate the camera in the
        // first place, which is both simpler to reason about and cheaper to
        // render than an unconstrained 3D camera.
        pitchWithRotate: false,
        dragRotate: false,
        touchPitch: false,
        maxPitch: 0,
      });
      map.touchZoomRotate.disableRotation();

      // Bug fix (belt-and-suspenders alongside the sizing fix above): the
      // map could render with a correctly-sized outer container but a
      // collapsed, non-positioned `.maplibregl-canvas-container` (confirmed
      // via computed style - `position: static; height: 0px` instead of
      // maplibre-gl.css's intended `position: absolute; inset: 0`). That
      // CSS is loaded from an external stylesheet (ensureMaplibreCss), and
      // React Native Web injects its own <style> tags dynamically as the
      // app renders - depending on load/injection order, RNW's rules can
      // end up later in the cascade and win over maplibre's for this
      // element. Setting the same properties inline guarantees they apply
      // regardless of stylesheet ordering (inline styles beat any
      // non-!important stylesheet rule).
      const canvasContainer = container!.querySelector<HTMLElement>(".maplibregl-canvas-container");
      if (canvasContainer) {
        canvasContainer.style.position = "absolute";
        canvasContainer.style.inset = "0";
      }

      map.addControl(new NavigationControl({ showCompass: false }), "top-right");
      map.on("click", () => onPressBackgroundRef.current?.());
      map.on("moveend", () => {
        // Bug fix: zooming in/out changes both the query bbox AND the
        // clustering resolution, so the currently loaded sample (fetched
        // for the PREVIOUS zoom's bbox - see getVenuesInBounds's row cap) is
        // no longer a trustworthy representation of what's actually in view
        // at the new zoom. Re-clustering it
        // anyway produced a real, visible bug: a flash of wrong/incomplete
        // pins at the new zoom (built from old-zoom data) immediately
        // followed by a second, correct re-render once the debounced
        // refetch's fresh data landed a few hundred ms later - which reads
        // exactly like "pins moving around strangely" on every zoom. A pure
        // pan (zoom unchanged) doesn't have this problem - the loaded
        // sample is still spatially valid for a modest pan - so only that
        // case re-clusters immediately; a zoom change skips straight to
        // reportRegion() and waits for the `[bathrooms]` effect below to
        // render once, with correct data, after the refetch resolves.
        const currentMap = mapRef.current;
        if (currentMap && Math.round(currentMap.getZoom()) === lastRenderedZoomRef.current) {
          renderClusters();
        }
        reportRegion();
      });
      // Liberty's base style isn't ours to edit at the source - recolor it
      // toward the oasis palette once it's actually loaded. See mapTheme.ts.
      map.once("load", () => {
        applyLavMapTheme(map!);
        renderClusters();
        lastRenderedZoomRef.current = Math.round(map!.getZoom());
        reportRegion();
      });
      // Bug fix: reportRegion() was previously only called from the "load"
      // handler above, tying the very first bathrooms fetch to the base map
      // *style/tiles* finishing loading - a real network round trip with no
      // logical connection to which bathrooms are in view. On a slow
      // connection (or a style host having a bad day) this left the map
      // showing "Loading bathrooms..." indefinitely even though the viewport
      // bounds needed to fetch them are already known: center/zoom are set
      // synchronously above, so map.getBounds() is valid immediately, before
      // a single tile has been requested. Calling it here as well decouples
      // "what's in view" from "has the basemap finished painting" - the
      // "load" handler's own call becomes a harmless re-fetch of the same
      // bounds (deduped naturally by the 300ms debounce in the Map screen's
      // effect) rather than the only path to ever populating `bathrooms`.
      //
      // mapRef.current MUST be set before this call: reportRegion() (like
      // renderClusters()) reads the map through mapRef.current, not through
      // this closure's own `map` variable - calling it beforehand is a
      // guaranteed no-op (its own `if (!map) return` guard, referring to the
      // still-null ref, swallows it silently). Confirmed by direct testing:
      // this exact ordering mistake was tried first and produced no request
      // at all, no error either, just the same permanent "Loading
      // bathrooms..." this whole fix is for.
      mapRef.current = map;
      reportRegion();
    }

    function tryCreate() {
      if (map || cancelled) return;
      const { width, height } = container!.getBoundingClientRect();
      if (width > 0 && height > 0) createMap();
    }

    tryCreate(); // fast path - container may already be sized by the time this effect runs

    const resizeObserver = new ResizeObserver(() => {
      if (!map) tryCreate();
      else map.resize();
    });
    resizeObserver.observe(container);

    const fallbackTimers = [100, 500, 1500, 3000].map((delay) => setTimeout(tryCreate, delay));

    return () => {
      cancelled = true;
      fallbackTimers.forEach(clearTimeout);
      resizeObserver.disconnect();
      map?.remove();
      mapRef.current = null;
      markersRef.current.clear();
      userLocationMarkerRef.current = null;
    };
  }, [renderClusters, reportRegion]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Venues are already deduplicated server-side (get_venues_in_bounds) -
    // one point per building, no client-side coordinate grouping needed
    // (unlike the old per-bathroom rendering). Supercluster still handles
    // its own proximity clustering (nearby-but-distinct venues) at its
    // default settings.
    const index = new Supercluster<ClusterPointProps, ClusterAggProps>({
      radius: 50,
      maxZoom: 16,
      map: (props) => ({
        scoreSum: props.score ?? 0,
        ratedCount: props.score !== undefined ? 1 : 0,
      }),
      reduce: (accumulated, props) => {
        accumulated.scoreSum += props.scoreSum;
        accumulated.ratedCount += props.ratedCount;
      },
    });
    index.load(
      venues.map((venue) => ({
        type: "Feature",
        properties: {
          venueId: venue.id,
          restroomCount: venue.restroom_count,
          singleBathroomId: venue.single_bathroom_id,
          score: venue.max_overall_score ?? undefined,
        },
        geometry: { type: "Point", coordinates: [venue.longitude, venue.latitude] },
      }))
    );
    clusterIndexRef.current = index;

    // Index rebuild only re-renders the existing view at the existing
    // camera position - it does NOT fit bounds. Camera moves are driven
    // exclusively by fitBoundsRequest/focusRequest/locateMeToken below, so
    // an unrelated venues-array change (e.g. search text getting cleared
    // after selecting a result) can't yank the camera out from under an
    // in-flight flyTo. See fitBoundsRequest prop comment.
    //
    // Deliberately NOT gated on map.loaded() (it used to be): renderClusters
    // only reads map.getBounds()/getZoom() and adds DOM-based Marker
    // elements - none of that needs the underlying style/tiles to have
    // finished painting, same reasoning as reportRegion() above. Gating pin
    // placement on "has the basemap image finished loading" meant venues
    // could arrive from the fetch (now firing immediately, see above) yet
    // still never appear as pins if the style took a while - or, on at
    // least one tested environment, never actually reported "loaded" at
    // all, which left the map perpetually pin-less even with correct data.
    renderClusters();
    // Marks this data as valid for the map's current zoom - see the
    // moveend handler's comment for why this gates whether a later pan/zoom
    // re-clusters immediately or waits for a fresh fetch.
    lastRenderedZoomRef.current = Math.round(map.getZoom());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venues]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !fitBoundsRequest || bathrooms.length === 0) return;
    map.fitBounds(computeBounds(bathrooms), { padding: 64, maxZoom: 15, duration: 300 });
    // Only re-run on a new explicit fit request (token bump) - not on every
    // bathrooms reference change, see the prop comment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitBoundsRequest]);

  useEffect(() => {
    for (const [key, marker] of markersRef.current) {
      if (key.startsWith("cluster:") || key.startsWith("venue-group:")) continue;
      applySelectedStyle(marker.getElement() as HTMLDivElement, key === selectedId);
    }
  }, [selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusRequest) return;
    const bathroom = bathrooms.find((b) => b.id === focusRequest.id);
    if (!bathroom) return;
    map.flyTo({
      center: [bathroom.longitude, bathroom.latitude],
      zoom: Math.max(map.getZoom(), 15),
      duration: 600,
    });
    // Only re-run when a *new* focus request comes in (token bump), not on
    // every bathrooms/selectedId change - see the focusRequest prop comment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest?.token]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!userLocation) {
      userLocationMarkerRef.current?.remove();
      userLocationMarkerRef.current = null;
      return;
    }

    if (!userLocationMarkerRef.current) {
      userLocationMarkerRef.current = new Marker({ element: createUserLocationElement() })
        .setLngLat([userLocation.longitude, userLocation.latitude])
        .addTo(map);
    } else {
      userLocationMarkerRef.current.setLngLat([userLocation.longitude, userLocation.latitude]);
    }
  }, [userLocation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !locateMeToken || !userLocation) return;
    map.flyTo({
      center: [userLocation.longitude, userLocation.latitude],
      zoom: Math.max(map.getZoom(), 15),
      duration: 600,
    });
    // Only re-run on a new "Locate Me" tap (token bump) - see the
    // locateMeToken prop comment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locateMeToken]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyToRequest) return;
    map.flyTo({
      center: [flyToRequest.longitude, flyToRequest.latitude],
      zoom: Math.max(map.getZoom(), 15),
      duration: 600,
    });
    // Only re-run on a new flyToRequest (token bump) - see the prop comment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyToRequest?.token]);

  return (
    <View style={styles.container}>
      {/* eslint-disable-next-line react/no-unknown-property -- raw DOM node, this file only runs on web */}
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
      {IS_USING_FALLBACK_MAP_STYLE ? (
        <View style={styles.devBadge} pointerEvents="none">
          <Text style={styles.devBadgeText}>Dev map style (OpenFreeMap)</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // Matches the oasis map theme's land tone (mapTheme.ts) so there's no
    // blue flash before the real tiles/style finish painting.
    backgroundColor: colors.background,
    overflow: "hidden",
  },
  devBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: colors.overlay,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  devBadgeText: {
    color: colors.textOnOverlay,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
});
