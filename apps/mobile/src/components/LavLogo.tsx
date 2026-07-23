import { useRouter } from "expo-router";
import { Platform, StyleSheet, Text } from "react-native";
import Svg, { Circle, Path, Polygon } from "react-native-svg";

import { colors, fontWeight } from "../theme";
import { PressableScale } from "./PressableScale";

interface LavLogoProps {
  /** Scales the "Lav" wordmark text; the icon is derived from this (see CAP_HEIGHT_RATIO below), not set independently. */
  size?: number;
  /** Text color - the icon always uses the ceramic-blue pair below, independent of this. */
  color?: string;
}

// The icon's two-tone palette (a brighter blue for the main linework, a
// darker navy for the center accent, evoking the two-tone contrast in
// traditional glazed tilework) - aliased from the shared theme tokens
// rather than its own hardcoded hex, since colors.accent/accentStrong ARE
// this same deep Spanish ceramic blue pair now (see tokens.ts).
const CERAMIC_BLUE = colors.accent;
const CERAMIC_BLUE_DARK = colors.accentStrong;

// Times New Roman's own cap-height metric (the height of a capital letter
// like "L" above the baseline) is ~0.662em - a fixed, documented property of
// this specific typeface, not something derivable from RN's Text API at
// runtime. The icon's own width/height are pinned to this so it always
// matches the "L"'s actual glyph height exactly, at any `size`.
const CAP_HEIGHT_RATIO = 0.662;

const FONT_FAMILY = Platform.select({
  ios: "Times New Roman",
  android: "serif",
  default: "'Times New Roman', Times, serif",
});

// An 8-pointed geometric star (16-point polygon, alternating outer/inner
// radius every 22.5deg) with a small center rosette and four corner
// flourish arcs - an original composition in the general Spanish/Andalusian
// glazed-tile genre (a centuries-old public-domain motif family: 8-point
// stars and rosettes appear across countless historical tile traditions),
// not a reproduction of any specific tile artwork. Computed once against a
// fixed 0-100 viewBox; <Svg width/height> does the actual size scaling, so
// there's no per-render trig - see the star's own path comment for the math.
const STAR_POINTS =
  "50,8 56.89,33.57 79.70,20.30 66.63,43.11 92,50 66.63,56.89 79.70,79.70 56.89,66.63 " +
  "50,92 43.11,66.63 20.30,79.70 33.37,56.89 8,50 33.37,43.11 20.30,20.30 43.11,33.37";

// Six petals (r=7) ringed at radius 11 around the center (60deg apart),
// plus the center dot itself - a simple daisy/rosette construction.
const PETAL_CENTERS: [number, number][] = [
  [61, 50],
  [55.5, 59.53],
  [44.5, 59.53],
  [39, 50],
  [44.5, 40.47],
  [55.5, 40.47],
];

// Small quarter-circle curls inset in each corner - a light echo of the
// scrollwork corner flourishes traditional tile medallions use to frame the
// central motif, kept deliberately simple ("minimalist," per the brief)
// rather than an elaborate scroll.
const CORNER_FLOURISHES = [
  "M 6 20 Q 6 6 20 6",
  "M 80 6 Q 94 6 94 20",
  "M 94 80 Q 94 94 80 94",
  "M 20 94 Q 6 94 6 80",
];

function TileIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Polygon points={STAR_POINTS} fill="none" stroke={CERAMIC_BLUE} strokeWidth={3} strokeLinejoin="round" />
      {CORNER_FLOURISHES.map((d) => (
        <Path key={d} d={d} fill="none" stroke={CERAMIC_BLUE} strokeWidth={2.5} strokeLinecap="round" />
      ))}
      {PETAL_CENTERS.map(([cx, cy]) => (
        <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={7} fill={CERAMIC_BLUE} opacity={0.85} />
      ))}
      <Circle cx={50} cy={50} r={4.5} fill={CERAMIC_BLUE_DARK} />
    </Svg>
  );
}

// The Lav logo: an 8-pointed Spanish-tile star + rosette icon, sized to
// exactly match the cap-height of the "L" in "Lav" (see CAP_HEIGHT_RATIO),
// to the left of "Lav" set in Times New Roman - a serif wordmark
// deliberately unlike every sans-serif UI label elsewhere in the app, so
// the logo reads as a mark, not just another button. Times New Roman is a
// true native font on iOS and resolves via the browser's own font stack on
// web; stock Android has no exact match, so it falls back to the "serif"
// generic family there (RN's Android renderer does support that generic
// alias, unlike an exact font name it doesn't have installed) rather than
// silently dropping to the default sans system font.
//
// Always tappable, back to the Map tab - the standard "logo is a home
// link" convention. Every call site (the four tab headers, the three auth
// screens) gets this for free rather than opting in per screen; tapping it
// from an auth screen just navigates to "/", which AuthGatedStack's own
// redirect (app/_layout.tsx) immediately bounces back to sign-in for a
// signed-out user - a harmless no-op there, not a special case to guard.
export function LavLogo({ size = 28, color = CERAMIC_BLUE }: LavLogoProps) {
  const router = useRouter();
  const capHeight = size * CAP_HEIGHT_RATIO;
  return (
    <PressableScale
      style={styles.row}
      onPress={() => router.push("/")}
      accessibilityRole="button"
      accessibilityLabel="Lav home - go to map"
    >
      <TileIcon size={capHeight} />
      <Text style={[styles.text, { fontSize: size, color }]}>Lav</Text>
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
    fontFamily: FONT_FAMILY,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.3,
  },
});
