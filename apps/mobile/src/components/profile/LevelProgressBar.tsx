import { StyleSheet, Text, View } from "react-native";

import { colors, fontSize, fontWeight, radii, spacing } from "../../theme";

interface LevelProgressBarProps {
  lavLevel: number;
  totalPoints: number;
  currentLevelStartPoints: number;
  nextLevelPoints: number;
}

export function LevelProgressBar({
  lavLevel,
  totalPoints,
  currentLevelStartPoints,
  nextLevelPoints,
}: LevelProgressBarProps) {
  const span = Math.max(1, nextLevelPoints - currentLevelStartPoints);
  const progressed = Math.max(0, Math.min(span, totalPoints - currentLevelStartPoints));
  const pct = (progressed / span) * 100;
  const pointsToGo = Math.max(0, nextLevelPoints - totalPoints);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.points}>{totalPoints} pts</Text>
        <Text style={styles.toGo}>{pointsToGo} to Level {lavLevel + 1}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  points: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  toGo: {
    fontSize: fontSize.xs,
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
});
