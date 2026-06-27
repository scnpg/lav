import { Link } from "expo-router";
import { StyleSheet, Text } from "react-native";

import { PlaceholderScreen } from "../../src/components/PlaceholderScreen";
import { colors, fontWeight, spacing } from "../../src/theme";

export default function ProfileScreen() {
  return (
    <PlaceholderScreen
      title="Profile"
      description="Your saved bathrooms, check-ins, reviews, and lists will show up here once it's connected to Supabase."
    >
      <Link href="/auth/sign-in" style={styles.link}>
        <Text style={styles.linkText}>Sign in</Text>
      </Link>
    </PlaceholderScreen>
  );
}

const styles = StyleSheet.create({
  link: {
    marginTop: spacing["2xl"],
  },
  linkText: {
    color: colors.textPrimary,
    fontWeight: fontWeight.semibold,
  },
});
