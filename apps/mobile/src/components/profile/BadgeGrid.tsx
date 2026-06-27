import { StyleSheet, View } from "react-native";

import { BADGE_DEFS, getBadgeProgress } from "../../features/profile/badges";
import type { ProfileStats } from "../../features/profile/mockAchievements";
import { spacing } from "../../theme";
import { BadgeCard } from "./BadgeCard";

interface BadgeGridProps {
  stats: ProfileStats;
}

export function BadgeGrid({ stats }: BadgeGridProps) {
  return (
    <View style={styles.grid}>
      {BADGE_DEFS.map((badge) => (
        <BadgeCard key={badge.key} progress={getBadgeProgress(badge, stats)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
});
