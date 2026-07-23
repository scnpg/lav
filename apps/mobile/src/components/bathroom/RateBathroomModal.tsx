import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { ArabesqueDivider } from "../ArabesqueDivider";
import { ArabesqueLoader } from "../ArabesqueLoader";
import { ALL_AMENITIES, AMENITY_LABELS } from "../../constants/amenities";
import { ACCESS_TYPE_LABELS, COST_TYPE_LABELS, GENDER_CATEGORY_LABELS, TOILET_TYPE_LABELS } from "../../constants/enumLabels";
import { updateBathroomDetails } from "../../features/bathrooms/api";
import { getMyReview, upsertBathroomReview, uploadReviewPhoto } from "../../features/bathrooms/ratingsApi";
import { useAuth } from "../../lib/auth";
import { cardShadow, colors, fontSize, fontWeight, radii, spacing } from "../../theme";
import type { BathroomPublic, BathroomReview } from "../../types/database";
import { ACCESS_TYPES, COST_TYPES, GENDER_CATEGORIES, TOILET_TYPES, type AmenitiesMap, type AmenityKey } from "../../types/enums";
import { ChipSelectField, FormStatusBanner, TextField, type FormStatus } from "./EditableFieldControls";
import { PressableScale } from "../PressableScale";
import { RatingSlider } from "./RatingSlider";

// Pick, not the full BathroomPublic - BathroomNearby (the map screen's own
// bathroom shape) omits a few admin-only fields (submitted_by, verified_by,
// created_at, updated_at) this modal never touches anyway, and both callers
// (the map screen and the detail screen) already have one of these two
// types in scope, so this modal doesn't need to accept only one of them.
type RatableBathroom = Pick<
  BathroomPublic,
  "id" | "name" | "access_type" | "cost_type" | "cost_amount" | "gender_category" | "toilet_type" | "amenities"
>;

interface RateBathroomModalProps {
  bathroom: RatableBathroom;
  onClose: () => void;
  onSaved?: (review: BathroomReview) => void;
}

const ACCESS_TYPE_OPTIONS = ACCESS_TYPES.map((value) => ({ value, label: ACCESS_TYPE_LABELS[value] }));
const COST_TYPE_OPTIONS = COST_TYPES.map((value) => ({ value, label: COST_TYPE_LABELS[value] }));
const GENDER_CATEGORY_OPTIONS = GENDER_CATEGORIES.map((value) => ({ value, label: GENDER_CATEGORY_LABELS[value] }));
const TOILET_TYPE_OPTIONS = TOILET_TYPES.map((value) => ({ value, label: TOILET_TYPE_LABELS[value] }));
const MAX_PHOTOS = 6;

