import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { submitBathroomReport, type BathroomReportReason } from "../../features/reports/api";
import { cardShadow, colors, fontSize, fontWeight, radii, spacing } from "../../theme";
import { FormStatusBanner, type FormStatus } from "./EditableFieldControls";

interface ReportBathroomModalProps {
  bathroomId: string;
  userId: string;
  onClose: () => void;
  onSubmitted: () => void;
}

const REASONS: BathroomReportReason[] = [
  "Permanently Closed",
  "Wrong Location",
  "Duplicate",
  "Inappropriate Content",
  "Other",
];

// Closes itself and lets the parent screen show a toast on success (see
// Toast.tsx) rather than showing its own success banner - the sheet is
// already sliding away by the time the confirmation should register.
export function ReportBathroomModal({ bathroomId, userId, onClose, onSubmitted }: ReportBathroomModalProps) {
  const [reason, setReason] = useState<BathroomReportReason | null>(null);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<FormStatus | null>(null);

  async function handleSubmit() {
    if (!reason || submitting) return;
    setSubmitting(true);
    setStatus(null);
    try {
      await submitBathroomReport({ bathroomId, userId, reason, description });
      onSubmitted();
    } catch (err) {
      setStatus({ type: "error", message: err instanceof Error ? err.message : "Couldn't submit your report." });
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
          <Text style={styles.title}>Report this bathroom</Text>
          <Pressable
            onPress={onClose}
            style={styles.closeButton}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>

        <FormStatusBanner status={status} />

        <View style={styles.content}>
          <Text style={styles.fieldLabel}>What's wrong?</Text>
          <View style={styles.reasonList}>
            {REASONS.map((option) => {
              const active = reason === option;
              return (
                <Pressable
                  key={option}
                  style={[styles.reasonRow, active && styles.reasonRowActive]}
                  onPress={() => setReason(option)}
                >
                  <Ionicons
                    name={active ? "radio-button-on" : "radio-button-off"}
                    size={18}
                    color={active ? colors.accentStrong : colors.textMuted}
                  />
                  <Text style={[styles.reasonText, active && styles.reasonTextActive]}>{option}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.fieldLabel}>Details (optional)</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Anything else we should know?"
            placeholderTextColor={colors.textMuted}
            style={styles.textArea}
            multiline
          />
        </View>

        <Pressable
          style={[styles.submitButton, (!reason || submitting) && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!reason || submitting}
        >
          {submitting ? (
            <ActivityIndicator color={colors.textOnAccent} />
          ) : (
            <Text style={styles.submitButtonText}>Submit report</Text>
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
    maxHeight: "80%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.lg,
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
  content: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  fieldLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  reasonList: {
    gap: spacing.xs,
  },
  reasonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reasonRowActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  reasonText: {
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },
  reasonTextActive: {
    fontWeight: fontWeight.semibold,
  },
  textArea: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    padding: spacing.md,
    minHeight: 72,
    fontSize: fontSize.base,
    color: colors.textPrimary,
    textAlignVertical: "top",
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
