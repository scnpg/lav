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
// progress-to-next-tier bar regardless of locked/unlocked. Width is owned
// by the parent ResponsiveGrid, not this component - the card itself just
// fills whatever column width it's given.
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
      <View style={styles.topRow}>
        <View style={[styles.iconCircle, isUnlocked ? styles.iconCircleUnlocked : styles.iconCircleLocked]}>
          <Ionicons name={badge.icon} size={18} color={colors.textPrimary} />
        </View>
        <View style={styles.titleBlock}>
          <Text style={styles.name} numberOfLines={1}>
            {badge.name}
          </Text>
          <Text style={[styles.status, isUnlocked ? styles.statusUnlocked : styles.statusLocked]} numberOfLines={1}>
            {statusLabel}
          </Text>
        </View>
      </View>
      <Text style={styles.description} numberOfLines={2}>
        {badge.description}
      </Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>
      <Text style={styles.progressText}>
        {nextTier ? `${currentValue} / ${nextTier.threshold}` : `${currentValue} / ${floor} - max tier`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    backgroundColor: colors.sandMuted,
    borderRadius: radii.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: 6,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  iconCircle: {
    width: 38,
    height: 38,
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
  titleBlock: {
    flex: 1,
    gap: 1,
  },
  name: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  status: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  statusUnlocked: {
    color: colors.accentStrong,
  },
  statusLocked: {
    color: colors.textMuted,
  },
  description: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: fontSize.sm * 1.35,
  },
  track: {
    height: 6,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    overflow: "hidden",
    marginTop: 2,
  },
  fill: {
    height: 6,
    borderRadius: radii.full,
    backgroundColor: colors.accent,
  },
  progressText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
});
