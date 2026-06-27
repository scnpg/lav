import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, fontSize, fontWeight, spacing } from "../src/theme";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Not found" }} />
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>This page doesn't exist.</Text>
          <Link href="/" style={styles.link}>
            <Text style={styles.linkText}>Go back to the map</Text>
          </Link>
        </View>
      </SafeAreaView>
    </>
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
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  link: {
    marginTop: spacing.sm,
  },
  linkText: {
    color: colors.textPrimary,
    fontWeight: fontWeight.semibold,
  },
});
