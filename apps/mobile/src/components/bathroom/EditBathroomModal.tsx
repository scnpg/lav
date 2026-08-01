import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import {
  ACCESS_TYPE_LABELS,
  COST_TYPE_LABELS,
  GENDER_CATEGORY_LABELS,
  TOILET_TYPE_LABELS,
} from "../../constants/enumLabels";
import { updateBathroomDetails, type BathroomFillMissingPatch } from "../../features/bathrooms/api";
import { cardShadow, colors, fontSize, fontWeight, radii, spacing } from "../../theme";
import type { BathroomNearby, BathroomPublic } from "../../types/database";
import { ACCESS_TYPES, COST_TYPES, GENDER_CATEGORIES, TOILET_TYPES } from "../../types/enums";
import {
  ChipSelectField,
  FormStatusBanner,
  OpenHoursField,
  TextField,
  ToggleRow,
  type FormStatus,
} from "./EditableFieldControls";

interface EditBathroomModalProps {
  bathroom: BathroomNearby;
  onClose: () => void;
  onSaved: (updated: BathroomPublic) => void;
}

const ACCESS_TYPE_OPTIONS = ACCESS_TYPES.map((value) => ({ value, label: ACCESS_TYPE_LABELS[value] }));
const COST_TYPE_OPTIONS = COST_TYPES.map((value) => ({ value, label: COST_TYPE_LABELS[value] }));
const GENDER_CATEGORY_OPTIONS = GENDER_CATEGORIES.map((value) => ({ value, label: GENDER_CATEGORY_LABELS[value] }));
const TOILET_TYPE_OPTIONS = TOILET_TYPES.map((value) => ({ value, label: TOILET_TYPE_LABELS[value] }));

// Community "fill in missing data" form - see api.ts's BathroomFillMissingPatch
// for exactly which fields this is allowed to touch and why (the DB trigger
// backing this is the real boundary; this form just matches it 1:1).
export function EditBathroomModal({ bathroom, onClose, onSaved }: EditBathroomModalProps) {
  const [name, setName] = useState(bathroom.name);
  const [floor, setFloor] = useState(bathroom.floor ?? "");
  const [description, setDescription] = useState(bathroom.description ?? "");
  const [accessNotes, setAccessNotes] = useState(bathroom.access_notes ?? "");
  const [accessType, setAccessType] = useState(bathroom.access_type);
  const [costType, setCostType] = useState(bathroom.cost_type);
  const [genderCategory, setGenderCategory] = useState(bathroom.gender_category);
  const [toiletType, setToiletType] = useState(bathroom.toilet_type);
  const [wheelchairAccessible, setWheelchairAccessible] = useState(!!bathroom.amenities.wheelchair_accessible);
  const [changingStation, setChangingStation] = useState(!!bathroom.amenities.baby_changing);
  const [openHours, setOpenHours] = useState(bathroom.open_hours ?? {});
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<FormStatus | null>(null);

  const canSubmit = name.trim().length > 0;

  async function handleSubmit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setStatus(null);
    try {
      const patch: BathroomFillMissingPatch = {
        name: name.trim(),
        floor: floor.trim() || null,
        description: description.trim() || null,
        access_notes: accessNotes.trim() || null,
        access_type: accessType,
        cost_type: costType,
        gender_category: genderCategory,
        toilet_type: toiletType,
        amenities: {
          ...bathroom.amenities,
          wheelchair_accessible: wheelchairAccessible,
          baby_changing: changingStation,
        },
        open_hours: openHours,
      };
      const updated = await updateBathroomDetails(bathroom.id, patch);
      onSaved(updated);
      setStatus({ type: "success", message: "Saved." });
      setTimeout(onClose, 700);
    } catch (err) {
      setStatus({ type: "error", message: err instanceof Error ? err.message : "Couldn't save changes. Please try again." });
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
          <Text style={styles.title}>Edit info</Text>
          <Pressable onPress={onClose} style={styles.closeButton} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>

        <FormStatusBanner status={status} />

        <ScrollView
          style={styles.form}
          contentContainerStyle={styles.formContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TextField label="Name" value={name} onChangeText={setName} placeholder="Bathroom name" />
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
          <OpenHoursField value={openHours} onChange={setOpenHours} />
          <TextField
            label="Description"
            value={description}
            onChangeText={setDescription}
            placeholder="What should people know?"
            multiline
          />
          <TextField
            label="Access instructions"
            value={accessNotes}
            onChangeText={setAccessNotes}
            placeholder="How to get in"
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
            <Text style={styles.submitButtonText}>Save changes</Text>
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
