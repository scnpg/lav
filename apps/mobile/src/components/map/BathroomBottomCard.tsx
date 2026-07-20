import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { ACCESS_TYPE_LABELS, COST_TYPE_LABELS } from "../../constants/enumLabels";
import { TAG_LABELS } from "../../constants/tags";
import { isBathroomSaved, toggleBookmark } from "../../features/bathrooms/api";
import { useAuth } from "../../lib/auth";
import { formatDistance, formatScore } from "../../lib/format";
import { cardShadow, colors, fontSize, fontWeight, radii, spacing } from "../../theme";
import type { BathroomNearby } from "../../types/database";
import type { VibeTag } from "../../types/enums";

interface BathroomBottomCardProps {
  bathroom: BathroomNearby;
  onClose: () => void;
  onEditPress?: () => void;
  onRatePress?: () => void;
}

export function BathroomBottomCard({ bathroom, onClose, onEditPress, onRatePress }: BathroomBottomCardProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [isSaved, setIsSaved] = useState(false);
  const [bookmarkBusy, setBookmarkBusy] = useState(false);

  // Re-checks whenever the card switches to a different bathroom (or the
  // user signs in/out) - deliberately not carried over from a previous
  // bathroom's state.
  useEffect(() => {
    if (!user) {
      setIsSaved(false);
      return;
    }
    let cancelled = false;
    isBathroomSaved(bathroom.id, user.id).then((saved) => {
      if (!cancelled) setIsSaved(saved);
    });
    return () => {
      cancelled = true;
    };
  }, [bathroom.id, user]);

  async function handleToggleBookmark() {
    if (!user) {
      router.push("/auth/sign-in");
      return;
    }
    if (bookmarkBusy) return;
    setBookmarkBusy(true);
    try {
      const nextSaved = await toggleBookmark(bathroom.id, user.id, isSaved);
      setIsSaved(nextSaved);
    } catch {
      // Silently ignored - the icon just stays at its last known state,
      // consistent with this being a lightweight, low-stakes toggle rather
      // than a form submission that needs its own error banner.
    } finally {
      setBookmarkBusy(false);
    }
  }

  return (
    <View style={[styles.card, cardShadow("md")]}>
      <View style={styles.topRightControls}>
        <Pressable
          onPress={handleToggleBookmark}
          style={styles.bookmarkButton}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={isSaved ? "Remove bookmark" : "Save bookmark"}
        >
          {bookmarkBusy ? (
            <ActivityIndicator size="small" color={colors.accentStrong} />
          ) : (
            <Ionicons
              name={isSaved ? "heart" : "heart-outline"}
              size={19}
              color={isSaved ? colors.danger : colors.textSecondary}
            />
          )}
        </Pressable>
        <Pressable onPress={onClose} style={styles.closeButton} hitSlop={8}>
          <Ionicons name="close" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>

      <Pressable onPress={() => router.push(`/bathrooms/${bathroom.id}`)}>
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
          <View style={styles.distanceBadge}>
            <Ionicons name="navigate-outline" size={11} color={colors.textPrimary} />
            <Text style={styles.distanceText}>{formatDistance(bathroom.distance_meters)}</Text>
          </View>
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

        {onRatePress ? (
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              if (!user) {
                router.push("/auth/sign-in");
                return;
              }
              onRatePress();
            }}
            style={styles.rateButton}
            hitSlop={4}
          >
            <Ionicons name="star" size={16} color={colors.textOnAccent} />
            <Text style={styles.rateButtonText}>Rate & log</Text>
          </Pressable>
        ) : null}

        <View style={styles.footerRow}>
          {onEditPress ? (
            user ? (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  onEditPress();
                }}
                style={styles.editButton}
                hitSlop={8}
              >
                <Ionicons name="pencil-outline" size={13} color={colors.accentStrong} />
                <Text style={styles.editButtonText}>Edit info</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  router.push("/auth/sign-in");
                }}
                style={styles.editButton}
                hitSlop={8}
              >
                <Ionicons name="log-in-outline" size={13} color={colors.textMuted} />
                <Text style={styles.signInPromptText}>Sign in to edit</Text>
              </Pressable>
            )
          ) : (
            <View />
          )}

          <View style={styles.detailsLinkRow}>
            <Text style={styles.detailsLinkText}>View details</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.textPrimary} />
          </View>
        </View>
      </Pressable>
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
  topRightControls: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    zIndex: 1,
  },
  bookmarkButton: {
    padding: spacing.xs,
  },
  closeButton: {
    padding: spacing.xs,
  },
  name: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    paddingRight: spacing["3xl"],
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
  distanceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.skyMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  distanceText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  tagChip: {
    backgroundColor: colors.sand,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  tagText: {
    fontSize: fontSize.xs,
    color: colors.textPrimary,
    fontWeight: fontWeight.medium,
  },
  rateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    backgroundColor: colors.accent,
    borderRadius: radii.full,
    height: 40,
    marginTop: spacing.md,
  },
  rateButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textOnAccent,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md,
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  editButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.accentStrong,
  },
  signInPromptText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textMuted,
  },
  detailsLinkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  detailsLinkText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
});
