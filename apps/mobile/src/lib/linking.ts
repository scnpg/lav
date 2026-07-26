import { Platform } from "react-native";
import * as Linking from "expo-linking";

// Builds a redirect URL Supabase Auth emails (confirmation, password
// recovery) can send the user back to. Deliberately not just
// Linking.createURL(path) on its own: that returns
// window.location.origin + path on web, and origin has no path component -
// it silently drops the /lav GitHub Pages subpath (see app.json
// experiments.baseUrl and .github/workflows/deploy-web.yml), sending users
// to e.g. https://scnpg.github.io/auth/reset-password instead of
// https://scnpg.github.io/lav/auth/reset-password. This is exactly the bug
// that broke the signup confirmation redirect - fixed at the config level
// there, fixed here at the source so it doesn't depend on a Dashboard
// setting staying in sync with wherever this actually gets deployed.
//
// Native has no such prefix (a custom lav:// scheme instead), so only the
// web branch needs it.
const WEB_BASE_PATH = "/lav";

export function createAuthRedirectUrl(path: string): string {
  if (Platform.OS === "web") {
    return `${window.location.origin}${WEB_BASE_PATH}${path}`;
  }
  return Linking.createURL(path);
}
