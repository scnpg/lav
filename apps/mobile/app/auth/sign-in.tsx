import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Wordmark } from "../../src/components/Wordmark";
import { colors, fontSize, lineHeight, spacing } from "../../src/theme";

// Placeholder only - no Supabase auth wired up yet. Real sign-in/sign-up
// (src/lib/auth.tsx's AuthProvider) gets connected to this screen once the
// app talks to Supabase.
export default function SignInScreen() {
  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
      <View style={styles.content}>
        <Wordmark size={32} />
        <Text style={styles.description}>Sign in is coming soon.</Text>
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
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing["2xl"],
    gap: spacing.md,
  },
  description: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    lineHeight: fontSize.base * lineHeight.relaxed,
  },
});
