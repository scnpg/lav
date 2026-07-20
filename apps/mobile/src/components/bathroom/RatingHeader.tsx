import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { colors, fontSize, fontWeight, radii, spacing } from "../../theme";

interface RatingHeaderProps {
  globalAverage: number | null;
  reviewCount: number;
  yourRating: number | null;
}

function formatTen(value: number): string {
  return value.toFixed(1);
}

// "Global: 8.7 | Yours: 9.2" - the headline number on the redesigned
// bathroom screen. Either half falls back to a plain dash rather than 0.0
// when there's no data yet (0.0 would read as "rated zero", not "unrated").
export function RatingHeader({ globalAverage, reviewCount, yourRating }: RatingHeaderProps) {
  return (
    <View style={styles.row}>
      <View style={styles.block}>
        <Text style={styles.label}>Global</Text>
        <View style={styles.valueRow}>
          <Ionicons name="star" size={20} color={colors.gold} />
          <Text style={styles.value}>{globalAverage !== null ? formatTen(globalAverage) : "—"}</Text>
        </View>
        <Text style={styles.subtext}>
          {reviewCount} log{reviewCount === 1 ? "" : "s"}
        </Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.block}>
        <Text style={styles.label}>Yours</Text>
        <View style={styles.valueRow}>
          <Ionicons name="person" size={18} color={colors.accentStrong} />
          <Text style={[styles.value, yourRating === null && styles.valueMuted]}>
            {yourRating !== null ? formatTen(yourRating) : "Not yet"}
          </Text>
        </View>
        <Text style={styles.subtext}>{yourRating !== null ? "Rated" : "Rate & log"}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  block: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  divider: {
    width: 1,
    alignSelf: "stretch",
    backgroundColor: colors.border,
    marginHorizontal: spacing.sm,
  },
  label: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  value: {
    fontSize: fontSize["2xl"],
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  valueMuted: {
    fontSize: fontSize.lg,
    color: colors.textMuted,
  },
  subtext: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
});
