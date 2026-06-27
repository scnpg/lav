import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { StyleSheet, Text, View } from "react-native";

import { AMENITY_LABELS } from "../../constants/amenities";
import {
  ACCESS_DIFFICULTY_LABELS,
  ACCESS_TYPE_LABELS,
  COST_TYPE_LABELS,
  GENDER_CATEGORY_LABELS,
  TOILET_TYPE_LABELS,
} from "../../constants/enumLabels";
import type { MockBathroom } from "../../features/bathrooms/mockData";
import { formatRelativeTime } from "../../lib/format";
import { colors, fontSize, fontWeight, radii, spacing } from "../../theme";
import type { AmenityKey } from "../../types/enums";

interface DetailsGridProps {
  bathroom: MockBathroom;
}

function formatOpenHours(bathroom: MockBathroom): string {
  const hours = bathroom.open_hours;
  if (hours.is_24_hours) return "Open 24 hours";
  if (hours.open && hours.close) return `${hours.open} – ${hours.close}`;
  return "Hours unknown";
}

function formatCost(bathroom: MockBathroom): string {
  const base = bathroom.cost_type ? COST_TYPE_LABELS[bathroom.cost_type] : "Cost unknown";
  if (bathroom.cost_amount) return `${base} · $${bathroom.cost_amount.toFixed(2)}`;
  return base;
}

export function DetailsGrid({ bathroom }: DetailsGridProps) {
  const amenityEntries = Object.entries(bathroom.amenities).filter(([, enabled]) => enabled) as [
    AmenityKey,
    boolean,
  ][];

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Details</Text>

      <View style={styles.card}>
        <DetailRow icon="layers-outline" label="Stalls" value={String(bathroom.stallCount)} />
        <DetailRow icon="man-outline" label="Urinals" value={String(bathroom.urinalCount)} />
        <DetailRow
          icon="water-outline"
          label="Toilet type"
          value={bathroom.toilet_type ? TOILET_TYPE_LABELS[bathroom.toilet_type] : "Unknown"}
        />
        <DetailRow
          icon="people-outline"
          label="Gender / accessibility"
          value={bathroom.gender_category ? GENDER_CATEGORY_LABELS[bathroom.gender_category] : "Unknown"}
        />
        <DetailRow icon="time-outline" label="Hours" value={formatOpenHours(bathroom)} />
        <DetailRow icon="cash-outline" label="Cost" value={formatCost(bathroom)} secondary={bathroom.purchase_note} />
        <DetailRow
          icon="key-outline"
          label="Access"
          value={bathroom.access_type ? ACCESS_TYPE_LABELS[bathroom.access_type] : "Unknown"}
          secondary={
            bathroom.access_difficulty ? `Difficulty: ${ACCESS_DIFFICULTY_LABELS[bathroom.access_difficulty]}` : null
          }
        />
        {bathroom.access_notes ? (
          <DetailRow icon="information-circle-outline" label="Access instructions" value={bathroom.access_notes} isLast />
        ) : null}
      </View>

      {amenityEntries.length > 0 ? (
        <View style={styles.amenitiesBlock}>
          <Text style={styles.amenitiesLabel}>Amenities</Text>
          <View style={styles.amenityChipRow}>
            {amenityEntries.map(([key]) => (
              <View key={key} style={styles.amenityChip}>
                <Text style={styles.amenityChipText}>{AMENITY_LABELS[key]}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {bathroom.last_verified_at ? (
        <Text style={styles.verifiedText}>Last verified {formatRelativeTime(bathroom.last_verified_at)}</Text>
      ) : null}
    </View>
  );
}

function DetailRow({
  icon,
  label,
  value,
  secondary,
  isLast,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
  secondary?: string | null;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.row, isLast && styles.rowLast]}>
      <Ionicons name={icon} size={18} color={colors.textSecondary} style={styles.rowIcon} />
      <View style={styles.rowTextBlock}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
        {secondary ? <Text style={styles.rowSecondary}>{secondary}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowIcon: {
    marginTop: 2,
  },
  rowTextBlock: {
    flex: 1,
    gap: 1,
  },
  rowLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  rowValue: {
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    fontWeight: fontWeight.medium,
  },
  rowSecondary: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  amenitiesBlock: {
    gap: spacing.sm,
  },
  amenitiesLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  amenityChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  amenityChip: {
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.full,
  },
  amenityChipText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  verifiedText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
});
