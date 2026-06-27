import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { BADGE_DEFS, getBadgeProgress } from "../../features/profile/badges";
import type { ProfileStats } from "../../features/profile/mockAchievements";
import { colors, fontSize, fontWeight, radii, spacing } from "../../theme";

const CARTOGRAPHER_BADGE = BADGE_DEFS.find((badge) => badge.key === "cartographer")!;

interface CartographerProgressProps {
  stats: ProfileStats;
}

// Cartographer gets its own featured card (not just a tile in the grid)
// since it's the badge most tied to Lav's core growth loop - submitting
// bathrooms that go on to get verified.
export function CartographerProgress({ stats }: CartographerProgressProps) {
  const { unlockedTierIndex, currentValue, nextTier } = getBadgeProgress(CARTOGRAPHER_BADGE, stats);
  const isUnlocked = unlockedTierIndex >= 0;
  const currentTier = isUnlocked ? CARTOGRAPHER_BADGE.tiers[unlockedTierIndex] : null;
  const floor = currentTier?.threshold ?? 0;
  const ceiling = nextTier?.threshold ?? floor;
  const span = Math.max(1, ceiling - floor);
  const pct = nextTier ? Math.max(0, Math.min(1, (currentValue - floor) / span)) * 100 : 100;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={[styles.iconCircle, isUnlocked ? styles.iconCircleUnlocked : styles.iconCircleLocked]}>
          <Ionicons name={CARTOGRAPHER_BADGE.icon} size={22} color={colors.textPrimary} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>
            Cartographer{currentTier?.tier ? ` ${currentTier.tier}` : ""}
          </Text>
          <Text style={styles.subtitle}>{CARTOGRAPHER_BADGE.description}</Text>
        </View>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>
      <Text style={styles.progressText}>
        {nextTier
          ? `${currentValue} / ${nextTier.threshold} verified submissions to ${nextTier.tier}`
          : `${currentValue} verified submissions - top tier reached`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  iconCircle: {
    width: 44,
    height: 44,
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
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  track: {
    height: 8,
    borderRadius: radii.full,
    backgroundColor: colors.sandMuted,
    overflow: "hidden",
  },
  fill: {
    height: 8,
    borderRadius: radii.full,
    backgroundColor: colors.accent,
  },
  progressText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
});
