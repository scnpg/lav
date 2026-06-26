import { StyleSheet, Text } from "react-native";

import { colors, fontWeight } from "../theme";

interface WordmarkProps {
  size?: number;
  color?: string;
}

/** The "Lav." wordmark - always with the trailing period, per brand. */
export function Wordmark({ size = 28, color = colors.textPrimary }: WordmarkProps) {
  return <Text style={[styles.text, { fontSize: size, color }]}>Lav.</Text>;
}

const styles = StyleSheet.create({
  text: {
    fontWeight: fontWeight.bold,
    letterSpacing: -0.5,
  },
});
