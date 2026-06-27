import { ScrollView, StyleSheet, Text, TouchableOpacity } from "react-native";

import { colors, fontSize, fontWeight, radii, spacing } from "../../theme";

export interface FilterOption {
  key: string;
  label: string;
}

interface FilterChipsProps {
  options: FilterOption[];
  activeKeys: Set<string>;
  onToggle: (key: string) => void;
}

// TODO: this is the small representative subset (free / wheelchair / bidet /
// public-only) that's cheap to apply against mock data locally. The full
// filter set from the spec (cleanliness, cost, gender/accessibility,
// amenities, access type, open now, purchase required, public only) lands
// once this screen reads real bathroom rows and probably needs its own
// filter sheet instead of a single chip row.
export function FilterChips({ options, activeKeys, onToggle }: FilterChipsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {options.map((option) => {
        const isActive = activeKeys.has(option.key);
        return (
          <TouchableOpacity
            key={option.key}
            onPress={() => onToggle(option.key)}
            style={[styles.chip, isActive && styles.chipActive]}
            activeOpacity={0.8}
          >
            <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{option.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.sandMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.textOnAccent,
  },
});
