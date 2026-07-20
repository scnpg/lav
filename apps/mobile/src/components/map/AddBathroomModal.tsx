import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import {
  ACCESS_TYPE_LABELS,
  COST_TYPE_LABELS,
  GENDER_CATEGORY_LABELS,
  TOILET_TYPE_LABELS,
} from "../../constants/enumLabels";
import {
  ChipSelectField,
  FormStatusBanner,
  TextField,
  ToggleRow,
  type FormStatus,
} from "../bathroom/EditableFieldControls";
import { submitBathroom } from "../../features/bathrooms/api";
import { useAuth } from "../../lib/auth";
import { cardShadow, colors, fontSize, fontWeight, radii, spacing } from "../../theme";
import { ACCESS_TYPES, COST_TYPES, GENDER_CATEGORIES, TOILET_TYPES } from "../../types/enums";

interface Coordinate {
  latitude: number;
  longitude: number;
}

interface AddBathroomModalProps {
  coordinate: Coordinate;
  coordinateSource: "gps" | "map_center";
  submitterLocation: Coordinate | null;
  onClose: () => void;
}

const ACCESS_TYPE_OPTIONS = ACCESS_TYPES.map((value) => ({ value, label: ACCESS_TYPE_LABELS[value] }));
const COST_TYPE_OPTIONS = COST_TYPES.map((value) => ({ value, label: COST_TYPE_LABELS[value] }));
const GENDER_CATEGORY_OPTIONS = GENDER_CATEGORIES.map((value) => ({ value, label: GENDER_CATEGORY_LABELS[value] }));
const TOILET_TYPE_OPTIONS = TOILET_TYPES.map((value) => ({ value, label: TOILET_TYPE_LABELS[value] }));

// New submission goes in as status='pending' (enforced by
// bathrooms_insert_own_pending in 0006_rls.sql, not just this form) - it
// won't show on anyone's map until an admin verifies it. The pin location
// itself isn't user-editable here: it's whatever was passed in as
// `coordinate` (GPS fix or current map center, decided by the caller before
// opening this modal), matching "drop a pin on current location or center
// map coordinate" rather than a full drag-to-place interaction.
export function AddBathroomModal({
  coordinate,
  coordinateSource,
  submitterLocation,
  onClose,
}: AddBathroomModalProps) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [venueName, setVenueName] = useState("");
  const [floor, setFloor] = useState("");
  const [description, setDescription] = useState("");
  const [accessType, setAccessType] = useState<(typeof ACCESS_TYPES)[number] | null>(null);
  const [costType, setCostType] = useState<(typeof COST_TYPES)[number] | null>(null);
  const [genderCategory, setGenderCategory] = useState<(typeof GENDER_CATEGORIES)[number] | null>(null);
  const [toiletType, setToiletType] = useState<(typeof TOILET_TYPES)[number] | null>(null);
  const [wheelchairAccessible, setWheelchairAccessible] = useState(false);
  const [changingStation, setChangingStation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<FormStatus | null>(null);

  const canSubmit = name.trim().length > 0 && !!user;

  async function handleSubmit() {
    if (!canSubmit || submitting || !user) return;
    setSubmitting(true);
    setStatus(null);
    try {
      await submitBathroom({
        name: name.trim(),
        venue_name: venueName.trim() || null,
        floor: floor.trim() || null,
        description: description.trim() || null,
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
        access_type: accessType,
        cost_type: costType,
        gender_category: genderCategory,
        toilet_type: toiletType,
        amenities: { wheelchair_accessible: wheelchairAccessible, baby_changing: changingStation },
        submission_latitude: submitterLocation?.latitude ?? null,
        submission_longitude: submitterLocation?.longitude ?? null,
        submitted_by: user.id,
      });
      setStatus({ type: "success", message: "Submitted for review." });
      setTimeout(onClose, 700);
    } catch (err) {
      setStatus({
        type: "error",
        message: err instanceof Error ? err.message : "Couldn't submit bathroom. Please try again.",
      });
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
          <Text style={styles.title}>Add a bathroom</Text>
          <Pressable onPress={onClose} style={styles.closeButton} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.locationBanner}>
          <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.locationBannerText}>
            {coordinateSource === "gps" ? "Using your current location" : "Using the map's center"}
          </Text>
        </View>

        <FormStatusBanner status={status} />

        <ScrollView
          style={styles.form}
          contentContainerStyle={styles.formContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TextField label="Name" value={name} onChangeText={setName} placeholder="Bathroom name" />
          <TextField label="Venue" value={venueName} onChangeText={setVenueName} placeholder="e.g. building or business name" />
          <TextField label="Floor" value={floor} onChangeText={setFloor} placeholder="e.g. 2nd floor, B1" />
          <ChipSelectField label="Access" options={ACCESS_TYPE_OPTIONS} value={accessType} onChange={setAccessType} />
          <ChipSelectField label="Cost" options={COST_TYPE_OPTIONS} value={costType} onChange={setCostType} />
          <ChipSelectField
            label="Gender / accessibility"
            options={GENDER_CATEGORY_OPTIONS}
            value={genderCategory}
            onChange={setGenderCategory}
          />
          <ChipSelectField label="Toilet type" options={TOILET_TYPE_OPTIONS} value={toiletType} onChange={setToiletType} />
          <ToggleRow label="Wheelchair accessible" value={wheelchairAccessible} onChange={setWheelchairAccessible} />
          <ToggleRow label="Changing station" value={changingStation} onChange={setChangingStation} />
          <TextField
            label="Description"
            value={description}
            onChangeText={setDescription}
            placeholder="What should people know?"
            multiline
          />
        </ScrollView>

        <Pressable
          style={[
            styles.submitButton,
            (!canSubmit || submitting || status?.type === "success") && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!canSubmit || submitting || status?.type === "success"}
        >
          {submitting ? (
            <ActivityIndicator color={colors.textOnAccent} />
          ) : (
            <Text style={styles.submitButtonText}>Submit for review</Text>
          )}
        </Pressable>
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
    maxHeight: "85%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  closeButton: {
    padding: spacing.xs,
  },
  locationBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  locationBannerText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  form: {
    flexGrow: 0,
  },
  formContent: {
    padding: spacing.lg,
    gap: spacing.md,
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
