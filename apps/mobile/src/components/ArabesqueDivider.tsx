import { StyleSheet, View } from "react-native";

import { useTheme } from "../theme";

interface ArabesqueDividerProps {
  color?: string;
  /** How many diamonds span the strip - it stretches to fill its container either way (flex + space-between), this just controls density. */
  count?: number;
  size?: number;
}

// A thin repeating-diamond strip - the classic Andalusian/Moorish "dado"
// border tile motif, in miniature. Deliberately used as a sparing accent
// (a header's bottom edge, a card divider) rather than a border wrapped
// around whole screens - a full picture-frame border on every surface would
// fight the content instead of framing it. Same rotated-square trick as
// EightPointedStar, just one square instead of two, repeated in a row.
export function ArabesqueDivider({ color, count = 16, size = 6 }: ArabesqueDividerProps) {
  const { colors } = useTheme();
  const resolvedColor = color ?? colors.accent;
  return (
    <View style={styles.row} pointerEvents="none">
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[styles.diamond, { width: size, height: size, borderColor: resolvedColor }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    opacity: 0.5,
  },
  diamond: {
    borderWidth: 1,
    transform: [{ rotate: "45deg" }],
  },
});
