import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LevelBadge } from "../../src/components/LevelBadge";
import { Toast } from "../../src/components/Toast";
import { BathroomActionPanel } from "../../src/components/bathroom/BathroomActionPanel";
import { DetailsGrid } from "../../src/components/bathroom/DetailsGrid";
import { MediaCarousel } from "../../src/components/bathroom/MediaCarousel";
import { PhotoGallery } from "../../src/components/bathroom/PhotoGallery";
import { RateBathroomModal } from "../../src/components/bathroom/RateBathroomModal";
import { RatingHeader } from "../../src/components/bathroom/RatingHeader";
import { ReportBathroomModal } from "../../src/components/bathroom/ReportBathroomModal";
import { SaveToCollectionModal } from "../../src/components/bathroom/SaveToCollectionModal";
import { SubScoreBreakdown } from "../../src/components/bathroom/SubScoreBreakdown";
import { TAG_LABELS } from "../../src/constants/tags";
import { getBathroomById } from "../../src/features/bathrooms/api";
import {
  getBathroomImages,
  getBathroomReviewStats,
  getMyReview,
  getReviewsForBathroom,
  uploadReviewPhoto,
  type BathroomReviewWithAuthor,
} from "../../src/features/bathrooms/ratingsApi";
import { getListsContainingBathroom } from "../../src/features/lists/api";
import { useAuth } from "../../src/lib/auth";
import { formatRelativeTime } from "../../src/lib/format";
import { cardShadow, colors, fontSize, fontWeight, spacing } from "../../src/theme";
import type { BathroomImage, BathroomPublic, BathroomReviewStats } from "../../src/types/database";
import type { VibeTag } from "../../src/types/enums";

