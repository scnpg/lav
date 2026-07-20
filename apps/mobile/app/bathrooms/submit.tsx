import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Toast } from "../../src/components/Toast";
import { ChipSelectField } from "../../src/components/bathroom/EditableFieldControls";
import { PinPickerMap } from "../../src/components/map/PinPickerMap";
import { ALL_AMENITIES, AMENITY_LABELS } from "../../src/constants/amenities";
import { ACCESS_TYPE_LABELS } from "../../src/constants/enumLabels";
import { getBathroomById } from "../../src/features/bathrooms/api";
import {
  submitBathroomAmendment,
  submitNewBathroom,
  uploadSubmissionPhoto,
} from "../../src/features/submissions/api";
import { useLiveLocation } from "../../src/hooks/useLiveLocation";
import { useAuth } from "../../src/lib/auth";
import { DEFAULT_MAP_CENTER } from "../../src/lib/mapStyle";
import { colors, fontSize, fontWeight, radii, spacing } from "../../src/theme";
import type { BathroomPublic } from "../../src/types/database";
import { ACCESS_TYPES, type AccessType, type AmenitiesMap, type AmenityKey } from "../../src/types/enums";

const ACCESS_TYPE_OPTIONS = ACCESS_TYPES.map((value) => ({ value, label: ACCESS_TYPE_LABELS[value] }));
const MAX_PHOTOS = 6;

// The map-pin submission wizard - a new pin (pan-to-position under a fixed
// crosshair, see PinPickerMap) when no ?bathroomId is present, or a
// suggested amendment to an existing bathroom (coordinates locked, name
// pre-filled) when one is. Both paths submit to bathroom_submissions - a
// staging queue an admin actions later - never straight to `bathrooms`
// itself. That's a deliberate second path alongside the existing
// AddBathroomModal/EditBathroomModal (which still write directly, unchanged).
export default function SubmitBathroomScreen() {
  const { bathroomId } = useLocalSearchParams<{ bathroomId?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { coords: userLocation } = useLiveLocation();

  const isAmendment = !!bathroomId;

  const [existingBathroom, setExistingBathroom] = useState<BathroomPublic | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(isAmendment);
  const [center, setCenter] = useState(DEFAULT_MAP_CENTER);
  const [name, setName] = useState("");
  const [amenities, setAmenities] = useState<AmenitiesMap>({});
  const [accessType, setAccessType] = useState<AccessType | null>(null);
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);

  // New-pin mode: recenter on the user's live GPS fix the moment it arrives
  // (starts at DEFAULT_MAP_CENTER until then). Amendment mode ignores this -
  // the existing bathroom's own location always wins, set by the effect below.
  useEffect(() => {
    if (!isAmendment && userLocation) setCenter(userLocation);
  }, [isAmendment, userLocation]);

  useEffect(() => {
    if (!isAmendment || !bathroomId) return;
    let cancelled = false;
    getBathroomById(bathroomId).then((bathroom) => {
      if (cancelled) return;
      if (bathroom) {
        setExistingBathroom(bathroom);
        setCenter({ latitude: bathroom.latitude, longitude: bathroom.longitude });
        setName(bathroom.name);
        setAccessType(bathroom.access_type);
      }
      setLoadingExisting(false);
    });
    return () => {
      cancelled = true;
    };
  }, [isAmendment, bathroomId]);

  function toggleAmenity(key: AmenityKey) {
    setAmenities((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  // Reached via a tab redirect (app/(tabs)/submit.tsx uses <Redirect>, which
  // replaces rather than pushes) as well as a normal push from the map FAB
  // or a bathroom's "Suggest edit" - only the push case leaves a screen to
  // go back to. Falls back to the map tab instead of letting
  // router.back() throw "GO_BACK was not handled by any navigator".
  function handleBack() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  }

  async function handlePickPhoto() {
    if (photoUris.length >= MAX_PHOTOS) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Enable photo library access to attach photos.");
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

  const canSubmit = !!user && (isAmendment || name.trim().length > 0);

  async function handleSubmit() {
    if (!canSubmit || !user || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      let photoUrls: string[] = [];
      if (photoUris.length > 0) {
        setUploadingPhotos(true);
        try {
          photoUrls = await Promise.all(photoUris.map((uri) => uploadSubmissionPhoto(user.id, uri)));
        } finally {
          setUploadingPhotos(false);
        }
      }
      if (isAmendment && bathroomId) {
        await submitBathroomAmendment({
          userId: user.id,
          bathroomId,
          name: name.trim() && name.trim() !== existingBathroom?.name ? name.trim() : undefined,
          amenities,
          accessType: accessType !== (existingBathroom?.access_type ?? null) ? accessType : undefined,
          photoUrls,
        });
      } else {
        await submitNewBathroom({
          userId: user.id,
          name: name.trim(),
          latitude: center.latitude,
          longitude: center.longitude,
          amenities,
          accessType,
          photoUrls,
        });
      }
      setShowToast(true);
      setTimeout(handleBack, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!user) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Sign in to submit a bathroom.</Text>
        <Pressable style={styles.backLink} onPress={() => router.replace("/auth/sign-in")}>
          <Text style={styles.backLinkText}>Sign in</Text>
        </Pressable>
      </View>
    );
  }

  if (loadingExisting) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator color={colors.accentStrong} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={handleBack} hitSlop={8} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{isAmendment ? "Suggest an edit" : "Add a bathroom"}</Text>
        <View style={styles.backButton} />
      </View>

      <View style={styles.mapWrapper}>
        <PinPickerMap initialCenter={center} onCenterChange={setCenter} locked={isAmendment} />
      </View>
      {!isAmendment ? (
        <View style={styles.mapHint}>
          <Ionicons name="move-outline" size={13} color={colors.textSecondary} />
          <Text style={styles.mapHintText}>Pan the map so the pin sits exactly on the bathroom</Text>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
        {error ? <Text style={styles.formErrorText}>{error}</Text> : null}

        <Text style={styles.fieldLabel}>Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Bathroom name"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />

        <ChipSelectField label="Access" options={ACCESS_TYPE_OPTIONS} value={accessType} onChange={setAccessType} />

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
            <Pressable style={styles.photoAddButton} onPress={handlePickPhoto} accessibilityRole="button" accessibilityLabel="Add a photo">
              <Ionicons name="camera-outline" size={20} color={colors.textSecondary} />
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      <Pressable
        style={[
          styles.submitButton,
          (!canSubmit || submitting || uploadingPhotos) && styles.submitButtonDisabled,
        ]}
        onPress={handleSubmit}
        disabled={!canSubmit || submitting || uploadingPhotos}
      >
        {submitting || uploadingPhotos ? (
          <ActivityIndicator color={colors.textOnAccent} />
        ) : (
          <Text style={styles.submitButtonText}>{isAmendment ? "Submit suggestion" : "Submit for review"}</Text>
        )}
      </Pressable>

      <Toast message="Submitted to admins for approval!" visible={showToast} />
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
    gap: spacing.md,
    paddingHorizontal: spacing["2xl"],
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  backButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  mapWrapper: {
    height: 260,
    backgroundColor: colors.surfaceMuted,
  },
  mapHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    backgroundColor: colors.sandMuted,
  },
  mapHintText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  formContent: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  formErrorText: {
    fontSize: fontSize.sm,
    color: colors.danger,
  },
  fieldLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 44,
    fontSize: fontSize.base,
    color: colors.textPrimary,
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
  errorText: {
    fontSize: fontSize.sm,
    color: colors.danger,
    textAlign: "center",
  },
  backLink: {
    marginTop: spacing.xs,
  },
  backLinkText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
});