// The Beli-style scorecard: one overall 0-10 rating (slider, snaps to 0.5 -
// bathrooms.overall_score is now the *mode* across every rater, see
// 0028_mode_based_overall_score.sql, and a mode is only meaningful if raters
// actually land on shared values instead of arbitrary decimals) plus four
// 1-5 sub-scores, matching bathroom_reviews' shape 1:1. Upserts - opening
// this on a bathroom you've already rated pre-fills your existing scores and
// updates that same row instead of creating a second one.
//
// Also doubles as a "fill in what you noticed" form for the bathroom itself
// (access/cost/gender/toilet type, wheelchair/changing station) - same
// direct-write path as EditBathroomModal (updateBathroomDetails), not the
// bathroom_submissions moderation queue: these are objective, enum-constrained
// facts rather than free-text content, so there's nothing here for a human
// moderator to review. A failed detail patch doesn't block the rating itself
// from saving - same "best-effort, non-blocking" treatment as the photo
// attachment below.
export function RateBathroomModal({ bathroom, onClose, onSaved }: RateBathroomModalProps) {
  const { user } = useAuth();
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [existingReview, setExistingReview] = useState<BathroomReview | null>(null);
  const [overallValue, setOverallValue] = useState(8);
  const [cleanliness, setCleanliness] = useState(0);
  const [smell, setSmell] = useState(0);
  const [ambience, setAmbience] = useState(0);
  const [privacy, setPrivacy] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<FormStatus | null>(null);

  const [accessType, setAccessType] = useState(bathroom.access_type);
  const [costType, setCostType] = useState(bathroom.cost_type);
  const [costAmountText, setCostAmountText] = useState(bathroom.cost_amount != null ? String(bathroom.cost_amount) : "");
  const [genderCategory, setGenderCategory] = useState(bathroom.gender_category);
  const [toiletType, setToiletType] = useState(bathroom.toilet_type);
  const [amenities, setAmenities] = useState<AmenitiesMap>(bathroom.amenities);

  function toggleAmenity(key: AmenityKey) {
    setAmenities((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  useEffect(() => {
    if (!user) {
      setLoadingExisting(false);
      return;
    }
    let cancelled = false;
    getMyReview(bathroom.id, user.id).then((review) => {
      if (cancelled) return;
      if (review) {
        setExistingReview(review);
        setOverallValue(review.overall_rating);
        setCleanliness(review.cleanliness_score ?? 0);
        setSmell(review.smell_score ?? 0);
        setAmbience(review.ambience_score ?? 0);
        setPrivacy(review.privacy_score ?? 0);
        setReviewText(review.review_text ?? "");
      }
      setLoadingExisting(false);
    });
    return () => {
      cancelled = true;
    };
  }, [bathroom.id, user]);

  const canSubmit = !!user && !submitting;

  async function handlePickPhoto() {
    if (photoUris.length >= MAX_PHOTOS) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setStatus({ type: "error", message: "Enable photo library access to attach photos." });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;
    setPhotoUris((prev) => [...prev, result.assets[0].uri]);
  }

  function handleRemovePhoto(uri: string) {
    setPhotoUris((prev) => prev.filter((existing) => existing !== uri));
  }

  async function handleSubmit() {
    if (!user || !canSubmit) return;
    setSubmitting(true);
    setStatus(null);
    try {
      const review = await upsertBathroomReview({
        bathroom_id: bathroom.id,
        user_id: user.id,
        overall_rating: overallValue,
        cleanliness_score: cleanliness || null,
        smell_score: smell || null,
        ambience_score: ambience || null,
        privacy_score: privacy || null,
        review_text: reviewText.trim() || null,
      });
      if (photoUris.length > 0) {
        setUploadingPhoto(true);
        try {
          await Promise.all(photoUris.map((uri) => uploadReviewPhoto(bathroom.id, user.id, uri, review.id)));
        } finally {
          setUploadingPhoto(false);
        }
      }
      try {
        const parsedCostAmount = costAmountText.trim() ? Number(costAmountText.trim()) : null;
        await updateBathroomDetails(bathroom.id, {
          access_type: accessType,
          cost_type: costType,
          cost_amount: parsedCostAmount !== null && !Number.isNaN(parsedCostAmount) ? parsedCostAmount : null,
          gender_category: genderCategory,
          toilet_type: toiletType,
          amenities,
        });
      } catch {
        // Best-effort enrichment - the rating itself already saved either way.
      }
      onSaved?.(review);
      setStatus({ type: "success", message: existingReview ? "Rating updated." : "Logged." });
      setTimeout(onClose, 700);
    } catch (err) {
      setStatus({ type: "error", message: err instanceof Error ? err.message : "Couldn't save your rating." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.overlay}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityLabel="Close"
        accessibilityRole="button"
      />

      <View style={[styles.sheet, cardShadow("md")]}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Rate & log</Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {bathroom.name}
            </Text>
          </View>
          <Pressable onPress={onClose} style={styles.closeButton} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>
        <View style={styles.headerDivider}>
          <ArabesqueDivider count={24} />
        </View>

        <FormStatusBanner status={status} />

        {loadingExisting ? (
          <View style={styles.loadingBlock}>
            <ArabesqueLoader size={36} color={colors.accentStrong} />
          </View>
        ) : (
          <ScrollView
            style={styles.form}
            contentContainerStyle={styles.formContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Overall score</Text>
              <RatingSlider value={overallValue} onValueChange={setOverallValue} min={0} max={10} step={0.5} />
            </View>

            <StarPickerRow label="Cleanliness" value={cleanliness} onChange={setCleanliness} />
            <StarPickerRow label="Smell" value={smell} onChange={setSmell} />
            <StarPickerRow label="Ambience" value={ambience} onChange={setAmbience} />
            <StarPickerRow label="Privacy" value={privacy} onChange={setPrivacy} />

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Notes</Text>
              <TextInput
                value={reviewText}
                onChangeText={setReviewText}
                placeholder="What stood out?"
                placeholderTextColor={colors.textMuted}
                style={styles.textArea}
                multiline
              />
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Photos</Text>
              <View style={styles.photoGrid}>
                {photoUris.map((uri) => (
                  <View key={uri} style={styles.photoThumbWrapper}>
                    <Image source={{ uri }} style={styles.photoThumb} />
                    <Pressable
                      style={styles.photoRemoveButton}
                      onPress={() => handleRemovePhoto(uri)}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel="Remove photo"
                    >
                      <Ionicons name="close" size={12} color={colors.textOnAccent} />
                    </Pressable>
                  </View>
                ))}
                {photoUris.length < MAX_PHOTOS ? (
                  <Pressable
                    style={styles.photoAddButton}
                    onPress={handlePickPhoto}
                    accessibilityRole="button"
                    accessibilityLabel="Add a photo"
                  >
                    <Ionicons name="camera-outline" size={20} color={colors.textSecondary} />
                  </Pressable>
                ) : null}
              </View>
            </View>

            <View style={styles.detailsSection}>
              <Text style={styles.detailsSectionTitle}>Help us fill in the details</Text>
              <ChipSelectField label="Access" options={ACCESS_TYPE_OPTIONS} value={accessType} onChange={setAccessType} />
              <ChipSelectField label="Cost" options={COST_TYPE_OPTIONS} value={costType} onChange={setCostType} />
              <TextField
                label="Cost amount"
                value={costAmountText}
                onChangeText={setCostAmountText}
                placeholder="e.g. 0.50"
              />
              <ChipSelectField
                label="Gender / accessibility"
                options={GENDER_CATEGORY_OPTIONS}
                value={genderCategory}
                onChange={setGenderCategory}
              />
              <ChipSelectField label="Toilet type" options={TOILET_TYPE_OPTIONS} value={toiletType} onChange={setToiletType} />

              <Text style={styles.fieldLabel}>Amenities</Text>
              <View style={styles.amenityGrid}>
                {ALL_AMENITIES.map((key) => {
                  const active = !!amenities[key];
                  return (
                    <Pressable
                      key={key}
                      style={[styles.amenityChip, active && styles.amenityChipActive]}
                      onPress={() => toggleAmenity(key)}
                    >
                      <Text style={[styles.amenityChipText, active && styles.amenityChipTextActive]}>
                        {AMENITY_LABELS[key]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </ScrollView>
        )}

        <PressableScale
          style={[
            styles.submitButton,
            (!canSubmit || uploadingPhoto || status?.type === "success") && styles.submitButtonDisabled,
          ]}
          borderRadius={radii.lg}
          onPress={handleSubmit}
          disabled={!canSubmit || uploadingPhoto || status?.type === "success"}
        >
          {submitting || uploadingPhoto ? (
            <ArabesqueLoader size={22} color={colors.textOnAccent} />
          ) : (
            <Text style={styles.submitButtonText}>{existingReview ? "Update rating" : "Save rating"}</Text>
          )}
        </PressableScale>
      </View>
    </View>
  );
}

function StarPickerRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <View style={styles.starRow}>
      <Text style={styles.starLabel}>{label}</Text>
      <View style={styles.starIcons}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => onChange(n === value ? 0 : n)} hitSlop={4}>
            <Ionicons name={n <= value ? "star" : "star-outline"} size={22} color={colors.gold} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "flex-end",
    backgroundColor: colors.overlay,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    maxHeight: "88%",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    padding: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerDivider: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    paddingRight: spacing.md,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  closeButton: {
    padding: spacing.xs,
  },
  loadingBlock: {
    paddingVertical: spacing["3xl"],
    alignItems: "center",
  },
  form: {
    flexGrow: 0,
  },
  formContent: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  fieldBlock: {
    gap: spacing.xs,
  },
  fieldLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  errorText: {
    fontSize: fontSize.xs,
    color: colors.danger,
  },
  starRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  starLabel: {
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },
  starIcons: {
    flexDirection: "row",
    gap: 4,
  },
  textArea: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    padding: spacing.md,
    minHeight: 80,
    fontSize: fontSize.base,
    color: colors.textPrimary,
    textAlignVertical: "top",
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  photoThumbWrapper: {
    position: "relative",
  },
  photoThumb: {
    width: 64,
    height: 64,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
  },
  photoRemoveButton: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: radii.full,
    backgroundColor: colors.textPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  photoAddButton: {
    width: 64,
    height: 64,
    borderRadius: radii.md,
    backgroundColor: colors.sandMuted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  amenityGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  amenityChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.sandMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  amenityChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  amenityChipText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  amenityChipTextActive: {
    color: colors.textOnAccent,
  },
  detailsSection: {
    gap: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  detailsSectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  submitButton: {
    margin: spacing.lg,
    marginTop: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: radii.lg,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: colors.textOnAccent,
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
});
