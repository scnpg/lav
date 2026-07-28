import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import es from "./locales/es.json";
import zhHant from "./locales/zh-Hant.json";

// Only these three - see the app's language switcher (Profile screen). Not
// every screen has been run through t() yet (this is the foundation: tab
// bar, map chrome, auth, profile chrome, feed tabs) - deeper screens
// (submission wizard, admin, less-common modals) still read English text
// directly and will get their own pass later, not silently mistranslated.
export const SUPPORTED_LANGUAGES = ["en", "zh-Hant", "es"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const STORAGE_KEY = "lav_language";

function detectDeviceLanguage(): SupportedLanguage {
  const tag = Localization.getLocales()[0]?.languageTag ?? "en";
  if (tag.startsWith("zh")) return "zh-Hant";
  if (tag.startsWith("es")) return "es";
  return "en";
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    "zh-Hant": { translation: zhHant },
    es: { translation: es },
  },
  lng: "en", // replaced below once the persisted/device language is known - avoids a flash of the wrong language's resources being requested mid-render
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

/** Call once at app startup (see app/_layout.tsx) - restores a saved choice, or falls back to the device's own language if it's one of the three supported. */
export async function initLanguage(): Promise<void> {
  const saved = await AsyncStorage.getItem(STORAGE_KEY);
  const language = SUPPORTED_LANGUAGES.includes(saved as SupportedLanguage)
    ? (saved as SupportedLanguage)
    : detectDeviceLanguage();
  await i18n.changeLanguage(language);
}

export async function setLanguage(language: SupportedLanguage): Promise<void> {
  await i18n.changeLanguage(language);
  await AsyncStorage.setItem(STORAGE_KEY, language);
}

export function getCurrentLanguage(): SupportedLanguage {
  return (i18n.language as SupportedLanguage) ?? "en";
}

export default i18n;
