import { useCallback, useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LngLatBounds, Marker, MapLibreMap, NavigationControl, setRTLTextPlugin } from "maplibre-gl";
import Supercluster from "supercluster";

import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, IS_USING_FALLBACK_MAP_STYLE, MAP_STYLE_URL } from "../../lib/mapStyle";
import { applyLavMapTheme } from "../../lib/mapTheme";
import { PIN, pinColorRgb, pinFill } from "../../lib/pinColor";
import { colors, fontSize, fontWeight, radii } from "../../theme";
import type { BathroomNearby } from "../../types/database";

interface MapViewProps {
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
  // Phase 4 micro-grouping: called instead of onSelectPin when a tapped pin
  // represents more than one bathroom at the exact same coordinate (e.g.
  // every stall inside one MRT station). The parent opens a sheet/modal
  // listing them.
  onSelectGroup?: (bathroomIds: string[]) => void;
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

// One point per exact coordinate, not one per bathroom - see the grouping
// step in the `[bathrooms]` effect below. bathroomIds.length > 1 means this
// point represents Phase 4's "micro-group" (identical-coordinate) case.
// avgScore is the mean of only the RATED members (review_count > 0) at that
// coordinate - undefined when none are rated yet (an unrated pin).
interface ClusterPointProps {
  bathroomIds: string[];
  avgScore?: number;
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

// Minimal stroke SVG (15x15), ported verbatim from the real Figma source's
// PaperRollIcon - used inline on every ScorePill since these markers are raw
// DOM nodes (see the file-level comment on why: maplibre-gl markers are
// plain `document.createElement` elements, not React components).
function paperRollIconSvg(color: string): string {
  return `<svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <rect x="1.5" y="2" width="12" height="11" rx="2.8" stroke="${color}" stroke-width="1.35"/>
    <circle cx="7.5" cy="7.5" r="2" stroke="${color}" stroke-width="1.2"/>
    <line x1="7.5" y1="13" x2="7.5" y2="14.5" stroke="${color}" stroke-width="1.35" stroke-linecap="round"/>
  </svg>`;
}

// Single-bathroom marker - a rounded pill colored by the shared score
// gradient (pinFill, see lib/pinColor.ts), matching the Figma spec exactly:
// 30px tall, fully rounded, paper-roll icon + score text. Unrated (no
// reviews yet) gets a white/hairline-border/em-dash treatment instead of a
// score color. `friend`/`visited` variants from the reference spec are
// intentionally not implemented yet - both need per-user data (friendship,
// logged status) joined into the map's own bathroom fetch, a separate
// data-plumbing change from this visual port.
function createScorePillElement(score: number | undefined): HTMLDivElement {
  const el = document.createElement("div");
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.gap = "5px";
  el.style.height = "30px";
  el.style.paddingLeft = "12px";
  el.style.paddingRight = "12px";
  el.style.borderRadius = "15px";
  el.style.cursor = "pointer";
  el.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.2)";

  const icon = document.createElement("div");
  icon.style.display = "flex";
  icon.style.opacity = "0.85";

  const text = document.createElement("span");
  text.style.fontSize = "14px";
  text.style.fontWeight = "600";
  text.style.lineHeight = "1";

