import { useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LngLatBounds, Marker, MapLibreMap, NavigationControl } from "maplibre-gl";

import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, IS_USING_FALLBACK_MAP_STYLE, MAP_STYLE_URL } from "../../lib/mapStyle";
import { applyOasisMapTheme } from "../../lib/mapTheme";
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

function createPinElement(): HTMLDivElement {
  const el = document.createElement("div");
  el.style.width = "32px";
  el.style.height = "32px";
  el.style.borderRadius = "999px";
  el.style.backgroundColor = colors.surface;
  el.style.border = `2px solid ${colors.accentStrong}`;
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  el.style.fontSize = "11px";
  el.style.fontWeight = "700";
  el.style.color = colors.textPrimary;
  el.style.cursor = "pointer";
  el.style.boxShadow = "0 2px 4px rgba(37, 40, 36, 0.25)";
  return el;
}

// Selected pins fill with sky blue (not the lagoon teal used for buttons/
// chips elsewhere) - per the palette's map-specific usage rule. Text stays
// ink either way: both the cream default and the sky-blue selected fill
// are light enough that ink reads clearly on both.
function applySelectedStyle(el: HTMLDivElement, isSelected: boolean) {
  el.style.backgroundColor = isSelected ? colors.sky : colors.surface;
  el.style.color = colors.textPrimary;
}

// Real, interactive MapLibre GL JS map for web only - see MapView.native.tsx
// for the native (iOS/Android) counterpart, which still renders the mock
// map layout until real native MapLibre is wired up.
export function MapView({ bathrooms, selectedId, onSelectPin, onPressBackground, focusRequest }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<globalThis.Map<string, Marker>>(new globalThis.Map());
  const onSelectPinRef = useRef(onSelectPin);
  const onPressBackgroundRef = useRef(onPressBackground);
  onSelectPinRef.current = onSelectPin;
  onPressBackgroundRef.current = onPressBackground;

  useEffect(() => {
    ensureMaplibreCss();
    if (!containerRef.current || mapRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      center: [DEFAULT_MAP_CENTER.longitude, DEFAULT_MAP_CENTER.latitude],
      zoom: DEFAULT_MAP_ZOOM,
    });
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    map.on("click", () => onPressBackgroundRef.current?.());
    // Liberty's base style isn't ours to edit at the source - recolor it
    // toward the oasis palette once it's actually loaded. See mapTheme.ts.
    map.once("load", () => applyOasisMapTheme(map));
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const seenIds = new Set(bathrooms.map((b) => b.id));
    for (const [id, marker] of markersRef.current) {
      if (!seenIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    }

    bathrooms.forEach((bathroom) => {
      let marker = markersRef.current.get(bathroom.id);
      if (!marker) {
        const el = createPinElement();
        el.addEventListener("click", (event) => {
          event.stopPropagation();
          onSelectPinRef.current(bathroom.id);
        });
        marker = new Marker({ element: el }).setLngLat([bathroom.longitude, bathroom.latitude]).addTo(map);
        markersRef.current.set(bathroom.id, marker);
      }
      const el = marker.getElement() as HTMLDivElement;
      el.textContent = bathroom.overall_score.toFixed(1);
      applySelectedStyle(el, bathroom.id === selectedId);
    });

    if (bathrooms.length > 0) {
      const bounds = bathrooms.reduce(
        (acc, b) => acc.extend([b.longitude, b.latitude]),
        new LngLatBounds(
          [bathrooms[0]!.longitude, bathrooms[0]!.latitude],
          [bathrooms[0]!.longitude, bathrooms[0]!.latitude]
        )
      );
      map.fitBounds(bounds, { padding: 64, maxZoom: 15, duration: 0 });
    }
    // Bounds are only fit when the *set* of bathrooms changes (search/filter),
    // not on every selection change - re-fitting on every pin tap would yank
    // the map around under the user's finger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bathrooms]);

  useEffect(() => {
    for (const [id, marker] of markersRef.current) {
      applySelectedStyle(marker.getElement() as HTMLDivElement, id === selectedId);
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
