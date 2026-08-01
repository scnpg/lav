import { useMemo } from "react";
import { StyleSheet } from "react-native";

import { useTheme } from "./ThemeContext";
import type { ColorTokens } from "./tokens";

/**
 * The one conversion pattern every screen/component uses to become
 * theme-reactive: StyleSheet.create() normally runs once at module-eval
 * time, before any component has mounted, so a plain color-object swap or a
 * naive context read can't make an already-built style object change later.
 * This moves that creation into render (memoized on the live color object,
 * so it isn't rebuilt every render - only when the palette actually
 * changes).
 */
export function useThemedStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (colors: ColorTokens) => T
): T {
  const { colors } = useTheme();
  // Deliberately keyed on `colors` alone, not `factory` - the factory arrow
  // function is a fresh closure every render by construction (call sites
  // write `useThemedStyles((c) => ({...}))` inline), so including it would
  // defeat the memoization entirely and rebuild the StyleSheet every render.
  return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
}
