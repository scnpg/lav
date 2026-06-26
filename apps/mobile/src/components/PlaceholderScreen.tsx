import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, Text, View } from "react-native";
import type { ReactNode } from "react";

import { colors, fontSize, fontWeight, lineHeight, spacing } from "../theme";

interface PlaceholderScreenProps {
  title: string;
  description?: string;
  children?: ReactNode;
}

/**
 * Shared shell for screens that don't have real data/logic wired up yet.
 * Once a screen grows real content it should stop using this and own its
 * own layout - this is scaffolding, not a permanent abstraction.
 */
export function PlaceholderScreen({ title, description, children }: PlaceholderScreenProps) {
  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing["2xl"],
    paddingTop: spacing["3xl"],
  },
  title: {
    fontSize: fontSize["2xl"],
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    lineHeight: fontSize["2xl"] * lineHeight.tight,
  },
  description: {
    marginTop: spacing.sm,
    fontSize: fontSize.base,
    color: colors.textSecondary,
    lineHeight: fontSize.base * lineHeight.relaxed,
  },
});
