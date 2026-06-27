import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { formatScore } from "../../lib/format";
import { colors, fontSize, fontWeight, radii, spacing } from "../../theme";

interface ScoreSectionProps {
  overallScore: number;
  reviewCount: number;
  cleanliness: number;
  safety: number;
  privacy: number;
  smell: number;
  prestige: number;
}

const BREAKDOWN_LABELS = ["Cleanliness", "Safety", "Privacy", "Smell", "Prestige"] as const;

export function ScoreSection({
  overallScore,
  reviewCount,
  cleanliness,
  safety,
  privacy,
  smell,
  prestige,
}: ScoreSectionProps) {
  const breakdownValues = [cleanliness, safety, privacy, smell, prestige];

  return (
    <View style={styles.container}>
      <View style={styles.heroRow}>
        <Ionicons name="star" size={28} color={colors.gold} />
        <Text style={styles.heroScore}>{formatScore(overallScore)}</Text>
        <Text style={styles.heroReviewCount}>{reviewCount} reviews</Text>
      </View>

      <View style={styles.perspectiveRow}>
        <PerspectiveCard label="Your score" placeholder="Not rated yet" />
        <PerspectiveCard label="Friends" placeholder="Sign in to see" />
        <PerspectiveCard label="Global" value={overallScore} />
      </View>

      <View style={styles.breakdownList}>
        {BREAKDOWN_LABELS.map((label, index) => (
          <ScoreBar key={label} label={label} value={breakdownValues[index]!} />
        ))}
      </View>
    </View>
  );
}

function PerspectiveCard({ label, value, placeholder }: { label: string; value?: number; placeholder?: string }) {
  return (
    <View style={styles.perspectiveCard}>
      <Text style={styles.perspectiveLabel}>{label}</Text>
      {value !== undefined ? (
        <Text style={styles.perspectiveValue}>{formatScore(value)}</Text>
      ) : (
        <Text style={styles.perspectivePlaceholder}>{placeholder}</Text>
      )}
    </View>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(1, value / 5)) * 100;
  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%` }]} />
      </View>
      <Text style={styles.barValue}>{formatScore(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  heroScore: {
    fontSize: fontSize["2xl"],
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  heroReviewCount: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  perspectiveRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  perspectiveCard: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    gap: 2,
  },
  perspectiveLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
  },
  perspectiveValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  perspectivePlaceholder: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: "center",
  },
  breakdownList: {
    gap: spacing.sm,
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  barLabel: {
    width: 84,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  barTrack: {
    flex: 1,
    height: 6,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceMuted,
    overflow: "hidden",
  },
  barFill: {
    height: 6,
    borderRadius: radii.full,
    backgroundColor: colors.accent,
  },
  barValue: {
    width: 28,
    textAlign: "right",
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
});
