import { Ionicons } from "@expo/vector-icons";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { ACCESS_TYPE_LABELS } from "../../constants/enumLabels";
import { formatDistance, formatScore } from "../../lib/format";
import { cardShadow, colors, fontSize, fontWeight, radii, spacing } from "../../theme";
import type { BathroomNearby } from "../../types/database";

interface SearchResultsDropdownProps {
  results: BathroomNearby[];
  onSelect: (id: string) => void;
}

export function SearchResultsDropdown({ results, onSelect }: SearchResultsDropdownProps) {
  return (
    <View style={[styles.container, cardShadow("sm")]}>
      {results.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No bathrooms found</Text>
        </View>
      ) : (
        <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
          {results.map((bathroom) => (
            <TouchableOpacity
              key={bathroom.id}
              style={styles.row}
              onPress={() => onSelect(bathroom.id)}
              activeOpacity={0.7}
            >
              <View style={styles.rowMain}>
                <Text style={styles.name} numberOfLines={1}>
                  {bathroom.name}
                </Text>
                <Text style={styles.subtitle} numberOfLines={1}>
                  {[bathroom.venue_name ?? bathroom.city, bathroom.access_type ? ACCESS_TYPE_LABELS[bathroom.access_type] : null]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </View>
              <View style={styles.rowMeta}>
                <View style={styles.scoreBadge}>
                  <Ionicons name="star" size={11} color={colors.gold} />
                  <Text style={styles.scoreText}>{formatScore(bathroom.overall_score)}</Text>
                </View>
                <View style={styles.distanceBadge}>
                  <Text style={styles.distanceText}>{formatDistance(bathroom.distance_meters)}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  list: {
    maxHeight: 280,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  rowMeta: {
    alignItems: "flex-end",
    gap: 4,
  },
  scoreBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.goldMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  scoreText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  distanceBadge: {
    backgroundColor: colors.skyMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  distanceText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
  },
  emptyState: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
});
