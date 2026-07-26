// Centralized, typed access to EXPO_PUBLIC_* env vars. Expo inlines these at
// build time (see .env.example) - importing through this module (instead of
// reaching for process.env.* throughout the app) means there's exactly one
// place that throws a clear error if setup was skipped.
//
// Each var below MUST be a literal `process.env.EXPO_PUBLIC_X` member
// expression, not routed through a helper that reads `process.env[name]`
// dynamically (which this file used to do). Metro's static inliner only
// pattern-matches the literal access point itself - it doesn't trace a
// variable name back through a function call. The dynamic version happened
// to still work in `expo start` (Metro's dev server exposes a real,
// populated process.env object at runtime), which is why this went
// unnoticed through everything tested locally - it only breaks in
// `expo export`'s production bundle, which has no such runtime object and
// relies entirely on the static replacement.
export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  mapStyleUrl: process.env.EXPO_PUBLIC_MAP_STYLE_URL,
};

export function assertSupabaseEnv(): { url: string; anonKey: string } {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    throw new Error(
      "Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY.\n" +
        "Copy apps/mobile/.env.example to apps/mobile/.env and fill in your Supabase project's " +
        "URL and anon key (Project Settings > API in the dashboard, or `supabase status` for local dev), " +
        "then restart `expo start`."
    );
  }
  return { url: env.supabaseUrl, anonKey: env.supabaseAnonKey };
}
