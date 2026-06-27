import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ActionButtonsRow } from "../../src/components/bathroom/ActionButtonsRow";
import { DetailsGrid } from "../../src/components/bathroom/DetailsGrid";
import { PhotoCarousel } from "../../src/components/bathroom/PhotoCarousel";
import { AccessTipsSection, ReviewsSection } from "../../src/components/bathroom/ReviewsAndTips";
import { ScoreSection } from "../../src/components/bathroom/ScoreSection";
import { TAG_LABELS } from "../../src/constants/tags";
import { MOCK_BATHROOMS } from "../../src/features/bathrooms/mockData";
import { cardShadow, colors, fontSize, fontWeight, spacing } from "../../src/theme";
import type { VibeTag } from "../../src/types/enums";

// Mock-data-only detail screen - looks up MOCK_BATHROOMS by id, nothing
// hits Supabase. See PROJECT_HANDOFF.md for the swap-to-real-data plan
// (getBathroomById() in src/features/bathrooms/api.ts already exists for
// when that lands).
export default function BathroomDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bathroom = MOCK_BATHROOMS.find((b) => b.id === id);

  if (!bathroom) {
    return (
      <View style={styles.notFoundContainer}>
        <Text style={styles.notFoundTitle}>Bathroom not found</Text>
        <Text style={styles.notFoundText}>This is mock data only - "{id}" doesn't match any bathroom yet.</Text>
        <Pressable style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const neighborhood = [bathroom.city, bathroom.region].filter(Boolean).join(", ");
  const locationLine = [bathroom.address, neighborhood].filter(Boolean).join(" · ");

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing["2xl"] }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroWrapper}>
          <PhotoCarousel photoLabels={bathroom.photoPlaceholders} />
          <Pressable
            style={[styles.backButton, { top: insets.top + spacing.sm }, cardShadow("md")]}
            onPress={() => router.back()}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </Pressable>
        </View>

        <View style={styles.content}>
          <View style={styles.titleBlock}>
            <Text style={styles.name}>{bathroom.name}</Text>
            {bathroom.venue_name ? <Text style={styles.venue}>{bathroom.venue_name}</Text> : null}
            {locationLine ? <Text style={styles.address}>{locationLine}</Text> : null}

            {bathroom.tags.length > 0 ? (
              <View style={styles.tagRow}>
                {bathroom.tags.map((tag) => (
                  <View key={tag} style={styles.tagChip}>
                    <Text style={styles.tagChipText}>{TAG_LABELS[tag as VibeTag] ?? tag}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          <ScoreSection
            overallScore={bathroom.overall_score}
            reviewCount={bathroom.review_count}
            cleanliness={bathroom.cleanliness_score}
            safety={bathroom.safety_score}
            privacy={bathroom.privacy_score}
            smell={bathroom.smell_score}
            prestige={bathroom.prestige_score}
          />

          <ActionButtonsRow bathroomName={bathroom.name} />

          <DetailsGrid bathroom={bathroom} />

          <AccessTipsSection tips={bathroom.accessTips} />
          <ReviewsSection reviews={bathroom.reviews} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  heroWrapper: {
    position: "relative",
  },
  backButton: {
    position: "absolute",
    left: spacing.lg,
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    padding: spacing.lg,
    gap: spacing["2xl"],
  },
  titleBlock: {
    gap: spacing.xs,
  },
  name: {
    fontSize: fontSize["2xl"],
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  venue: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
  },
  address: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  tagChip: {
    backgroundColor: colors.sand,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
  },
  tagChipText: {
    fontSize: fontSize.xs,
    color: colors.textPrimary,
    fontWeight: fontWeight.medium,
  },
  notFoundContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing["2xl"],
    gap: spacing.md,
  },
  notFoundTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  notFoundText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: "center",
  },
  backLink: {
    marginTop: spacing.md,
  },
  backLinkText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
});