  el.appendChild(icon);
  el.appendChild(text);
  updateScorePillElement(el, score);
  return el;
}

// Refreshes a pill's score-dependent look in place (fill/border/icon
// color/label) without rebuilding its DOM structure - called on every
// render for the leaf (single-bathroom) case, since a bathroom's score can
// change between fetches (a new rating coming in) even when its marker
// element is being reused.
function updateScorePillElement(el: HTMLDivElement, score: number | undefined) {
  const unrated = score === undefined;
  const fill = unrated ? PIN.unratedFill : pinFill(score);
  const textColor = unrated ? PIN.unratedText : "#FFFFFF";
  const label = unrated ? "—" : score.toFixed(1);

  el.style.backgroundColor = fill;
  el.style.border = unrated ? `1px solid ${PIN.unratedBorder}` : "none";

  const icon = el.children[0] as HTMLDivElement;
  icon.innerHTML = paperRollIconSvg(textColor);
  const text = el.children[1] as HTMLSpanElement;
  text.style.color = textColor;
  text.textContent = label;
}

// Selection is shown as an accent ring around whatever fill the pill already
// has (score color, or the white/hairline unrated look) - never by
// overriding the fill itself, since the fill's whole purpose now is to
// communicate score at a glance.
function applySelectedStyle(el: HTMLDivElement, isSelected: boolean) {
  el.style.boxShadow = isSelected
    ? `0 0 0 3px ${colors.accentStrong}, 0 2px 4px rgba(0, 0, 0, 0.2)`
    : "0 2px 4px rgba(0, 0, 0, 0.2)";
}

// Several bathrooms at one spot (either an exact-coordinate "group" or a
// supercluster spatial cluster) - 2-4 gets a SmallCluster (a ScorePill with
// a count chip tucked behind it), 5+ gets a LargeCluster (a halo'd circle
// sized sm/md/lg by count). Both share the same avg-score coloring so
// "several bathrooms" always reads on the same green-to-red scale as a
// single one, regardless of why they're grouped.
function createClusterElement(count: number, avgScore: number | undefined): HTMLDivElement {
  return count >= 5 ? createLargeClusterElement(count, avgScore) : createSmallClusterElement(count, avgScore);
}

function createSmallClusterElement(count: number, avgScore: number | undefined): HTMLDivElement {
  const wrapper = document.createElement("div");
  wrapper.style.display = "inline-flex";
  wrapper.style.alignItems = "center";
  wrapper.style.position = "relative";
  wrapper.style.cursor = "pointer";

  const pill = createScorePillElement(avgScore);
  pill.style.position = "relative";
  pill.style.zIndex = "2";
  pill.style.boxShadow = "none";

  const chip = document.createElement("div");
  chip.style.position = "relative";
  chip.style.zIndex = "1";
  chip.style.marginLeft = "-8px";
  chip.style.height = "26px";
  chip.style.display = "flex";
  chip.style.alignItems = "center";
  chip.style.paddingLeft = "14px";
  chip.style.paddingRight = "9px";
  chip.style.borderRadius = "0 13px 13px 0";
  chip.style.backgroundColor = PIN.chipBg;
  chip.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.2)";

  const chipText = document.createElement("span");
  chipText.style.fontSize = "12px";
  chipText.style.fontWeight = "600";
  chipText.style.color = PIN.chipText;
  chipText.style.lineHeight = "1";
  chipText.textContent = `+${count - 1}`;
  chip.appendChild(chipText);

  wrapper.appendChild(pill);
  wrapper.appendChild(chip);
  return wrapper;
}

function createLargeClusterElement(count: number, avgScore: number | undefined): HTMLDivElement {
  const unrated = avgScore === undefined;
  const label = count >= 100 ? "99+" : String(count);
  const size = count >= 100 ? 60 : count >= 21 ? 50 : 40;
  const fontSizePx = count >= 100 ? 17 : count >= 21 ? 16 : 15;
  const haloWidth = count >= 100 ? 9 : count >= 21 ? 7 : 5;
  const haloAlpha = count >= 100 ? 0.12 : count >= 21 ? 0.14 : 0.16;

  const fill = unrated ? PIN.unratedFill : pinFill(avgScore);

  const el = document.createElement("div");
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.borderRadius = "999px";
  el.style.backgroundColor = fill;
  el.style.border = unrated ? `1px solid ${PIN.unratedBorder}` : "none";
  el.style.boxShadow = unrated
    ? "none"
    : `0 0 0 ${haloWidth}px rgba(${pinColorRgbCss(avgScore)}, ${haloAlpha})`;
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  el.style.cursor = "pointer";
  el.textContent = label;
  el.style.fontSize = `${fontSizePx}px`;
  el.style.fontWeight = "600";
  el.style.color = unrated ? PIN.unratedText : "#FFFFFF";
  return el;
}

