import { Platform } from "react-native";
import { colors, spacing, radii, fontSize, fontWeight, lineHeight } from "./tokens";

export { colors, spacing, radii, fontSize, fontWeight, lineHeight };

/** Cross-platform card/elevated-surface shadow. iOS uses shadow*, Android uses elevation, web uses boxShadow. */
export function cardShadow(level: "sm" | "md" = "sm") {
  if (Platform.OS === "android") {
    return { elevation: level === "sm" ? 2 : 6 };
  }
  if (Platform.OS === "web") {
    return {
      boxShadow:
        level === "sm" ? "0 1px 3px rgba(37, 40, 36, 0.08)" : "0 4px 16px rgba(37, 40, 36, 0.12)",
    } as Record<string, string>;
  }
  return {
    shadowColor: colors.textPrimary,
    shadowOpacity: level === "sm" ? 0.06 : 0.12,
    shadowRadius: level === "sm" ? 4 : 12,
    shadowOffset: { width: 0, height: level === "sm" ? 1 : 4 },
  };
}
