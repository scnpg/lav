import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useColorScheme } from "react-native";

import { colors as paperColors, nocturneColors } from "./tokens";
import type { ColorTokens } from "./tokens";

export type ThemeMode = "paper" | "nocturne" | "system";
export type ColorScheme = "paper" | "nocturne";

interface ThemeContextValue {
  /** The user's stored preference, including "system". */
  mode: ThemeMode;
  /** Resolved - always one of the two real palettes, never "system". */
  scheme: ColorScheme;
  colors: ColorTokens;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
}

const STORAGE_KEY = "lav_theme_mode";

const ThemeContext = createContext<ThemeContextValue | null>(null);

// Must mount unconditionally, outermost, never gated behind a "ready" flag
// the way initLanguage()/languageReady gates first render (see app/_layout.tsx) -
// LoadingScreen itself renders theme-aware components (the tile logo, the
// shapeshifting loader, the animated background), so if ThemeProvider only
// mounted after some async readiness check, useTheme() would throw during
// the very loading screen meant to cover that wait. Resolving "system" is
// synchronous (useColorScheme() has a value on first render, no storage
// round-trip needed), so only an explicit stored Paper/Nocturne override
// applies a beat later - the same "brief flash before the persisted choice
// applies" tradeoff src/i18n/index.ts already accepts for language.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === "paper" || saved === "nocturne" || saved === "system") {
        setModeState(saved);
      }
    });
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next);
  }, []);

  const scheme: ColorScheme = mode === "system" ? (systemScheme === "dark" ? "nocturne" : "paper") : mode;
  const colors = scheme === "nocturne" ? nocturneColors : paperColors;

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, scheme, colors, isDark: scheme === "nocturne", setMode }),
    [mode, scheme, colors, setMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
