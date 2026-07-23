import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LngLatBounds, Marker, Map as MapLibreMap } from "maplibre-gl";

import { DEFAULT_MAP_ZOOM, MAP_STYLE_URL } from "../lib/mapStyle";
import { applyLavMapTheme } from "../lib/mapTheme";
import { colors, fontSize, fontWeight, radii, spacing } from "../theme";

export interface LoggedMapPin {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

interface LoggedBathroomsMapProps {
  bathrooms: LoggedMapPin[];
  onClose: () => void;
  onSelectBathroom: (id: string) => void;
}

// A deliberately minimal third MapLibre instance (alongside MapView.web.tsx
// and PinPickerMap.web.tsx) - a fixed, already-known set of pins with no
// clustering/viewport-fetching, so fitBounds is enough rather than the main
// map's supercluster machinery.
export function LoggedBathroomsMap({ bathrooms, onClose, onSelectBathroom }: LoggedBathroomsMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || bathrooms.length === 0) return;

    const map = new MapLibreMap({
      container,
      style: MAP_STYLE_URL,
      center: [bathrooms[0].longitude, bathrooms[0].latitude],
      zoom: DEFAULT_MAP_ZOOM,
      pitchWithRotate: false,
      dragRotate: false,
      touchPitch: false,
      maxPitch: 0,
    });
    map.touchZoomRotate.disableRotation();

    map.on("load", () => {
      applyLavMapTheme(map);

      const bounds = new LngLatBounds();
      bathrooms.forEach((b) => {
        bounds.extend([b.longitude, b.latitude]);
        const marker = new Marker({ color: colors.accentStrong })
          .setLngLat([b.longitude, b.latitude])
          .addTo(map);
        marker.getElement().style.cursor = "pointer";
        marker.getElement().addEventListener("click", () => onSelectBathroom(b.id));
      });

      if (bathrooms.length === 1) {
        map.setCenter([bathrooms[0].longitude, bathrooms[0].latitude]);
      } else {
        map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 0 });
      }
    });

    return () => map.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.overlay}>
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
      <View style={styles.header}>
        <Text style={styles.title}>
          {bathrooms.length} bathroom{bathrooms.length === 1 ? "" : "s"} logged
        </Text>
        <Pressable
          style={styles.closeButton}
          onPress={onClose}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Ionicons name="close" size={20} color={colors.textPrimary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    backgroundColor: colors.background,
  },
  header: {
    position: "absolute",
    top: 48,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  title: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
  },
});