// Real detail screen - previously rendered MOCK_BATHROOMS only. Every
// section here reads live data: bathrooms (api.ts), review aggregates +
// images + text reviews (ratingsApi.ts, the new 0.0-10.0 rating engine).
export default function BathroomDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [bathroom, setBathroom] = useState<BathroomPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [stats, setStats] = useState<BathroomReviewStats | null>(null);
  const [yourRating, setYourRating] = useState<number | null>(null);
  const [images, setImages] = useState<BathroomImage[]>([]);
  const [reviews, setReviews] = useState<BathroomReviewWithAuthor[]>([]);
  const [inAnyCollection, setInAnyCollection] = useState(false);
  const [checkingCollections, setCheckingCollections] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showReportToast, setShowReportToast] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [bathroomRow, statsRow, imageRows, reviewRows] = await Promise.all([
        getBathroomById(id),
        getBathroomReviewStats(id),
        getBathroomImages(id),
        getReviewsForBathroom(id),
      ]);
      setBathroom(bathroomRow);
      setStats(statsRow);
      setImages(imageRows);
      setReviews(reviewRows);
      if (user) {
        const [mine, memberOf] = await Promise.all([getMyReview(id, user.id), getListsContainingBathroom(user.id, id)]);
        setYourRating(mine?.overall_rating ?? null);
        setInAnyCollection(memberOf.size > 0);
      } else {
        setYourRating(null);
        setInAnyCollection(false);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Couldn't load this bathroom.");
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => {
    load();
  }, [load]);

  function handleNavigate() {
    if (!bathroom) return;
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${bathroom.latitude},${bathroom.longitude}`);
  }

  function handleOpenSaveModal() {
    if (!user) {
      router.push("/auth/sign-in");
      return;
    }
    setShowSaveModal(true);
  }

  async function handleCloseSaveModal() {
    setShowSaveModal(false);
    if (!user || !bathroom) return;
    setCheckingCollections(true);
    try {
      const memberOf = await getListsContainingBathroom(user.id, bathroom.id);
      setInAnyCollection(memberOf.size > 0);
    } finally {
      setCheckingCollections(false);
    }
  }

  async function handleAddPhoto() {
    if (!bathroom) return;
    if (!user) {
      router.push("/auth/sign-in");
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;
    setUploadingPhoto(true);
    try {
      const image = await uploadReviewPhoto(bathroom.id, user.id, result.assets[0].uri);
      setImages((prev) => [...prev, image]);
    } catch {
      // A failed upload just doesn't add a photo - nothing to roll back.
    } finally {
      setUploadingPhoto(false);
    }
  }

  function handleRateAndLog() {
    if (!user) {
      router.push("/auth/sign-in");
      return;
    }
    setShowRatingModal(true);
  }

  function handleSuggestEdit() {
    if (!bathroom) return;
    if (!user) {
      router.push("/auth/sign-in");
      return;
    }
    router.push({ pathname: "/bathrooms/submit", params: { bathroomId: bathroom.id } });
  }

  function handleOpenReportModal() {
    if (!user) {
      router.push("/auth/sign-in");
      return;
    }
    setShowReportModal(true);
  }

  function handleReportSubmitted() {
    setShowReportModal(false);
    setShowReportToast(true);
    setTimeout(() => setShowReportToast(false), 2500);
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator color={colors.accentStrong} />
      </View>
    );
  }

  if (loadError || !bathroom) {
    return (
      <View style={styles.notFoundContainer}>
        <Text style={styles.notFoundTitle}>Couldn't load this bathroom</Text>
        <Text style={styles.notFoundText}>{loadError ?? "It may have been removed."}</Text>
        <Pressable style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const neighborhood = [bathroom.city, bathroom.region].filter(Boolean).join(", ");
  const locationLine = [bathroom.address, neighborhood].filter(Boolean).join(" · ");
  const reviewsWithText = reviews.filter((r) => r.review_text && r.review_text.trim().length > 0);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing["2xl"] }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroWrapper}>
          <MediaCarousel images={images} />
          <Pressable
            style={[styles.backButton, { top: insets.top + spacing.sm }, cardShadow("md")]}
            onPress={() => router.back()}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </Pressable>
          <Pressable
            style={[styles.reportButton, { top: insets.top + spacing.sm }, cardShadow("md")]}
            onPress={handleOpenReportModal}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Report this bathroom"
          >
            <Ionicons name="flag-outline" size={19} color={colors.textPrimary} />
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

          <RatingHeader
            globalScore={stats?.avg_overall ?? null}
            reviewCount={stats?.review_count ?? 0}
            yourRating={yourRating}
          />

          <Pressable style={styles.rateButton} onPress={handleRateAndLog}>
            <Ionicons name="star" size={18} color={colors.textOnAccent} />
            <Text style={styles.rateButtonText}>{yourRating !== null ? "Update your rating" : "Rate & log"}</Text>
          </Pressable>

          <BathroomActionPanel
            isInCollection={inAnyCollection}
            checkingCollections={checkingCollections}
            uploadingPhoto={uploadingPhoto}
            onNavigate={handleNavigate}
            onSaveToCollection={handleOpenSaveModal}
            onAddPhoto={handleAddPhoto}
            onSuggestEdit={handleSuggestEdit}
          />

          <SubScoreBreakdown
            cleanliness={stats?.avg_cleanliness ?? null}
            smell={stats?.avg_smell ?? null}
            ambience={stats?.avg_ambience ?? null}
            privacy={stats?.avg_privacy ?? null}
          />

          <DetailsGrid bathroom={bathroom} />

          <PhotoGallery images={images} />

          {reviewsWithText.length > 0 ? (
            <View style={styles.reviewsSection}>
              <Text style={styles.sectionTitle}>Reviews ({reviewsWithText.length})</Text>
              {reviewsWithText.map((review) => (
                <View key={review.id} style={styles.reviewCard}>
                  <View style={styles.reviewHeaderRow}>
                    <Pressable
                      style={styles.reviewAuthorRow}
                      onPress={() => review.user_id && router.push(`/profile/${review.user_id}`)}
                      hitSlop={4}
                    >
                      <View style={styles.reviewAvatar}>
                        {review.author?.avatar_url ? (
                          <Image source={{ uri: review.author.avatar_url }} style={styles.reviewAvatarImage} />
                        ) : (
                          <Text style={styles.reviewAvatarInitial}>
                            {(review.author?.display_name || review.author?.username || "?").charAt(0).toUpperCase()}
                          </Text>
                        )}
                      </View>
                      <View style={styles.reviewAuthorText}>
                        <Text style={styles.reviewAuthor} numberOfLines={1}>
                          {review.author?.display_name || review.author?.username || "Someone"}
                        </Text>
                        {review.author ? <LevelBadge level={review.author.level} /> : null}
                      </View>
                    </Pressable>
                    <View style={styles.reviewScoreBadge}>
                      <Ionicons name="star" size={11} color={colors.gold} />
                      <Text style={styles.reviewScoreText}>{review.overall_rating.toFixed(1)}</Text>
                    </View>
                  </View>
                  <Text style={styles.reviewTime}>{formatRelativeTime(review.created_at)}</Text>
                  <Text style={styles.reviewText}>{review.review_text}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>

      {showRatingModal ? (
        <RateBathroomModal
          bathroom={bathroom}
          onClose={() => setShowRatingModal(false)}
          onSaved={(review) => {
            setYourRating(review.overall_rating);
            load();
          }}
        />
      ) : null}

      {showSaveModal && user ? (
        <SaveToCollectionModal bathroomId={bathroom.id} userId={user.id} onClose={handleCloseSaveModal} />
      ) : null}

      {showReportModal && user ? (
        <ReportBathroomModal
          bathroomId={bathroom.id}
          userId={user.id}
          onClose={() => setShowReportModal(false)}
          onSubmitted={handleReportSubmitted}
        />
      ) : null}

      <Toast message="Report submitted - thank you!" visible={showReportToast} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
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
  reportButton: {
    position: "absolute",
    right: spacing.lg,
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
  rateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: 999,
    height: 52,
  },
  rateButtonText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.textOnAccent,
  },
  reviewsSection: {
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  reviewCard: {
    gap: 4,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  reviewHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  reviewAuthorRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  reviewAvatar: {
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: colors.accentMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewAvatarImage: {
    width: 30,
    height: 30,
    borderRadius: 999,
  },
  reviewAvatarInitial: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  reviewAuthorText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  reviewAuthor: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  reviewScoreBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.goldMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 999,
  },
  reviewScoreText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  reviewTime: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  reviewText: {
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    marginTop: 2,
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
