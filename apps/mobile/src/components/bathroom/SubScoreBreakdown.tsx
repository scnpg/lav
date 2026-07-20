import { StyleSheet, Text, View } from "react-native";

import { colors, fontSize, fontWeight, radii, spacing } from "../../theme";

interface SubScoreBreakdownProps {
  cleanliness: number | null;
  smell: number | null;
  ambience: number | null;
  privacy: number | null;
}

const ROWS: { key: keyof Omit<SubScoreBreakdownProps, never>; label: string }[] = [
  { key: "cleanliness", label: "Cleanliness" },
  { key: "smell", label: "Smell" },
  { key: "ambience", label: "Ambience" },
  { key: "privacy", label: "Privacy" },
];

// Sub-scores are 1-5 (see bathroom_reviews) - bars show why a bathroom
// scored the way it did, not just the single headline number.
export function SubScoreBreakdown(props: SubScoreBreakdownProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Breakdown</Text>
      <View style={styles.card}>
        {ROWS.map(({ key, label }) => {
          const value = props[key];
          const pct = value !== null ? Math.max(0, Math.min(1, value / 5)) * 100 : 0;
          return (
            <View key={key} style={styles.row}>
              <Text style={styles.rowLabel}>{label}</Text>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${pct}%` }]} />
              </View>
              <Text style={styles.rowValue}>{value !== null ? value.toFixed(1) : "—"}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  rowLabel: {
    width: 84,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  track: {
    flex: 1,
    height: 6,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceMuted,
    overflow: "hidden",
  },
  fill: {
    height: 6,
    borderRadius: radii.full,
    backgroundColor: colors.accent,
  },
  rowValue: {
    width: 28,
    textAlign: "right",
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
});
