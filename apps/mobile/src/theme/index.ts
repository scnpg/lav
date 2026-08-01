import { Platform } from "react-native";
import { colors, nocturneColors, spacing, radii, fontSize, fontWeight, lineHeight } from "./tokens";
import type { ColorTokens } from "./tokens";

export { colors, nocturneColors, spacing, radii, fontSize, fontWeight, lineHeight };
export type { ColorTokens };
export { useTheme, ThemeProvider } from "./ThemeContext";
export type { ThemeMode, ColorScheme } from "./ThemeContext";
export { useThemedStyles } from "./useThemedStyles";
export { serif, FONTS_TO_LOAD } from "./fonts";

/**
 * Cross-platform card/elevated-surface shadow. iOS uses shadow*, Android uses
 * elevation, web uses boxShadow. `scheme` defaults to "paper" so every
 * not-yet-migrated call site (still calling `cardShadow("sm")` with no second
 * argument) keeps its current look until that file is migrated - an accepted,
 * visible-but-minor artifact of the phased Nocturne rollout, not a bug.
 */
export function cardShadow(level: "sm" | "md" = "sm", scheme: "paper" | "nocturne" = "paper") {
  if (Platform.OS === "android") {
    return { elevation: level === "sm" ? 2 : 6 };
  }
  const dark = scheme === "nocturne";
  if (Platform.OS === "web") {
    return {
      boxShadow: dark
        ? level === "sm"
          ? "0 1px 3px rgba(0, 0, 0, 0.45)"
          : "0 4px 16px rgba(0, 0, 0, 0.55)"
        : level === "sm"
          ? "0 1px 3px rgba(37, 40, 36, 0.08)"
          : "0 4px 16px rgba(37, 40, 36, 0.12)",
    } as Record<string, string>;
  }
  return {
    shadowColor: dark ? "#000000" : colors.textPrimary,
    shadowOpacity: dark ? (level === "sm" ? 0.35 : 0.5) : level === "sm" ? 0.06 : 0.12,
    shadowRadius: level === "sm" ? 4 : 12,
    shadowOffset: { width: 0, height: level === "sm" ? 1 : 4 },
  };
}
