import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ACCESS_TYPE_LABELS } from "../../constants/enumLabels";
import {
  CONFIDENCE_LABELS,
  SOURCE_LABELS,
  type VerificationCandidate,
} from "../../features/verification/mockCandidates";
import { formatDistance, formatRelativeTime } from "../../lib/format";
import { colors, fontSize, fontWeight, radii, spacing } from "../../theme";

type ResponseValue = "yes" | "no" | "maybe";

interface VerificationCardProps {
  candidate: VerificationCandidate;
}

// One candidate + its yes/no/maybe prompt. Response state is local to this
// card only - nothing is sent anywhere, there is no backend yet. See
// src/features/verification/rules.ts for the anti-spam/moderation rules
// this is a UI-only preview of.
export function VerificationCard({ candidate }: VerificationCardProps) {
  const [response, setResponse] = useState<ResponseValue | null>(null);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.name} numberOfLines={1}>
            {candidate.name}
          </Text>
          {candidate.venueName ? (
            <Text style={styles.venue} numberOfLines={1}>
              {candidate.venueName}
            </Text>
          ) : null}
        </View>
        <View style={styles.distanceBadge}>
          <Ionicons name="navigate-outline" size={11} color={colors.textPrimary} />
          <Text style={styles.distanceText}>{formatDistance(candidate.distanceMeters)}</Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.sourceChip}>
          <Text style={styles.sourceChipText}>{SOURCE_LABELS[candidate.sourceType]}</Text>
        </View>
        <Text style={styles.metaText}>{CONFIDENCE_LABELS[candidate.confidenceLevel]}</Text>
      </View>

      <View style={styles.factsRow}>
        <Text style={styles.factText}>Last checked {formatRelativeTime(candidate.lastCheckedAt)}</Text>
        <Text style={styles.factText}>
          {candidate.accessType ? ACCESS_TYPE_LABELS[candidate.accessType] : "Access unknown"}
        </Text>
      </View>

      {candidate.possibleDuplicateOf ? (
        <View style={styles.duplicateBanner}>
          <Ionicons name="alert-circle-outline" size={14} color={colors.textPrimary} />
          <Text style={styles.duplicateText}>Possible duplicate of "{candidate.possibleDuplicateOf}"</Text>
        </View>
      ) : null}

      {response ? (
        <View style={styles.confirmation}>
          <Text style={styles.confirmationTitle}>Thanks - this helps improve Lav.</Text>
          <Text style={styles.confirmationBody}>Points are awarded after verification is confirmed.</Text>
        </View>
      ) : (
        <>
          <Text style={styles.question}>Does this bathroom exist and seem usable?</Text>
          <View style={styles.buttonRow}>
            <ResponseButton label="Yes" tone="success" onPress={() => setResponse("yes")} />
            <ResponseButton label="Maybe" tone="warning" onPress={() => setResponse("maybe")} />
            <ResponseButton label="No" tone="danger" onPress={() => setResponse("no")} />
          </View>
        </>
      )}

      <Text style={styles.microcopy}>
        You'll earn Cartographer progress when your answer matches the final verified result.
      </Text>
    </View>
  );
}

interface ResponseButtonProps {
  label: string;
  tone: "success" | "warning" | "danger";
  onPress: () => void;
}

function ResponseButton({ label, tone, onPress }: ResponseButtonProps) {
  return (
    <Pressable
      style={[styles.responseButton, tone === "success" && styles.responseButtonSuccess, tone === "warning" && styles.responseButtonWarning, tone === "danger" && styles.responseButtonDanger]}
      onPress={onPress}
    >
      <Text style={styles.responseButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  venue: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  distanceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.skyMuted,
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  distanceText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  sourceChip: {
    backgroundColor: colors.sand,
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  sourceChipText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  metaText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  factsRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  factText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  duplicateBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.warningMuted,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  duplicateText: {
    flex: 1,
    fontSize: fontSize.xs,
    color: colors.textPrimary,
  },
  question: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  buttonRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  responseButton: {
    flex: 1,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  responseButtonSuccess: {
    backgroundColor: colors.success,
  },
  responseButtonWarning: {
    backgroundColor: colors.warning,
  },
  responseButtonDanger: {
    backgroundColor: colors.danger,
  },
  responseButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textOnAccent,
  },
  confirmation: {
    backgroundColor: colors.successMuted,
    borderRadius: radii.md,
    padding: spacing.sm,
    gap: 2,
  },
  confirmationTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  confirmationBody: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  microcopy: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
});
