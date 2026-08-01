import { EBGaramond_400Regular_Italic, EBGaramond_500Medium } from "@expo-google-fonts/eb-garamond";

/**
 * The one custom font family in the app, reserved for "voice" moments only -
 * the Lav wordmark and each screen's single hero tagline directly under it
 * (see LavLogo.tsx and each auth screen's description text). Everything
 * else (buttons, labels, form fields, body copy, list items) stays on the
 * system default sans font on purpose - loading a second full family (e.g.
 * Inter) and migrating every existing fontWeight usage across the app would
 * multiply this redesign's scope for a much less visually distinctive
 * payoff than the serif alone already delivers.
 */
export const FONTS_TO_LOAD = {
  EBGaramond_500Medium,
  EBGaramond_400Regular_Italic,
} as const;

export const serif = {
  medium: "EBGaramond_500Medium",
  italic: "EBGaramond_400Regular_Italic",
} as const;
