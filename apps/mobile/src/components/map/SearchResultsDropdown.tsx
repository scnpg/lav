import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { ACCESS_TYPE_LABELS } from "../../constants/enumLabels";
import type { PlaceResult } from "../../features/places/search";
import { formatDistance, formatScore } from "../../lib/format";
import { cardShadow, colors, fontSize, fontWeight, radii, spacing } from "../../theme";
import type { BathroomNearby } from "../../types/database";

const PLACE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  train: "train-outline",
  street: "trail-sign-outline",
  hotel: "bed-outline",
  store: "storefront-outline",
  landmark: "flag-outline",
  neighborhood: "map-outline",
  district: "map-outline",
  place: "location-outline",
};

interface SearchResultsDropdownProps {
  results: BathroomNearby[];
  places?: PlaceResult[];
  placesLoading?: boolean;
  onSelect: (id: string) => void;
  onSelectPlace?: (place: PlaceResult) => void;
}

// Two sections when there's anything to show under "Places" - bathrooms
// people can rate/log, and everything else (streets, landmarks, hotels...)
// for finding a neighborhood you don't already know, via Nominatim
// (src/features/places/search.ts). Tapping a place flies the map there and
// lets the viewport-based bathroom fetch take over, same as tapping a
// bathroom centers on it directly.
export function SearchResultsDropdown({ results, places = [], placesLoading, onSelect, onSelectPlace }: SearchResultsDropdownProps) {
  const hasPlaces = places.length > 0 || placesLoading;
  return (
    <View style={[styles.container, cardShadow("sm")]}>
      {results.length === 0 && !hasPlaces ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No bathrooms found</Text>
        </View>
      ) : (
        <ScrollView style={styles.list} keyboardShouldPersistTaps="handled" accessibilityRole="list">
          {hasPlaces ? (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>Places</Text>
              {placesLoading ? <ActivityIndicator size="small" color={colors.textMuted} /> : null}
            </View>
          ) : null}
          {places.map((place) => (
            <TouchableOpacity
              key={place.id}
              style={styles.row}
              onPress={() => onSelectPlace?.(place)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`${place.label}, ${place.sublabel}`}
              accessibilityHint="Flies the map to this place"
            >
              <Ionicons name={PLACE_ICONS[place.category] ?? PLACE_ICONS.place} size={18} color={colors.accentStrong} />
              <View style={styles.rowMain}>
                <Text style={styles.name} numberOfLines={1}>
                  {place.label}
                </Text>
                {place.sublabel ? (
                  <Text style={styles.subtitle} numberOfLines={1}>
                    {place.sublabel}
                  </Text>
                ) : null}
              </View>
            </TouchableOpacity>
          ))}
          {results.length > 0 ? (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>Bathrooms</Text>
            </View>
          ) : null}
          {results.map((bathroom) => (
            <TouchableOpacity
              key={bathroom.id}
              style={styles.row}
              onPress={() => onSelect(bathroom.id)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`${bathroom.name}, ${formatDistance(bathroom.distance_meters)} away, rated ${formatScore(bathroom.overall_score)}`}
              accessibilityHint="Centers the map on this bathroom"
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
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: 4,
    backgroundColor: colors.surfaceMuted,
  },
  sectionHeaderText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
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
