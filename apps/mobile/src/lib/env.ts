// Centralized, typed access to EXPO_PUBLIC_* env vars. Expo inlines these at
// build time (see .env.example) - importing through this module (instead of
// reaching for process.env.* throughout the app) means there's exactly one
// place that throws a clear error if setup was skipped.

function readPublicEnv(name: string): string | undefined {
  // process.env.EXPO_PUBLIC_* is statically replaced by Metro, so the key
  // must be referenced as a literal property access somewhere for the
  // inlining to work - this helper is only ever called with literals below.
  return process.env[name];
}

export const env = {
  supabaseUrl: readPublicEnv("EXPO_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: readPublicEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY"),
  mapStyleUrl: readPublicEnv("EXPO_PUBLIC_MAP_STYLE_URL"),
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
