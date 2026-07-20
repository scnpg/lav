import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { getMyReview, upsertBathroomReview, uploadReviewPhoto } from "../../features/bathrooms/ratingsApi";
import { useAuth } from "../../lib/auth";
import { cardShadow, colors, fontSize, fontWeight, radii, spacing } from "../../theme";
import type { BathroomReview } from "../../types/database";
import { FormStatusBanner, type FormStatus } from "./EditableFieldControls";

interface RateBathroomModalProps {
  bathroomId: string;
  bathroomName: string;
  onClose: () => void;
  onSaved?: (review: BathroomReview) => void;
}

// Common stops across the 0.0-10.0 range, not the full 101-value set - fast
// taps for the common case, the text field next to it covers everything
// in between for someone who wants to type e.g. 6.3 exactly.
const QUICK_SCORES = [4, 5, 6, 7, 7.5, 8, 8.5, 9, 9.5, 10];

function clampOverall(value: number): number {
  return Math.min(10, Math.max(0, Math.round(value * 10) / 10));
}

// The Beli-style scorecard: one overall 0.0-10.0 rating plus four 1-5
// sub-scores, matching bathroom_reviews' shape 1:1 (see
// supabase/migrations/0016_bathroom_reviews.sql). Upserts - opening this on
// a bathroom you've already rated pre-fills your existing scores and updates
// that same row instead of creating a second one.
export function RateBathroomModal({ bathroomId, bathroomName, onClose, onSaved }: RateBathroomModalProps) {
  const { user } = useAuth();
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [existingReview, setExistingReview] = useState<BathroomReview | null>(null);
  const [overallText, setOverallText] = useState("8.0");
  const [cleanliness, setCleanliness] = useState(0);
  const [smell, setSmell] = useState(0);
  const [ambience, setAmbience] = useState(0);
  const [privacy, setPrivacy] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<FormStatus | null>(null);

  useEffect(() => {
    if (!user) {
      setLoadingExisting(false);
      return;
    }
    let cancelled = false;
    getMyReview(bathroomId, user.id).then((review) => {
      if (cancelled) return;
      if (review) {
        setExistingReview(review);
        setOverallText(review.overall_rating.toFixed(1));
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
  }, [bathroomId, user]);

  const overallValue = Number(overallText);
  const isOverallValid =
    overallText.trim().length > 0 && !Number.isNaN(overallValue) && overallValue >= 0 && overallValue <= 10;
  const canSubmit = isOverallValid && !submitting && !!user;

  async function handlePickPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setStatus({ type: "error", message: "Enable photo library access to attach a photo." });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;
    setPhotoUri(result.assets[0].uri);
  }

  async function handleSubmit() {
    if (!user || !canSubmit) return;
    setSubmitting(true);
    setStatus(null);
    try {
      const review = await upsertBathroomReview({
        bathroom_id: bathroomId,
        user_id: user.id,
        overall_rating: clampOverall(overallValue),
        cleanliness_score: cleanliness || null,
        smell_score: smell || null,
        ambience_score: ambience || null,
        privacy_score: privacy || null,
        review_text: reviewText.trim() || null,
      });
      if (photoUri) {
        setUploadingPhoto(true);
        try {
          await uploadReviewPhoto(bathroomId, user.id, photoUri, review.id);
        } finally {
          setUploadingPhoto(false);
        }
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
              {bathroomName}
            </Text>
          </View>
          <Pressable onPress={onClose} style={styles.closeButton} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>

        <FormStatusBanner status={status} />

        {loadingExisting ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator color={colors.accentStrong} />
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
              <View style={styles.overallInputRow}>
                <TextInput
                  value={overallText}
                  onChangeText={setOverallText}
                  keyboardType="decimal-pad"
                  style={styles.overallInput}
                  maxLength={4}
                />
                <Text style={styles.overallScale}>/ 10.0</Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.quickScoreRow}
              >
                {QUICK_SCORES.map((score) => {
                  const active = Number(overallText) === score;
                  return (
                    <Pressable
                      key={score}
                      onPress={() => setOverallText(score.toFixed(1))}
                      style={[styles.quickScoreChip, active && styles.quickScoreChipActive]}
                    >
                      <Text style={[styles.quickScoreText, active && styles.quickScoreTextActive]}>
                        {score.toFixed(1)}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              {!isOverallValid ? <Text style={styles.errorText}>Enter a score between 0.0 and 10.0.</Text> : null}
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

            <Pressable style={styles.photoButton} onPress={handlePickPhoto}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.photoPreview} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Ionicons name="camera-outline" size={20} color={colors.textSecondary} />
                </View>
              )}
              <Text style={styles.photoButtonText}>{photoUri ? "Change photo" : "Attach a photo"}</Text>
            </Pressable>
          </ScrollView>
        )}

        <Pressable
          style={[
            styles.submitButton,
            (!canSubmit || uploadingPhoto || status?.type === "success") && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!canSubmit || uploadingPhoto || status?.type === "success"}
        >
          {submitting || uploadingPhoto ? (
            <ActivityIndicator color={colors.textOnAccent} />
          ) : (
            <Text style={styles.submitButtonText}>{existingReview ? "Update rating" : "Save rating"}</Text>
          )}
        </Pressable>
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
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
  overallInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  overallInput: {
    fontSize: fontSize["2xl"],
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    height: 52,
    minWidth: 100,
    textAlign: "center",
  },
  overallScale: {
    fontSize: fontSize.base,
    color: colors.textMuted,
  },
  quickScoreRow: {
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  quickScoreChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: colors.sandMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickScoreChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  quickScoreText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  quickScoreTextActive: {
    color: colors.textOnAccent,
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
  photoButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  photoPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.accentMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  photoPreview: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
  },
  photoButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.accentStrong,
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