function pinColorRgbCss(score: number): string {
  const [r, g, b] = pinColorRgb(score);
  return `${r},${g},${b}`;
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
  bathrooms,
  selectedId,
  onSelectPin,
  onPressBackground,
  focusRequest,
  userLocation,
  locateMeToken,
  fitBoundsRequest,
  onSelectGroup,
  onRegionChangeComplete,
  flyToRequest,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<globalThis.Map<string, Marker>>(new globalThis.Map());
  const clusterIndexRef = useRef<Supercluster<ClusterPointProps, ClusterAggProps> | null>(null);
  const userLocationMarkerRef = useRef<Marker | null>(null);
  const onSelectPinRef = useRef(onSelectPin);
  const onPressBackgroundRef = useRef(onPressBackground);
  const onSelectGroupRef = useRef(onSelectGroup);
  const onRegionChangeCompleteRef = useRef(onRegionChangeComplete);
  onSelectPinRef.current = onSelectPin;
  onPressBackgroundRef.current = onPressBackground;
  onSelectGroupRef.current = onSelectGroup;
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
      } else if (feature.properties.bathroomIds.length > 1) {
        // Phase 4 micro-group: multiple bathrooms at the exact same
        // coordinate (e.g. every stall in one MRT station), rendered as one
        // pin - the same SmallCluster/LargeCluster visuals as a spatial
        // cluster (createClusterElement), so "several bathrooms stacked"
        // reads consistently regardless of why they're grouped. Key on the
        // sorted id list so it's stable across re-renders regardless of the
        // source array's order.
        const bathroomIds = feature.properties.bathroomIds;
        const key = `group:${[...bathroomIds].sort().join(",")}`;
        seenKeys.add(key);

        let marker = markersRef.current.get(key);
        if (!marker) {
          const el = createClusterElement(bathroomIds.length, feature.properties.avgScore);
          el.addEventListener("click", (event) => {
            event.stopPropagation();
            onSelectGroupRef.current?.(bathroomIds);
          });
          marker = new Marker({ element: el }).setLngLat([longitude, latitude]).addTo(map);
          markersRef.current.set(key, marker);
        } else {
          marker.setLngLat([longitude, latitude]);
        }
      } else {
        const bathroomId = feature.properties.bathroomIds[0]!;
        const key = bathroomId;
        seenKeys.add(key);

        let marker = markersRef.current.get(key);
        if (!marker) {
          const el = createScorePillElement(feature.properties.avgScore);
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
        updateScorePillElement(el, feature.properties.avgScore);
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
        renderClusters();
        reportRegion();
      });
      // Liberty's base style isn't ours to edit at the source - recolor it
      // toward the oasis palette once it's actually loaded. See mapTheme.ts.
      map.once("load", () => {
        applyLavMapTheme(map!);
        renderClusters();
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

    // Phase 4 micro-grouping happens here, before supercluster ever sees the
    // data: bathrooms sharing the exact same lat/lng (e.g. every stall in
    // one MRT station) collapse into a single point up front, rather than
    // relying on supercluster's proximity radius to keep them together (that
    // radius is tuned for "nearby but distinct locations", a different
    // concept - it would either merge close-but-separate venues into one pin
    // or need constant retuning as data density changes). Every OTHER point
    // stays a normal individual location for supercluster's own proximity
    // clustering (Phase 4 macro-grouping) to handle at its default settings.
    const locationGroups = new globalThis.Map<string, BathroomNearby[]>();
    for (const b of bathrooms) {
      const key = `${b.latitude.toFixed(6)},${b.longitude.toFixed(6)}`;
      const group = locationGroups.get(key);
      if (group) group.push(b);
      else locationGroups.set(key, [b]);
    }

    // avgScore is the mean of only the RATED members at this coordinate
    // (review_count > 0) - undefined (unrated) when none of them are, so an
    // unrated group never gets dragged into a false low/high score color.
    const index = new Supercluster<ClusterPointProps, ClusterAggProps>({
      radius: 50,
      maxZoom: 16,
      map: (props) => ({
        scoreSum: props.avgScore ?? 0,
        ratedCount: props.avgScore !== undefined ? 1 : 0,
      }),
      reduce: (accumulated, props) => {
        accumulated.scoreSum += props.scoreSum;
        accumulated.ratedCount += props.ratedCount;
      },
    });
    index.load(
      [...locationGroups.values()].map((group) => {
        const rated = group.filter((b) => b.review_count > 0);
        const avgScore = rated.length > 0 ? rated.reduce((sum, b) => sum + b.overall_score, 0) / rated.length : undefined;
        return {
          type: "Feature",
          properties: { bathroomIds: group.map((b) => b.id), avgScore },
          geometry: { type: "Point", coordinates: [group[0]!.longitude, group[0]!.latitude] },
        };
      })
    );
    clusterIndexRef.current = index;

    // Index rebuild only re-renders the existing view at the existing
    // camera position - it does NOT fit bounds. Camera moves are driven
    // exclusively by fitBoundsRequest/focusRequest/locateMeToken below, so
    // an unrelated bathrooms-array change (e.g. search text getting cleared
    // after selecting a result) can't yank the camera out from under an
    // in-flight flyTo. See fitBoundsRequest prop comment.
    //
    // Deliberately NOT gated on map.loaded() (it used to be): renderClusters
    // only reads map.getBounds()/getZoom() and adds DOM-based Marker
    // elements - none of that needs the underlying style/tiles to have
    // finished painting, same reasoning as reportRegion() above. Gating pin
    // placement on "has the basemap image finished loading" meant bathrooms
    // could arrive from the fetch (now firing immediately, see above) yet
    // still never appear as pins if the style took a while - or, on at
    // least one tested environment, never actually reported "loaded" at
    // all, which left the map perpetually pin-less even with correct data.
    renderClusters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bathrooms]);

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
      if (key.startsWith("cluster:") || key.startsWith("group:")) continue;
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
