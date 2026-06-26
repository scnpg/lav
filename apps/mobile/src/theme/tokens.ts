// Lav design tokens. Minimalist, premium, slightly playful - see README
// "Design requirements". No NativeWind/Tailwind here on purpose: this stack
// pins Expo SDK 56 / React 19.2 / RN 0.85 / Babel 8, all newer than
// NativeWind 4.2.6's tested range, so we use a small hand-rolled token +
// StyleSheet system instead of betting the build on an unverified babel
// plugin. Keeps the same "utility scale" ergonomics Tailwind gives you.

export const colors = {
  background: "#FAFAF8",
  surface: "#FFFFFF",
  surfaceMuted: "#F2F1EC",
  border: "#E7E4DC",
  borderStrong: "#D7D3C7",

  textPrimary: "#1C1B17",
  textSecondary: "#6B6759",
  textMuted: "#9C988A",
  textOnAccent: "#FFFFFF",

  accent: "#0E5E59",
  accentMuted: "#E2EEEC",
  accentStrong: "#0A4642",

  gold: "#B8923A",
  goldMuted: "#F6EDD8",

  success: "#2E7D5B",
  successMuted: "#E3F1E9",
  warning: "#B8862B",
  warningMuted: "#FBF0DC",
  danger: "#B3413A",
  dangerMuted: "#FBE9E7",

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
