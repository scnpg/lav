import "react-native-get-random-values";
import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

import { assertSupabaseEnv } from "./env";
import type { Database } from "../types/database";

const { url, anonKey } = assertSupabaseEnv();

export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    // AsyncStorage (not expo-secure-store) on purpose: a Supabase session
    // payload (access + refresh token + user metadata) can exceed
    // SecureStore's per-item size limit on Android. On web, omitting
    // `storage` lets supabase-js use window.localStorage automatically.
    storage: Platform.OS === "web" ? undefined : AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: Platform.OS === "web",
  },
});
