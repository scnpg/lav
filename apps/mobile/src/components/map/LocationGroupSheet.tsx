import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ACCESS_TYPE_LABELS } from "../../constants/enumLabels";
import { formatScore } from "../../lib/format";
import { cardShadow, colors, fontSize, fontWeight, radii, spacing } from "../../theme";
import type { BathroomNearby } from "../../types/database";

interface LocationGroupSheetProps {
  bathrooms: BathroomNearby[];
  onSelectBathroom: (id: string) => void;
  onClose: () => void;
}

// Micro-grouping (Phase 4): opened when a map pin represents more than one
// bathroom at the exact same coordinate (e.g. every stall inside one MRT
// station or mall). A plain modal/backdrop rather than a gesture-driven
// bottom sheet library - no new native dependency, and it matches the
// existing BathroomBottomCard's "simple overlay card" pattern used
// elsewhere on this screen.
export function LocationGroupSheet({ bathrooms, onSelectBathroom, onClose }: LocationGroupSheetProps) {
  // Most groups share one venue (the whole point of grouping by exact
  // coordinate) - lead with it when every row agrees, instead of repeating
  // it per-row.
  const sharedVenueName =
    bathrooms.length > 0 && bathrooms.every((b) => b.venue_name === bathrooms[0]!.venue_name)
      ? bathrooms[0]!.venue_name
      : null;

  return (
    <View style={styles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />

      <View style={[styles.sheet, cardShadow("md")]}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>{sharedVenueName ?? "Multiple bathrooms here"}</Text>
            <Text style={styles.subtitle}>
              {bathrooms.length} bathroom{bathrooms.length === 1 ? "" : "s"} at this location
            </Text>
          </View>
          <Pressable onPress={onClose} style={styles.closeButton} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>

        <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
          {bathrooms.map((bathroom) => (
            <Pressable
              key={bathroom.id}
              style={styles.row}
              onPress={() => onSelectBathroom(bathroom.id)}
              accessibilityRole="button"
              accessibilityLabel={`${bathroom.name}, ${formatFloorLabel(bathroom.floor)}`}
            >
              <View style={styles.floorBadge}>
                <Text style={styles.floorBadgeText}>{formatFloorBadge(bathroom.floor)}</Text>
              </View>

              <View style={styles.rowMain}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {bathroom.name}
                </Text>
                <Text style={styles.rowMeta} numberOfLines={1}>
                  {formatFloorLabel(bathroom.floor)}
                  {bathroom.access_type ? ` · ${ACCESS_TYPE_LABELS[bathroom.access_type]}` : ""}
                </Text>
              </View>

              <View style={styles.scoreBadge}>
                <Ionicons name="star" size={11} color={colors.gold} />
                <Text style={styles.scoreText}>{formatScore(bathroom.overall_score)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

// Compact badge shown to the left of each row - "7F" / "B1" when known, a
// generic floor glyph otherwise (the row text spells out the graceful
// "Not specified" fallback in full).
function formatFloorBadge(floor: string | null): string {
  return floor?.trim() || "—";
}

function formatFloorLabel(floor: string | null): string {
  const trimmed = floor?.trim();
  return trimmed ? `Floor: ${trimmed}` : "Floor: Not specified";
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "flex-end",
    backgroundColor: colors.overlay,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    maxHeight: "70%",
    paddingBottom: spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    padding: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerText: {
    flex: 1,
    paddingRight: spacing.md,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  closeButton: {
    padding: spacing.xs,
  },
  list: {
    flexGrow: 0,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  floorBadge: {
    minWidth: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.accentMuted,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
  },
  floorBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.accentStrong,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
  },
  rowName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  rowMeta: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  scoreBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.goldMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  scoreText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
});
