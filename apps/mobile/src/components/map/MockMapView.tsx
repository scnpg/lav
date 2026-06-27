import { Pressable, StyleSheet, Text, View } from "react-native";

import { cardShadow, colors, fontSize, fontWeight, radii } from "../../theme";
import type { BathroomNearby } from "../../types/database";

interface MockMapViewProps {
  bathrooms: BathroomNearby[];
  selectedId: string | null;
  onSelectPin: (id: string) => void;
  onPressBackground?: () => void;
  // Accepted for prop-shape compatibility with MapView.web.tsx (this mock
  // layout has no camera to move, so it's a no-op here).
  focusRequest?: { id: string; token: number } | null;
}

/**
 * Stand-in for the real map while MapLibre isn't wired up yet (see
 * src/components/map/MapView.native.tsx / MapView.web.tsx - TODO once those
 * land). This is plain Views, not a real geographic projection: it just
 * normalizes the mock lat/lng range into the panel so pins land in roughly
 * the right relative positions to each other. Replace entirely, don't
 * extend, when the real MapLibre view is built.
 */
export function MockMapView({ bathrooms, selectedId, onSelectPin, onPressBackground }: MockMapViewProps) {
  const lats = bathrooms.map((b) => b.latitude);
  const lngs = bathrooms.map((b) => b.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latRange = maxLat - minLat || 1;
  const lngRange = maxLng - minLng || 1;
  const padding = 0.12;

  return (
    <Pressable style={styles.container} onPress={onPressBackground}>
      <View style={styles.gridOverlay} pointerEvents="none">
        {Array.from({ length: 5 }).map((_, i) => (
          <View key={`row-${i}`} style={[styles.gridLine, { top: `${(i + 1) * 16.6}%` }]} />
        ))}
        {Array.from({ length: 5 }).map((_, i) => (
          <View key={`col-${i}`} style={[styles.gridLineVertical, { left: `${(i + 1) * 16.6}%` }]} />
        ))}
      </View>

      {bathrooms.map((bathroom) => {
        const xPct = padding + ((bathroom.longitude - minLng) / lngRange) * (1 - padding * 2);
        const yPct = padding + (1 - (bathroom.latitude - minLat) / latRange) * (1 - padding * 2);
        const isSelected = bathroom.id === selectedId;

        return (
          <Pressable
            key={bathroom.id}
            onPress={() => onSelectPin(bathroom.id)}
            style={[
              styles.pinWrapper,
              { left: `${xPct * 100}%`, top: `${yPct * 100}%` },
            ]}
            hitSlop={8}
          >
            <View style={[styles.pin, isSelected && styles.pinSelected]}>
              <Text style={[styles.pinScore, isSelected && styles.pinScoreSelected]}>
                {bathroom.overall_score.toFixed(1)}
              </Text>
            </View>
          </Pressable>
        );
      })}

      <View style={styles.mockBadge} pointerEvents="none">
        <Text style={styles.mockBadgeText}>Mock map preview</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.accentMuted,
    overflow: "hidden",
  },
  gridOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gridLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.border,
    opacity: 0.6,
  },
  gridLineVertical: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: colors.border,
    opacity: 0.6,
  },
  pinWrapper: {
    position: "absolute",
    transform: [{ translateX: -16 }, { translateY: -16 }],
  },
  pin: {
    width: 32,
    height: 32,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    ...cardShadow("sm"),
  },
  pinSelected: {
    backgroundColor: colors.accent,
  },
  pinScore: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.accent,
  },
  pinScoreSelected: {
    color: colors.textOnAccent,
  },
  mockBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: colors.overlay,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  mockBadgeText: {
    color: colors.textOnAccent,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
});
