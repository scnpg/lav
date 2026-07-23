import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { Marker, MapLibreMap } from "maplibre-gl";

import { DEFAULT_MAP_ZOOM, MAP_STYLE_URL } from "../../lib/mapStyle";
import { applyLavMapTheme } from "../../lib/mapTheme";
import { colors } from "../../theme";

interface Coordinate {
  latitude: number;
  longitude: number;
}

interface RecenterRequest extends Coordinate {
  token: number;
}

interface PinPickerMapProps {
  initialCenter: Coordinate;
  onCenterChange: (center: Coordinate) => void;
  /** Amendment mode: an existing bathroom's fixed location, shown as a static marker with panning disabled - nothing to "pick," just to see. */
  locked?: boolean;
  /**
   * A one-shot imperative "move the camera here" instruction (new token =
   * new move), separate from `initialCenter`. `initialCenter` only seeds the
   * map at construction time - the map-creation effect below intentionally
   * runs once (see its own comment), so a later `initialCenter` prop change
   * (e.g. the submit wizard's fire-once GPS recenter arriving after this
   * already mounted showing DEFAULT_MAP_CENTER) would otherwise never reach
   * the actual camera. Wiring `initialCenter` itself into a reactive effect
   * would create a feedback loop instead - `onCenterChange` already flows
   * every user pan back into that same prop, so reacting to it here too
   * would re-trigger `setCenter` on the map's own moveend. A dedicated
   * one-shot token sidesteps that: it's only ever set by the caller's
   * separate one-time GPS effect, never by anything that reads it back out.
   */
  recenterRequest?: RecenterRequest | null;
}

// A deliberately minimal second MapLibre instance - no clustering, no
// bathroom pins, just pan/zoom under a fixed center crosshair (see the
// overlay below). Reusing the full MapView.web.tsx (clustering, search,
// selection state) for a single "pick a point" interaction would be a much
// heavier component than this needs.
export function PinPickerMap({ initialCenter, onCenterChange, locked = false, recenterRequest }: PinPickerMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const onCenterChangeRef = useRef(onCenterChange);
  onCenterChangeRef.current = onCenterChange;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const map = new MapLibreMap({
      container,
      style: MAP_STYLE_URL,
      center: [initialCenter.longitude, initialCenter.latitude],
      zoom: DEFAULT_MAP_ZOOM + 3,
      // Same flat-2D posture as the main map (MapView.web.tsx) - a pin
      // picker has even less reason for a 3D camera than a browsing map.
      pitchWithRotate: false,
      dragRotate: false,
      touchPitch: false,
      maxPitch: 0,
      dragPan: !locked,
      scrollZoom: true,
    });
    map.touchZoomRotate.disableRotation();

    map.on("load", () => applyLavMapTheme(map));

    if (locked) {
      new Marker({ color: colors.accentStrong }).setLngLat([initialCenter.longitude, initialCenter.latitude]).addTo(map);
    } else {
      map.on("moveend", () => {
        const center = map.getCenter();
        onCenterChangeRef.current({ latitude: center.lat, longitude: center.lng });
      });
    }

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!recenterRequest || locked) return;
    mapRef.current?.setCenter([recenterRequest.longitude, recenterRequest.latitude]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterRequest?.token]);

  return (
    <View style={styles.container}>
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
      {!locked ? (
        <View style={styles.crosshair} pointerEvents="none">
          <View style={styles.crosshairPin} />
          <View style={styles.crosshairDot} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: "relative",
    overflow: "hidden",
  },
  crosshair: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginLeft: -14,
    marginTop: -34,
    alignItems: "center",
  },
  crosshairPin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderBottomRightRadius: 0,
    backgroundColor: colors.accentStrong,
    transform: [{ rotate: "45deg" }],
  },
  crosshairDot: {
    position: "absolute",
    bottom: -3,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.overlay,
  },
});
