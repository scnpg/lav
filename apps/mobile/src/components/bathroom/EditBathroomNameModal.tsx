import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { adminUpdateBathroom } from "../../features/bathrooms/api";
import { getBathroomNameSubmissions, submitBathroomNameSuggestion } from "../../features/bathrooms/nameVerification";
import { cardShadow, colors, fontSize, fontWeight, radii, spacing } from "../../theme";
import { FormStatusBanner, TextField, type FormStatus } from "./EditableFieldControls";

interface EditBathroomNameModalProps {
  bathroomId: string;
  currentName: string;
  userId: string;
  isAdmin: boolean;
  onClose: () => void;
  /** Only fires for an admin's direct save - a suggestion never changes the name outright. */
  onRenamed?: (newName: string) => void;
}

// One entry point, two write paths - matching what the backend already
// enforces rather than adding a new one:
//   - Admin: adminUpdateBathroom() writes bathrooms.name immediately
//     (is_admin() short-circuits guard_bathroom_update - see 0012/0034).
//   - Everyone else: submitBathroomNameSuggestion() upserts one vote into
//     bathroom_name_submissions (0034_postgis_clustering_and_name_verification.sql).
//     That table's own AFTER trigger (process_bathroom_verification) is what
//     actually renames the bathroom, entirely server-side, once >=5 votes
//     exist and one normalized name has >50% agreement - nothing client-side
//     drives that threshold, this just casts the vote.
// Deliberately not the heavier bathroom_submissions admin-review queue
// (src/features/submissions/api.ts, used by the full submit.tsx wizard for
// whole-listing amendments) - this is name-only and either instant (admin)
// or fully automatic (crowd), no human moderator in the loop either way.
export function EditBathroomNameModal({
  bathroomId,
  currentName,
  userId,
  isAdmin,
  onClose,
  onRenamed,
}: EditBathroomNameModalProps) {
  const [name, setName] = useState(currentName);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<FormStatus | null>(null);
  const [existingVotes, setExistingVotes] = useState<number | null>(null);

  useEffect(() => {
    if (isAdmin) return;
    let cancelled = false;
    getBathroomNameSubmissions(bathroomId).then((rows) => {
      if (!cancelled) setExistingVotes(rows.length);
    });
    return () => {
      cancelled = true;
    };
  }, [bathroomId, isAdmin]);

  async function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    setStatus(null);
    try {
      if (isAdmin) {
        await adminUpdateBathroom(bathroomId, { name: trimmed });
        onRenamed?.(trimmed);
        setStatus({ type: "success", message: "Name updated." });
        setTimeout(onClose, 700);
      } else {
        await submitBathroomNameSuggestion(bathroomId, userId, trimmed);
        setStatus({
          type: "success",
          message: "Thanks - your suggestion is recorded. Names update automatically once enough people agree.",
        });
        setTimeout(onClose, 1600);
      }
    } catch (err) {
      setStatus({ type: "error", message: err instanceof Error ? err.message : "Couldn't save that." });
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
          <Text style={styles.title}>{isAdmin ? "Edit name" : "Suggest a name"}</Text>
          <Pressable onPress={onClose} style={styles.closeButton} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>

        <FormStatusBanner status={status} />

        <View style={styles.content}>
          {!isAdmin ? (
            <Text style={styles.hint}>
              Think this bathroom is named wrong? Suggest a better one - it updates automatically once 5 or more
              people agree{existingVotes !== null && existingVotes > 0 ? ` (${existingVotes} suggestion${existingVotes === 1 ? "" : "s"} so far)` : ""}.
            </Text>
          ) : null}
          <TextField label="Name" value={name} onChangeText={setName} placeholder="e.g. Riverside Park Restroom" />
        </View>

        <Pressable
          style={[styles.submitButton, (!name.trim() || submitting) && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!name.trim() || submitting}
        >
          {submitting ? (
            <ActivityIndicator color={colors.textOnAccent} />
          ) : (
            <Text style={styles.submitButtonText}>{isAdmin ? "Save" : "Submit suggestion"}</Text>
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
    maxHeight: "70%",
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
  hint: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
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
