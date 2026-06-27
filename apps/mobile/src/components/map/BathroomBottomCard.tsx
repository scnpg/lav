import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ACCESS_TYPE_LABELS, COST_TYPE_LABELS } from "../../constants/enumLabels";
import { TAG_LABELS } from "../../constants/tags";
import { formatDistance, formatScore } from "../../lib/format";
import { cardShadow, colors, fontSize, fontWeight, radii, spacing } from "../../theme";
import type { BathroomNearby } from "../../types/database";
import type { VibeTag } from "../../types/enums";

interface BathroomBottomCardProps {
  bathroom: BathroomNearby;
  onClose: () => void;
}

export function BathroomBottomCard({ bathroom, onClose }: BathroomBottomCardProps) {
  return (
    <View style={[styles.card, cardShadow("md")]}>
      <Pressable onPress={onClose} style={styles.closeButton} hitSlop={8}>
        <Ionicons name="close" size={18} color={colors.textSecondary} />
      </Pressable>

      <Text style={styles.name} numberOfLines={1}>
        {bathroom.name}
      </Text>
      {bathroom.venue_name ? (
        <Text style={styles.venue} numberOfLines={1}>
          {bathroom.venue_name}
        </Text>
      ) : null}

      <View style={styles.metaRow}>
        <View style={styles.scoreBadge}>
          <Ionicons name="star" size={12} color={colors.gold} />
          <Text style={styles.scoreText}>{formatScore(bathroom.overall_score)}</Text>
        </View>
        <Text style={styles.metaText}>{formatDistance(bathroom.distance_meters)}</Text>
        {bathroom.access_type ? (
          <Text style={styles.metaText}>{ACCESS_TYPE_LABELS[bathroom.access_type]}</Text>
        ) : null}
        {bathroom.cost_type ? <Text style={styles.metaText}>{COST_TYPE_LABELS[bathroom.cost_type]}</Text> : null}
      </View>

      {bathroom.tags.length > 0 ? (
        <View style={styles.tagRow}>
          {bathroom.tags.slice(0, 4).map((tag) => (
            <View key={tag} style={styles.tagChip}>
              <Text style={styles.tagText}>{TAG_LABELS[tag as VibeTag] ?? tag}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    margin: spacing.lg,
  },
  closeButton: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    padding: spacing.xs,
  },
  name: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    paddingRight: spacing["2xl"],
  },
  venue: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.sm,
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
  scoreText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  metaText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  tagChip: {
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  tagText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
  },
});
