import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import type { BadgeProgress } from "../../features/profile/badges";
import { colors, fontSize, fontWeight, radii, spacing } from "../../theme";

interface BadgeCardProps {
  progress: BadgeProgress;
}

// Color usage here follows the oasis palette's stated roles: sand for the
// soft card background, palm green for an unlocked tier, muted clay for a
// still-locked tier ("pending/needs work"), lagoon teal for the active
// progress-to-next-tier bar regardless of locked/unlocked.
export function BadgeCard({ progress }: BadgeCardProps) {
  const { badge, unlockedTierIndex, currentValue, nextTier } = progress;
  const isUnlocked = unlockedTierIndex >= 0;
  const currentTier = isUnlocked ? badge.tiers[unlockedTierIndex] : null;

  const tierLabel = currentTier?.tier ? `${badge.name} ${currentTier.tier}` : badge.name;
  const statusLabel = isUnlocked ? tierLabel : "Locked";

  const floor = currentTier?.threshold ?? 0;
  const ceiling = nextTier?.threshold ?? floor;
  const span = Math.max(1, ceiling - floor);
  const pct = nextTier ? Math.max(0, Math.min(1, (currentValue - floor) / span)) * 100 : 100;

  return (
    <View style={styles.card}>
      <View style={[styles.iconCircle, isUnlocked ? styles.iconCircleUnlocked : styles.iconCircleLocked]}>
        <Ionicons name={badge.icon} size={20} color={colors.textPrimary} />
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {badge.name}
      </Text>
      <Text style={[styles.status, isUnlocked ? styles.statusUnlocked : styles.statusLocked]}>{statusLabel}</Text>
      <Text style={styles.description} numberOfLines={2}>
        {badge.description}
      </Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>
      <Text style={styles.progressText}>
        {nextTier ? `${currentValue} / ${nextTier.threshold}` : `${currentValue} / ${floor} (max tier)`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexBasis: "47%",
    flexGrow: 1,
    backgroundColor: colors.sandMuted,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: 4,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  iconCircleUnlocked: {
    backgroundColor: colors.success,
  },
  iconCircleLocked: {
    backgroundColor: colors.warningMuted,
  },
  name: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  status: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
  statusUnlocked: {
    color: colors.textPrimary,
  },
  statusLocked: {
    color: colors.textMuted,
  },
  description: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  track: {
    height: 5,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    overflow: "hidden",
    marginTop: spacing.xs,
  },
  fill: {
    height: 5,
    borderRadius: radii.full,
    backgroundColor: colors.accent,
  },
  progressText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
});
