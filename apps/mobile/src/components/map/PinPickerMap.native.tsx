import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { colors, fontSize, fontWeight, spacing } from "../../theme";

interface Coordinate {
  latitude: number;
  longitude: number;
}

interface PinPickerMapProps {
  initialCenter: Coordinate;
  onCenterChange: (center: Coordinate) => void;
  locked?: boolean;
}

// Native (iOS/Android) doesn't have a real interactive map yet - same
// situation as MapView.native.tsx (real native MapLibre needs a custom dev
// client build, not attempted in this repo). Rather than pretend to offer
// drag-to-place precision it can't deliver, this shows the coordinate
// currently on file (GPS fix or, in amendment mode, the existing bathroom's
// location) as plain text instead of a picker.
export function PinPickerMap({ initialCenter, locked = false }: PinPickerMapProps) {
  return (
    <View style={styles.container}>
      <Ionicons name="location" size={28} color={colors.accentStrong} />
      <Text style={styles.coordText}>
        {initialCenter.latitude.toFixed(6)}, {initialCenter.longitude.toFixed(6)}
      </Text>
      <Text style={styles.hintText}>
        {locked ? "This bathroom's location" : "Interactive placement isn't available on this build yet - using your current location."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.lg,
  },
  coordText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  hintText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
