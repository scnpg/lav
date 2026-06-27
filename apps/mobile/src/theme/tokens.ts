// Lav design tokens. Muted oasis palette - calm, clean, premium, restroom/
// oasis-themed (deliberately not the Beli-esque dark teal it used to be -
// see git history for the previous palette if you need to compare). No
// NativeWind/Tailwind here on purpose: this stack pins Expo SDK 56 /
// React 19.2 / RN 0.85 / Babel 8, all newer than NativeWind 4.2.6's tested
// range, so we use a small hand-rolled token + StyleSheet system instead of
// betting the build on an unverified babel plugin. Keeps the same
// "utility scale" ergonomics Tailwind gives you.
//
// Contrast note: every accent color below (teal/sky/sand/green/clay/rose)
// is a light-to-mid pastel, so none of them are legible as small
// foreground text/icon color directly on the bone-white background -
// checked against WCAG contrast math, they land around 2.3-3:1, well under
// the 4.5:1 normal-text bar. The working pattern across every component:
// use these colors as FILLS (button/chip/badge/pin backgrounds) with
// textOnAccent (ink) on top, never as bare text color on bone-white/card.
// accentStrong is reserved for icon-only uses (tab bar, locate button)
// where the looser 3:1 non-text contrast guideline applies.
export const colors = {
  background: "#FAF7EF", // bone white
  surface: "#FFFDF8", // card surface
  surfaceMuted: "#F1ECDF", // neutral muted fill (progress tracks, etc - not chip backgrounds, see `sand`)
  border: "#E7E1D6", // soft border gray
  borderStrong: "#D8CFBE",

  textPrimary: "#252824", // deep ink
  textSecondary: "#6F6A5F", // muted secondary
  textMuted: "#96907F",
  textOnAccent: "#252824", // ink - the correct text color on every fill below, see contrast note
  textOnOverlay: "#FFFFFF", // text/icons over colors.overlay (a dark scrim), NOT over an accent fill

  accent: "#6FB7B2", // lagoon teal - primary buttons, selected states, important CTAs
  accentMuted: "#E3EFEE",
  accentStrong: "#5EA6A1", // lagoon teal pressed/darker

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
