import { Ionicons } from "@expo/vector-icons";
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";

import { colors, fontSize, fontWeight, radii, spacing } from "../../theme";

interface PhotoCarouselProps {
  photoLabels: string[];
}

// There's no real photo upload yet (see README "Build order" /
// PROJECT_HANDOFF.md), so this renders labeled placeholder tiles instead of
// pretending to have real user photos - swap for actual <Image> rendering
// once bathroom_photos rows exist.
export function PhotoCarousel({ photoLabels }: PhotoCarouselProps) {
  const { width } = useWindowDimensions();

  return (
    <View style={styles.wrapper}>
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
        {photoLabels.map((label, index) => (
          <View key={`${label}-${index}`} style={[styles.tile, { width }]}>
            <Ionicons name="image-outline" size={40} color={colors.textOnAccent} />
            <Text style={styles.label}>{label}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={styles.countBadge}>
        <Ionicons name="images-outline" size={12} color={colors.textOnAccent} />
        <Text style={styles.countText}>{photoLabels.length} photos</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    height: 280,
    backgroundColor: colors.accent,
  },
  tile: {
    height: 280,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  label: {
    color: colors.textOnAccent,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    opacity: 0.85,
  },
  countBadge: {
    position: "absolute",
    bottom: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.overlay,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  countText: {
    color: colors.textOnAccent,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
});
