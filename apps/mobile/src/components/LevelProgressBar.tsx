import { StyleSheet, Text, View } from "react-native";

import { colors, fontSize, radii, spacing } from "../theme";

interface LevelProgressBarProps {
  points: number;
  level: number;
}

// Matches profiles.level's generated-column thresholds (see LevelBadge.tsx /
// 0020_gamification_points.sql: 1 = 0-99pts, 2 = 100-299, 3 = 300+, max).
// Index i is the point floor for level i+1.
const LEVEL_FLOORS = [0, 100, 300];
const MAX_LEVEL = LEVEL_FLOORS.length;

export function LevelProgressBar({ points, level }: LevelProgressBarProps) {
  const isMaxLevel = level >= MAX_LEVEL;
  const floor = LEVEL_FLOORS[level - 1] ?? 0;
  const ceiling = LEVEL_FLOORS[level] ?? floor;
  const percent = isMaxLevel ? 100 : Math.min(100, Math.max(0, ((points - floor) / (ceiling - floor)) * 100));

  return (
    <View style={styles.container}>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${percent}%` }]} />
      </View>
      <Text style={styles.label}>
        {isMaxLevel ? "Max level reached" : `${points - floor} / ${ceiling - floor} to level ${level + 1}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  track: {
    height: 6,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceMuted,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: radii.full,
    backgroundColor: colors.accent,
  },
  label: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
});
