import { Ionicons } from "@expo/vector-icons";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fontSize, fontWeight, radii, spacing } from "../../theme";

interface ActionButtonsRowProps {
  bathroomName: string;
}

const ACTIONS = [
  { key: "review", label: "Review", icon: "star-outline" as const },
  { key: "checkin", label: "Check in", icon: "location-outline" as const },
  { key: "save", label: "Save", icon: "bookmark-outline" as const },
  { key: "addToList", label: "Add to list", icon: "list-outline" as const },
  { key: "report", label: "Report", icon: "flag-outline" as const },
];

// All five are inert placeholders - no review/check-in/save/list/report
// writes happen yet, this screen is mock-data only (see PROJECT_HANDOFF.md
// "Still placeholder"). Same Alert.alert pattern as the Map tab's
// "Use my location" button.
export function ActionButtonsRow({ bathroomName }: ActionButtonsRowProps) {
  function handlePress(label: string) {
    Alert.alert(label, `${label} is coming soon for ${bathroomName}. This screen is mock data only for now.`);
  }

  return (
    <View style={styles.row}>
      {ACTIONS.map((action) => {
        const isDestructive = action.key === "report";
        return (
          <Pressable key={action.key} style={styles.button} onPress={() => handlePress(action.label)} hitSlop={6}>
            <View style={[styles.iconCircle, isDestructive && styles.iconCircleDestructive]}>
              <Ionicons name={action.icon} size={19} color={isDestructive ? colors.danger : colors.accentStrong} />
            </View>
            <Text style={styles.buttonLabel}>{action.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  button: {
    alignItems: "center",
    gap: spacing.xs,
    flex: 1,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: colors.accentMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircleDestructive: {
    backgroundColor: colors.dangerMuted,
  },
  buttonLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
