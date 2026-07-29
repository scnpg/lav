import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { submitQuickCheck } from "../../features/bathrooms/statusApi";
import { cardShadow, colors, fontSize, fontWeight, radii, spacing } from "../../theme";
import { FormStatusBanner, type FormStatus } from "./EditableFieldControls";

interface QuickCheckModalProps {
  bathroomId: string;
  userId: string;
  onClose: () => void;
  onSubmitted: () => void;
}

type YesNo = boolean | null;
type LineLength = "none" | "short" | "long";
type ClosureReason = "out_of_order" | "cleaning" | "other";

const CLOSURE_REASONS: { value: ClosureReason; label: string }[] = [
  { value: "out_of_order", label: "Out of order" },
  { value: "cleaning", label: "Being cleaned" },
  { value: "other", label: "Other" },
];

const LINE_LENGTHS: { value: LineLength; label: string }[] = [
  { value: "none", label: "No line" },
  { value: "short", label: "Short wait" },
  { value: "long", label: "Long wait" },
];

// The "2-second check-in" - three binary questions plus one optional line
// picker, deliberately far lighter than RateBathroomModal's full scorecard.
// Every submission is just an append-only row (bathroom_status_checks) -
// there's nothing to pre-fill or upsert, unlike a review.
export function QuickCheckModal({ bathroomId, userId, onClose, onSubmitted }: QuickCheckModalProps) {
  const [isOpen, setIsOpen] = useState<YesNo>(null);
  const [isClean, setIsClean] = useState<YesNo>(null);
  const [hasPaper, setHasPaper] = useState<YesNo>(null);
  const [closureReason, setClosureReason] = useState<ClosureReason>("out_of_order");
  const [lineLength, setLineLength] = useState<LineLength>("none");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<FormStatus | null>(null);

  const canSubmit = isOpen !== null && isClean !== null && hasPaper !== null && !submitting;

  async function handleSubmit() {
    if (isOpen === null || isClean === null || hasPaper === null || submitting) return;
    setSubmitting(true);
    setStatus(null);
    try {
      await submitQuickCheck({
        bathroom_id: bathroomId,
        user_id: userId,
        is_open: isOpen,
        is_clean: isClean,
        has_paper: hasPaper,
        closure_reason: isOpen ? null : closureReason,
        line_length: lineLength,
      });
      onSubmitted();
    } catch (err) {
      setStatus({ type: "error", message: err instanceof Error ? err.message : "Couldn't submit your check-in." });
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
          <Text style={styles.title}>Quick check-in</Text>
          <Pressable onPress={onClose} style={styles.closeButton} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>

        <FormStatusBanner status={status} />

        <View style={styles.content}>
          <YesNoRow label="Is it open?" value={isOpen} onChange={setIsOpen} />
          {isOpen === false ? (
            <View style={styles.subChoiceRow}>
              {CLOSURE_REASONS.map((option) => {
                const active = closureReason === option.value;
                return (
                  <Pressable
                    key={option.value}
                    style={[styles.subChip, active && styles.subChipActive]}
                    onPress={() => setClosureReason(option.value)}
                  >
                    <Text style={[styles.subChipText, active && styles.subChipTextActive]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          <YesNoRow label="Is it clean?" value={isClean} onChange={setIsClean} />
          <YesNoRow label="Is there paper?" value={hasPaper} onChange={setHasPaper} />

          <Text style={styles.fieldLabel}>Line right now</Text>
          <View style={styles.subChoiceRow}>
            {LINE_LENGTHS.map((option) => {
              const active = lineLength === option.value;
              return (
                <Pressable
                  key={option.value}
                  style={[styles.subChip, active && styles.subChipActive]}
                  onPress={() => setLineLength(option.value)}
                >
                  <Text style={[styles.subChipText, active && styles.subChipTextActive]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Pressable
          style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
        >
          {submitting ? <ActivityIndicator color={colors.textOnAccent} /> : <Text style={styles.submitButtonText}>Submit</Text>}
        </Pressable>
      </View>
    </View>
  );
}

function YesNoRow({ label, value, onChange }: { label: string; value: YesNo; onChange: (value: boolean) => void }) {
  return (
    <View style={styles.yesNoRow}>
      <Text style={styles.yesNoLabel}>{label}</Text>
      <View style={styles.yesNoButtons}>
        <Pressable
          style={[styles.yesNoButton, value === true && styles.yesNoButtonYesActive]}
          onPress={() => onChange(true)}
        >
          <Text style={[styles.yesNoButtonText, value === true && styles.yesNoButtonTextActive]}>Yes</Text>
        </Pressable>
        <Pressable
          style={[styles.yesNoButton, value === false && styles.yesNoButtonNoActive]}
          onPress={() => onChange(false)}
        >
          <Text style={[styles.yesNoButtonText, value === false && styles.yesNoButtonTextActive]}>No</Text>
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
    gap: spacing.md,
  },
  yesNoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  yesNoLabel: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
  },
  yesNoButtons: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  yesNoButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  yesNoButtonYesActive: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  yesNoButtonNoActive: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  yesNoButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  yesNoButtonTextActive: {
    color: colors.textOnAccent,
  },
  fieldLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  subChoiceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  subChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.sandMuted,
  },
  subChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  subChipText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  subChipTextActive: {
    color: colors.textOnAccent,
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
