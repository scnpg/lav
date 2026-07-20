import type { Session, User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { supabase } from "./supabase";
import type { Profile } from "../types/database";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateDisplayName: (displayName: string) => Promise<{ error: string | null }>;
  updateUsername: (username: string) => Promise<{ error: string | null }>;
  completeOnboarding: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
    if (error?.code === "PGRST116") {
      // No profiles row for this session's user - the account was deleted
      // (or a stale session survived in storage past a `delete from
      // auth.users`). Sign out so the rest of the app treats this as
      // logged-out - session going null re-triggers AuthGatedStack's
      // redirect - instead of every screen rendering with profile stuck
      // at null forever.
      await supabase.auth.signOut();
      return;
    }
    setProfile(data ?? null);
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user) await loadProfile(data.session.user.id);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      if (nextSession?.user) {
        await loadProfile(nextSession.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signUpWithPassword = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.user) await loadProfile(session.user.id);
  }, [session, loadProfile]);

  const updateDisplayName = useCallback(
    async (displayName: string) => {
      if (!session?.user) return { error: "Not signed in" };
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: displayName })
        .eq("id", session.user.id);
      if (error) return { error: error.message };
      await loadProfile(session.user.id);
      return { error: null };
    },
    [session, loadProfile]
  );

  const updateUsername = useCallback(
    async (username: string) => {
      if (!session?.user) return { error: "Not signed in" };
      const { error } = await supabase
        .from("profiles")
        .update({ username: username.toLowerCase() })
        .eq("id", session.user.id);
      if (error) {
        // unique_violation - profiles.username has a unique constraint.
        if (error.code === "23505") return { error: "That username is taken." };
        return { error: error.message };
      }
      await loadProfile(session.user.id);
      return { error: null };
    },
    [session, loadProfile]
  );

  const completeOnboarding = useCallback(async () => {
    if (!session?.user) return;
    await supabase.from("profiles").update({ onboarding_completed: true }).eq("id", session.user.id);
    await loadProfile(session.user.id);
  }, [session, loadProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      isAdmin: profile?.role === "admin",
      loading,
      signInWithPassword,
      signUpWithPassword,
      signOut,
      refreshProfile,
      updateDisplayName,
      updateUsername,
      completeOnboarding,
    }),
    [
      session,
      profile,
      loading,
      signInWithPassword,
      signUpWithPassword,
      signOut,
      refreshProfile,
      updateDisplayName,
      updateUsername,
      completeOnboarding,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
