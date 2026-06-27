import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { colors, fontSize, fontWeight, radii, spacing } from "../../theme";

interface LevelHeaderProps {
  displayName: string;
  lavLevel: number;
}

export function LevelHeader({ displayName, lavLevel }: LevelHeaderProps) {
  const initial = displayName.trim().charAt(0).toUpperCase() || "?";

  return (
    <View style={styles.row}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initial}</Text>
      </View>
      <View style={styles.textBlock}>
        <Text style={styles.name}>{displayName}</Text>
        <View style={styles.levelRow}>
          <Ionicons name="trophy-outline" size={14} color={colors.textPrimary} />
          <Text style={styles.levelText}>Lav Level {lavLevel}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radii.full,
    backgroundColor: colors.accentMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  textBlock: {
    gap: 4,
  },
  name: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  levelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  levelText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
});
