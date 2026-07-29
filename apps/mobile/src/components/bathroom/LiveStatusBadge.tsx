import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { formatRelativeTime } from "../../lib/format";
import { colors, fontSize, fontWeight, radii, spacing } from "../../theme";
import type { BathroomLiveStatus } from "../../types/database";

interface LiveStatusBadgeProps {
  status: BathroomLiveStatus | null;
}

const CLOSURE_LABELS: Record<string, string> = {
  out_of_order: "Reported out of order",
  cleaning: "Reported closed for cleaning",
  other: "Reported closed",
};

// Renders nothing at all if there's no recent Quick Verification check-in -
// an absence of reports isn't itself a signal, so there's no "all clear by
// default" state to show. Tone/text mirrors what get_bathroom_live_status
// actually found: closure (red) takes priority over a long line (amber)
// over a plain all-clear (green).
export function LiveStatusBadge({ status }: LiveStatusBadgeProps) {
  if (!status) return null;

  const relativeTime = formatRelativeTime(status.reported_at);

  if (!status.is_open) {
    return (
      <View style={[styles.badge, styles.badgeDanger]}>
        <Ionicons name="alert-circle" size={16} color={colors.textPrimary} />
        <Text style={styles.badgeText}>
          {CLOSURE_LABELS[status.closure_reason ?? "other"]} · {relativeTime}
        </Text>
      </View>
    );
  }

  if (status.line_length === "long") {
    return (
      <View style={[styles.badge, styles.badgeWarning]}>
        <Ionicons name="people" size={16} color={colors.textPrimary} />
        <Text style={styles.badgeText}>Long line reported · {relativeTime}</Text>
      </View>
    );
  }

  const notes = [!status.is_clean ? "not clean" : null, !status.has_paper ? "no paper" : null].filter(Boolean);
  return (
    <View style={[styles.badge, styles.badgeSuccess]}>
      <Ionicons name="checkmark-circle" size={16} color={colors.textPrimary} />
      <Text style={styles.badgeText}>
        Reported open{notes.length > 0 ? ` (${notes.join(", ")})` : ""} · {relativeTime}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.full,
  },
  badgeSuccess: {
    backgroundColor: colors.successMuted,
  },
  badgeWarning: {
    backgroundColor: colors.warning,
  },
  badgeDanger: {
    backgroundColor: colors.dangerMuted,
  },
  badgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
  },
});
