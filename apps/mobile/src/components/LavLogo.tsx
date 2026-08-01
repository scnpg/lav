import { useRouter } from "expo-router";
import { StyleSheet, Text } from "react-native";

import { serif, useTheme } from "../theme";
import { FlowerMark } from "./FlowerMark";
import { PressableScale } from "./PressableScale";
import { TileFrame } from "./ArabesquePattern";

interface LavLogoProps {
  /** Scales the "Lav" wordmark text; the icon tile is derived from this, not set independently. */
  size?: number;
  /** Text color - defaults to the live theme accent. The icon tile always follows the theme regardless of this prop (TileFrame/FlowerMark resolve their own colors). */
  color?: string;
}

// The Lav logo: the traced azulejo-tile flower mark inside a fitted square
// tile frame (so it reads as one glazed ceramic bathroom tile, not a bare
// flower floating with nothing around it - see FlowerMark.tsx/TileFrame in
// ArabesquePattern.tsx, the same primitives ArabesqueLoader's `framed`
// variant uses - the square frame is this app's own addition, not present
// in the Figma reference, kept per an earlier explicit request this
// session), next to "Lav" in the app's one loaded serif (EB Garamond) with
// real small-caps (`fontVariant: ["small-caps"]` - confirmed react-native-web
// maps this straight to CSS `font-variant`, so no size-approximation trick
// is needed here, unlike an earlier pass of this file).
//
// Always tappable, back to the Map tab - the standard "logo is a home
// link" convention. Every call site (the four tab headers, the three auth
// screens) gets this for free rather than opting in per screen; tapping it
// from an auth screen just navigates to "/", which AuthGatedStack's own
// redirect (app/_layout.tsx) immediately bounces back to sign-in for a
// signed-out user - a harmless no-op there, not a special case to guard.
export function LavLogo({ size = 28, color }: LavLogoProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const resolvedColor = color ?? colors.accent;
  const tileSize = size * 1.15;

  return (
    <PressableScale
      style={styles.row}
      onPress={() => router.push("/")}
      accessibilityRole="button"
      accessibilityLabel="Lav home - go to map"
    >
      <TileFrame size={tileSize}>
        <FlowerMark size={tileSize * 0.7} sw={1.1} />
      </TileFrame>
      <Text style={[styles.text, { fontSize: size, color: resolvedColor }]}>Lav</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  text: {
    fontFamily: serif.medium,
    letterSpacing: 0.5,
    fontVariant: ["small-caps"],
  },
});
