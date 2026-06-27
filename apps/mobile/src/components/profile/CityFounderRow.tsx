import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import type { CityContribution } from "../../features/profile/mockAchievements";
import { colors, fontSize, fontWeight, radii, spacing } from "../../theme";

interface CityFounderRowProps {
  cities: CityContribution[];
}

// Founder badges: one per launch region (see
// docs/BATHROOM_INVENTORY_AND_VERIFICATION_STRATEGY.md Section 9.3). Unlock
// rule here is a mock stand-in - "at least one verified contribution in
// that city" - the real rule (first N contributors per region, or a launch
// window cutoff) is a product decision for whenever this is backed by
// Supabase. Rendered as small rounded pills (fixed compact width, not a
// stretched grid box) since there are only ever a handful of these.
export function CityFounderRow({ cities }: CityFounderRowProps) {
  return (
    <View style={styles.row}>
      {cities.map((city) => {
        const isUnlocked = city.verifiedCount > 0;
        return (
          <View key={city.city} style={styles.pill}>
            <View style={[styles.iconCircle, isUnlocked ? styles.iconCircleUnlocked : styles.iconCircleLocked]}>
              <Ionicons name="flag-outline" size={15} color={colors.textPrimary} />
            </View>
            <View style={styles.textBlock}>
              <Text style={styles.label} numberOfLines={1}>
                {city.label}
              </Text>
              <Text style={isUnlocked ? styles.statusUnlocked : styles.statusLocked} numberOfLines={1}>
                {isUnlocked ? `${city.verifiedCount} verified` : "Locked"}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  pill: {
    flexBasis: 150,
    flexGrow: 1,
    maxWidth: 200,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.sandMuted,
    borderRadius: radii.xl,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircleUnlocked: {
    backgroundColor: colors.success,
  },
  iconCircleLocked: {
    backgroundColor: colors.warningMuted,
  },
  textBlock: {
    flex: 1,
    gap: 1,
  },
  label: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  statusUnlocked: {
    fontSize: fontSize.sm,
    color: colors.accentStrong,
    fontWeight: fontWeight.semibold,
  },
  statusLocked: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
});
