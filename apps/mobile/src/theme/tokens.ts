// Lav design tokens. Warm porcelain/ceramic tile palette - an ivory base and
// soft cream card surfaces with a deep Spanish ceramic blue as the primary
// accent, evoking glazed tilework in full warm light rather than a cool
// whitewashed-plaster look or a flat corporate blue (see git history for
// prior palettes - this one intentionally warms back up from an even more
// recent cooler near-white pass). No NativeWind/Tailwind here on purpose:
// this stack pins Expo SDK 56 / React 19.2 / RN 0.85 / Babel 8, all newer
// than NativeWind 4.2.6's tested range, so we use a small hand-rolled token
// + StyleSheet system instead of betting the build on an unverified babel
// plugin. Keeps the same "utility scale" ergonomics Tailwind gives you.
//
// Contrast note: sand/sky/gold/success/warning/danger below are all
// light-to-mid pastels, so none of them are legible as small foreground
// text/icon color directly on the ivory background - checked against WCAG
// contrast math, they land around 2.3-4:1, well under the 4.5:1 normal-text
// bar. The working pattern across every component: use these colors as
// FILLS (button/chip/badge/pin backgrounds) with textOnAccent (ink) on top,
// never as bare text color on background/card. `accent`/`accentStrong`
// specifically are NOT pastels - they're a genuinely dark, saturated blue,
// which is why textOnAccent is white rather than ink (every call site that
// uses textOnAccent pairs it with an accent/accentStrong fill - confirmed by
// grep, not a token shared with the pastel chips above).
export const colors = {
  background: "#FDFBF7", // warm porcelain/ivory - the screen background
  surface: "#F5F2EB", // soft cream ceramic - card/sheet/input bases
  surfaceMuted: "#EFEAE0", // neutral muted fill (progress tracks, etc - not chip backgrounds, see `sand`), warmed to match
  border: "#E5DFD1", // soft warm border
  borderStrong: "#D6CDB8",

  textPrimary: "#252824", // deep ink
  textSecondary: "#6F6A5F", // muted secondary
  textMuted: "#96907F",
  textOnAccent: "#FFFFFF", // white - accent/accentStrong are dark+saturated now, not pastel; see contrast note
  textOnOverlay: "#FFFFFF", // text/icons over colors.overlay (a dark scrim), NOT over an accent fill

  accent: "#2563EB", // deep Spanish ceramic blue - primary buttons, selected states, important CTAs
  accentMuted: "#DCE7FB",
  accentStrong: "#1E3A8A", // ceramic blue, pressed/darker navy

  sky: "#BBCCF2", // map accents, selected map pins, distance badges, calm informational surfaces
  skyMuted: "#EAF0FC",

  sand: "#F2E1BB", // chips, access tags, amenity pills, soft highlights
  sandMuted: "#FAF1DE",

  gold: "#B8923A", // unchanged - star ratings, kept distinct from the warning/clay semantics below
  goldMuted: "#F6EDD8",

  success: "#7E9F75", // palm green - verified, open now, accessible, high-score states
  successMuted: "#E8EFE2",
  warning: "#C99F73", // muted clay - purchase required, code required, limited access, needs verification
  warningMuted: "#F4E9DA",
  danger: "#C9827A", // dusty rose - optional negative states
  dangerMuted: "#F6E5E1",

  overlay: "rgba(20, 19, 16, 0.45)",
} as const;

// Recorded for a future dark-mode pass - NOT wired up to anything yet.
// There's no color-scheme switching infrastructure in this app today
// (app.json pins userInterfaceStyle to "light", and every screen imports
// `colors` above as a single static object, not a reactive theme) - actually
// supporting dark mode means every one of those call sites switching off
// useColorScheme, a much larger job than a palette swap. This just keeps
// the two values on file so that work has a starting point.
export const darkColors = {
  background: "#181816",
  surface: "#242320",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

export const fontSize = {
  xs: 12,
  sm: 13,
  base: 15,
  md: 16,
  lg: 18,
  xl: 20,
  "2xl": 24,
  "3xl": 30,
} as const;

export const fontWeight = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const;

export const lineHeight = {
  tight: 1.15,
  normal: 1.35,
  relaxed: 1.55,
} as const;
