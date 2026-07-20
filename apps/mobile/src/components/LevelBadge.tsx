import { StyleSheet, Text, View } from "react-native";

import { colors, fontSize, fontWeight, radii, spacing } from "../theme";

interface LevelBadgeProps {
  level: number;
  size?: "sm" | "md";
}

// Matches profiles.level's generated-column thresholds (see
// 0020_gamification_points.sql: 1 = 0-99pts, 2 = 100-299, 3 = 300+) - purely
// a display label, the number itself is the source of truth from the DB.
const LEVEL_LABELS: Record<number, string> = {
  1: "Rookie",
  2: "Regular",
  3: "Connoisseur",
};

export function LevelBadge({ level, size = "sm" }: LevelBadgeProps) {
  const label = LEVEL_LABELS[level] ?? `Tier ${level}`;
  return (
    <View style={[styles.badge, size === "md" && styles.badgeMd]}>
      <Text style={[styles.text, size === "md" && styles.textMd]}>
        Lv.{level} {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    backgroundColor: colors.accentMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  badgeMd: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  text: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.accentStrong,
  },
  textMd: {
    fontSize: fontSize.sm,
  },
});
