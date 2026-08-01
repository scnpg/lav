// Lav design tokens. "Paper" - verbatim from the real Figma Make source
// (T.light in the current App.tsx export, confirmed by downloading and
// reading the actual project code - see git history/plan for how an earlier
// pass got this wrong from a stale export). Warm parchment base, muted
// ink-blue accent (not a saturated corporate blue), warm ink text. No
// NativeWind/Tailwind here on purpose: this stack pins Expo SDK 56 /
// React 19.2 / RN 0.85 / Babel 8, all newer than NativeWind 4.2.6's tested
// range, so we use a small hand-rolled token + StyleSheet system instead of
// betting the build on an unverified babel plugin.
//
// Contrast note: sand/sky/gold/success/warning/danger below are all
// light-to-mid pastels, so none of them are legible as small foreground
// text/icon color directly on the parchment background. The working pattern
// across every component: use these colors as FILLS (button/chip/badge/pin
// backgrounds) with textOnAccent on top, never as bare text color on
// background/card. `textOnAccent` is the surface color itself (not white) -
// `accent` is a muted, mid-value navy, dark enough that the parchment
// surface tone reads clearly on top of it (confirmed against the reference:
// the "SIGN IN" button uses `color: c.surface` on `background: c.accent`).
export const colors = {
  background: "#FAF7F0", // warm parchment - the screen background
  surface: "#F2EDE2", // raised card/sheet/input base
  surfaceMuted: "#EAE3D5", // overlay/muted fill (progress tracks, etc)
  border: "#DDD6C8", // hairline rule
  borderStrong: "#C7BCA1",

  textPrimary: "#1F1D1A", // deep ink
  textSecondary: "#6E675E", // muted secondary
  textMuted: "#6E675E",
  textOnAccent: "#FAF7F0", // the surface/parchment color itself, not white - accent is a mid-value muted navy, not dark+saturated
  textOnOverlay: "#FFFFFF", // text/icons over colors.overlay (a dark scrim), NOT over an accent fill

  accent: "#3D5488", // muted ink-blue - primary buttons, selected states, important CTAs
  accentMuted: "#DDE3EF",
  accentStrong: "#2A3B63", // pressed/darker navy

  sky: "#B8C4DC", // map accents, selected map pins, distance badges, calm informational surfaces
  skyMuted: "#EDF0F6",

  sand: "#E8D9B8", // chips, access tags, amenity pills, soft highlights
  sandMuted: "#F5EDDC",

  gold: "#B8923A", // unchanged - star ratings, kept distinct from the warning/clay semantics below
  goldMuted: "#F3E8D2",

  success: "#4F6F66", // "cool" in the Figma source - verified, open now, accessible, high-score states
  successMuted: "#E1EAE6",
  warning: "#8C4630", // "warm" in the Figma source - purchase required, code required, limited access, needs verification
  warningMuted: "#F0E0D6",
  danger: "#8C3A2E", // optional negative states
  dangerMuted: "#F0DBD6",

  overlay: "rgba(31, 29, 26, 0.45)",
} as const;

// "Nocturne" - the dark counterpart to the palette above, wired up via
// ThemeContext.tsx/useTheme(). Same key shape as `colors` so every consumer
// (useThemedStyles factories) can swap between the two without touching
// anything else. Source: a Figma Make export the user provided, extracted
// verbatim from that prototype's theme.css (see git history/plan for the
// extraction) - background/surface/surfaceMuted/border/textPrimary/
// textMuted/accent/accentMuted/accentStrong/success/warning/danger below are
// the exact hex values from that source, not eyeballed. Every other key is
// interpolated to match the same shape.
//
// textOnAccent flips to dark ink here (unlike the light palette's white):
// `accent` in Nocturne is a *light* periwinkle (#8FA6D8), so white text on
// it would fail contrast - confirmed against the reference screenshot,
// whose primary button shows dark navy text on the light blue fill, not
// white. `overlay` is deliberately NOT a flat hex like the other surfaces:
// it's always paired with textOnOverlay as a translucent scrim layered over
// photos/content, so it stays a dark rgba here too, just deeper than the
// light palette's.
export const nocturneColors = {
  background: "#14161B",
  surface: "#1B1E25",
  surfaceMuted: "#22262F",
  border: "#333944",
  borderStrong: "#454C5A",

  textPrimary: "#EDE7DA",
  textSecondary: "#C9C2B4",
  textMuted: "#A39C91",
  textOnAccent: "#14161B",
  textOnOverlay: "#FFFFFF",

  accent: "#8FA6D8",
  accentMuted: "#2A3350",
  accentStrong: "#B3C3E6",

  sky: "#6E88BE",
  skyMuted: "#1E2536",

  sand: "#C9AD7C",
  sandMuted: "#2A2418",

  gold: "#D4B268",
  goldMuted: "#332B1C",

  success: "#7FA79A",
  successMuted: "#212F2B",
  warning: "#D08A6A",
  warningMuted: "#3A2C24",
  danger: "#D9765F",
  dangerMuted: "#3A2521",

  overlay: "rgba(8, 9, 12, 0.6)",
} as const;

/**
 * The shape every palette (light `colors` or dark `nocturneColors`) must
 * match - widened to plain `string` per key (rather than `typeof colors`
 * directly), since that would pin every value to `colors`' own literal hex
 * strings and reject `nocturneColors`' different ones.
 */
export type ColorTokens = { [K in keyof typeof colors]: string };

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
