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
// Supabase.
export function CityFounderRow({ cities }: CityFounderRowProps) {
  return (
    <View style={styles.row}>
      {cities.map((city) => {
        const isUnlocked = city.verifiedCount > 0;
        return (
          <View key={city.city} style={styles.chip}>
            <View style={[styles.iconCircle, isUnlocked ? styles.iconCircleUnlocked : styles.iconCircleLocked]}>
              <Ionicons name="flag-outline" size={16} color={colors.textPrimary} />
            </View>
            <Text style={styles.label}>{city.label} Founder</Text>
            <Text style={isUnlocked ? styles.statusUnlocked : styles.statusLocked}>
              {isUnlocked ? `${city.verifiedCount} verified` : "Locked"}
            </Text>
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
  chip: {
    flexBasis: "47%",
    flexGrow: 1,
    backgroundColor: colors.sandMuted,
    borderRadius: radii.lg,
    padding: spacing.md,
    alignItems: "center",
    gap: 4,
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
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  statusUnlocked: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  statusLocked: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
});
