import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BadgeGrid } from "../../src/components/profile/BadgeGrid";
import { CartographerProgress } from "../../src/components/profile/CartographerProgress";
import { CityFounderRow } from "../../src/components/profile/CityFounderRow";
import { LevelHeader } from "../../src/components/profile/LevelHeader";
import { LevelProgressBar } from "../../src/components/profile/LevelProgressBar";
import { StatsGrid } from "../../src/components/profile/StatsGrid";
import { MOCK_PROFILE } from "../../src/features/profile/mockAchievements";
import { colors, fontSize, fontWeight, radii, spacing } from "../../src/theme";

// Mock achievements/level screen - no Supabase, no auth, no real points
// anywhere in this file. See src/features/profile/mockAchievements.ts and
// src/features/profile/badges.ts for the TODO(achievements) notes on what a
// real backend-backed version of this screen needs.
export default function ProfileScreen() {
  const profile = MOCK_PROFILE;

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.previewBanner}>
          <Ionicons name="information-circle-outline" size={16} color={colors.textPrimary} />
          <Text style={styles.previewBannerText}>
            Preview only - this is mock data, not your real progress.{" "}
            <Link href="/auth/sign-in" style={styles.signInLink}>
              Sign in
            </Link>{" "}
            once accounts are connected.
          </Text>
        </View>

        <View style={styles.section}>
          <LevelHeader displayName={profile.displayName} lavLevel={profile.lavLevel} />
          <LevelProgressBar
            lavLevel={profile.lavLevel}
            totalPoints={profile.totalPoints}
            currentLevelStartPoints={profile.currentLevelStartPoints}
            nextLevelPoints={profile.nextLevelPoints}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contribution stats</Text>
          <StatsGrid stats={profile.stats} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cartographer progress</Text>
          <CartographerProgress stats={profile.stats} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>City Founder</Text>
          <CityFounderRow cities={profile.cityContributions} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Badges</Text>
          <BadgeGrid stats={profile.stats} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing["2xl"],
  },
  previewBanner: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.skyMuted,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  previewBannerText: {
    flex: 1,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    lineHeight: fontSize.xs * 1.5,
  },
  signInLink: {
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
});
