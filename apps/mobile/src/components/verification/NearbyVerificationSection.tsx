import { StyleSheet, Text, View } from "react-native";

import { MOCK_VERIFICATION_CANDIDATES } from "../../features/verification/mockCandidates";
import { colors, fontSize, spacing } from "../../theme";
import { VerificationCard } from "./VerificationCard";

// Mock-only preview of the crowd verification queue. Real version is
// gated by the anti-spam rules in src/features/verification/rules.ts -
// geofenced to nearby candidates, capped per day, never repeating a
// candidate to the same user. This screen has no backend/session tracking
// yet, so every mock candidate always shows.
export function NearbyVerificationSection() {
  return (
    <View style={styles.container}>
      <Text style={styles.intro}>
        Help confirm whether these imported candidates actually exist. Answers are opt-in and never required.
      </Text>
      {MOCK_VERIFICATION_CANDIDATES.map((candidate) => (
        <VerificationCard key={candidate.id} candidate={candidate} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  intro: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
});
