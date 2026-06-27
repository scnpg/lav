import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { ProfileStats } from "../../features/profile/mockAchievements";
import { colors, fontSize, fontWeight, radii, spacing } from "../../theme";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

interface StatDef {
  key: keyof ProfileStats;
  label: string;
  icon: IoniconName;
}

const STAT_DEFS: StatDef[] = [
  { key: "verifiedBathroomsAdded", label: "Verified added", icon: "map-outline" },
  { key: "correctConfirmations", label: "Correct confirmations", icon: "checkmark-done-outline" },
  { key: "approvedPhotos", label: "Approved photos", icon: "camera-outline" },
  { key: "approvedReviews", label: "Approved reviews", icon: "create-outline" },
  { key: "helpfulAccessTips", label: "Access tips", icon: "bulb-outline" },
  { key: "duplicateReportsConfirmed", label: "Duplicates caught", icon: "copy-outline" },
  { key: "staleReportsConfirmed", label: "Stale reports", icon: "time-outline" },
  { key: "checkIns", label: "Check-ins", icon: "location-outline" },
  { key: "listsContributedTo", label: "Lists contributed", icon: "albums-outline" },
];

interface StatsGridProps {
  stats: ProfileStats;
}

export function StatsGrid({ stats }: StatsGridProps) {
  return (
    <View style={styles.grid}>
      {STAT_DEFS.map((def) => {
        const value = stats[def.key];
        return (
          <View key={def.key} style={styles.tile}>
            <Ionicons name={def.icon} size={16} color={colors.textSecondary} />
            <Text style={styles.value}>{Array.isArray(value) ? value.length : value}</Text>
            <Text style={styles.label}>{def.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  tile: {
    flexBasis: "31%",
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    gap: 2,
  },
  value: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  label: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
});
