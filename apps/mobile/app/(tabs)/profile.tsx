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
import { NearbyVerificationSection } from "../../src/components/verification/NearbyVerificationSection";
import { MOCK_PROFILE } from "../../src/features/profile/mockAchievements";
import { colors, fontSize, fontWeight, radii, spacing } from "../../src/theme";

// Mock achievements/level screen - no Supabase, no auth, no real points
// anywhere in this file. See src/features/profile/mockAchievements.ts and
// src/features/profile/badges.ts for the TODO(achievements) notes on what a
// real backend-backed version of this screen needs, and
// src/features/verification/rules.ts for the anti-spam/moderation notes
// behind the "Nearby verification tasks" section.
//
// contentInner caps the page at maxWidth and centers it (scrollContent
// just centers the ScrollView's content horizontally) so this doesn't
// stretch into a single sparse column on a wide desktop browser - see
// ResponsiveGrid.tsx for how the badge/founder grids adapt within that cap.
export default function ProfileScreen() {
  const profile = MOCK_PROFILE;

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.contentInner}>
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
            <Text style={styles.sectionTitle}>Nearby verification tasks</Text>
            <NearbyVerificationSection />
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
    alignItems: "center",
    paddingVertical: spacing.lg,
  },
  contentInner: {
    width: "100%",
    maxWidth: 1040,
    paddingHorizontal: spacing.lg,
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
