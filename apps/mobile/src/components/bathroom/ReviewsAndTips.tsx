import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import type { MockAccessTip, MockReview } from "../../features/bathrooms/mockData";
import { formatRelativeTime, formatScore } from "../../lib/format";
import { colors, fontSize, fontWeight, radii, spacing } from "../../theme";

function Avatar({ username }: { username: string }) {
  const initial = username.replace("@", "").charAt(0).toUpperCase();
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{initial}</Text>
    </View>
  );
}

interface AccessTipsSectionProps {
  tips: MockAccessTip[];
}

// Access tips are kept separate from reviews on purpose - they're "how do I
// get in" notes, not "how was it" opinions. None of these (and none should
// ever be added) contain an actual door code - see the "Important
// access-code rule" comment in src/constants/enumLabels.ts.
export function AccessTipsSection({ tips }: AccessTipsSectionProps) {
  if (tips.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Access tips</Text>
      {tips.map((tip) => (
        <View key={tip.id} style={styles.tipCard}>
          <Avatar username={tip.username} />
          <View style={styles.cardBody}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.username}>{tip.username}</Text>
              <Text style={styles.timeText}>{formatRelativeTime(tip.createdAt)}</Text>
            </View>
            <Text style={styles.tipNote}>{tip.note}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

interface ReviewsSectionProps {
  reviews: MockReview[];
}

export function ReviewsSection({ reviews }: ReviewsSectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Reviews ({reviews.length})</Text>
      {reviews.length === 0 ? (
        <Text style={styles.emptyText}>No reviews yet - be the first.</Text>
      ) : (
        reviews.map((review) => {
          const breakdown = (
            [
              ["Clean", review.cleanliness],
              ["Safety", review.safety],
              ["Privacy", review.privacy],
              ["Smell", review.smell],
            ] as const
          ).filter(([, value]) => value !== undefined) as [string, number][];

          return (
            <View key={review.id} style={styles.reviewCard}>
              <View style={styles.cardHeaderRow}>
                <Avatar username={review.username} />
                <View style={styles.reviewHeaderText}>
                  <Text style={styles.username}>{review.username}</Text>
                  <Text style={styles.timeText}>{formatRelativeTime(review.createdAt)}</Text>
                </View>
                <View style={styles.scoreBadge}>
                  <Ionicons name="star" size={12} color={colors.gold} />
                  <Text style={styles.scoreBadgeText}>{formatScore(review.overall)}</Text>
                </View>
              </View>
              <Text style={styles.caption}>{review.caption}</Text>
              {breakdown.length > 0 ? (
                <View style={styles.breakdownRow}>
                  {breakdown.map(([label, value]) => (
                    <View key={label} style={styles.breakdownChip}>
                      <Text style={styles.breakdownChipText}>
                        {label} {formatScore(value)}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: radii.full,
    backgroundColor: colors.accentMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  cardBody: {
    flex: 1,
    gap: 2,
  },
  username: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  timeText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  tipCard: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.sandMuted,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  tipNote: {
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    marginTop: 2,
  },
  reviewCard: {
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  reviewHeaderText: {
    flex: 1,
    gap: 1,
  },
  scoreBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.goldMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  scoreBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  caption: {
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },
  breakdownRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  breakdownChip: {
    backgroundColor: colors.sandMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  breakdownChipText: {
    fontSize: fontSize.xs,
    color: colors.textPrimary,
    fontWeight: fontWeight.medium,
  },
});
