import { Ionicons } from "@expo/vector-icons";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { colors, fontSize, fontWeight, radii, spacing } from "../../theme";

// Shared form primitives for the Edit Info and Add New Bathroom modals - the
// only two places that need labeled text inputs / single-select chip
// pickers / boolean toggles for bathroom fields. ChipSelectField reuses the
// same visual language as map/FilterChips.tsx (active = accent fill) rather
// than introducing a new picker component or dependency.
//
// FormStatusBanner exists because react-native-web's Alert.alert is a silent
// no-op in this build (confirmed empirically - it never even reaches
// window.alert) - so success/error feedback has to be real UI, not an Alert
// call, or web users see nothing happen at all.

export interface FormStatus {
  type: "success" | "error";
  message: string;
}

interface FormStatusBannerProps {
  status: FormStatus | null;
}

export function FormStatusBanner({ status }: FormStatusBannerProps) {
  if (!status) return null;
  const isError = status.type === "error";
  return (
    <View style={[styles.statusBanner, isError ? styles.statusBannerError : styles.statusBannerSuccess]}>
      <Ionicons
        name={isError ? "alert-circle-outline" : "checkmark-circle-outline"}
        size={16}
        color={colors.textPrimary}
      />
      <Text style={styles.statusBannerText}>{status.message}</Text>
    </View>
  );
}

interface TextFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
}

export function TextField({ label, value, onChangeText, placeholder, multiline }: TextFieldProps) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, multiline && styles.inputMultiline]}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
      />
    </View>
  );
}

interface ChipOption<T extends string> {
  value: T;
  label: string;
}

interface ChipSelectFieldProps<T extends string> {
  label: string;
  options: ChipOption<T>[];
  value: T | null | undefined;
  onChange: (value: T) => void;
}

export function ChipSelectField<T extends string>({ label, options, value, onChange }: ChipSelectFieldProps<T>) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {options.map((option) => {
          const isActive = value === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              onPress={() => onChange(option.value)}
              style={[styles.chip, isActive && styles.chipActive]}
              activeOpacity={0.8}
            >
              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{option.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

interface ToggleRowProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

export function ToggleRow({ label, value, onChange }: ToggleRowProps) {
  return (
    <TouchableOpacity
      style={styles.toggleRow}
      onPress={() => onChange(!value)}
      activeOpacity={0.7}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
    >
      <Text style={styles.toggleLabel}>{label}</Text>
      <View style={[styles.toggleTrack, value && styles.toggleTrackActive]}>
        <View style={[styles.toggleThumb, value && styles.toggleThumbActive]} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radii.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  statusBannerSuccess: {
    backgroundColor: colors.successMuted,
  },
  statusBannerError: {
    backgroundColor: colors.dangerMuted,
  },
  statusBannerText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },
  fieldBlock: {
    gap: spacing.xs,
  },
  fieldLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
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
  inputMultiline: {
    height: undefined,
    minHeight: 80,
    paddingVertical: spacing.sm,
    textAlignVertical: "top",
  },
  chipRow: {
    gap: spacing.sm,
    paddingVertical: spacing.xs / 2,
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
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.xs,
  },
  toggleLabel: {
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },
  toggleTrack: {
    width: 44,
    height: 26,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 2,
  },
  toggleTrackActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
  },
  toggleThumbActive: {
    transform: [{ translateX: 18 }],
  },
});
