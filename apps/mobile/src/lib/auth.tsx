import type { Session, User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Platform } from "react-native";

import { supabase } from "./supabase";
import { createAuthRedirectUrl } from "./linking";
import type { Profile } from "../types/database";

// A synchronous check, not just the PASSWORD_RECOVERY event from
// onAuthStateChange below: supabase.ts's detectSessionInUrl (web only)
// processes the URL asynchronously as part of client initialization, which
// happens at module load - before this provider's own useEffect has run and
// registered its onAuthStateChange listener. In practice that race can lose
// the event entirely (confirmed empirically - the event fired too early to
// be seen, and the recovery link silently fell through to the ordinary
// signed-in flow instead of the reset-password screen). Checking the URL
// directly on the very first render sidesteps the race - it doesn't depend
// on when supabase-js gets around to emitting anything.
function isRecoveryUrl(): boolean {
  if (Platform.OS !== "web" || typeof window === "undefined") return false;
  return window.location.hash.includes("type=recovery");
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  /** True from the moment a password-recovery link is clicked until updatePassword() succeeds - see AuthGatedStack in app/_layout.tsx, which routes here ahead of the normal signed-in check. */
  isPasswordRecovery: boolean;
  signInWithPassword: (identifier: string, password: string) => Promise<{ error: string | null }>;
  signUpWithPassword: (
    email: string,
    password: string
  ) => Promise<{ error: string | null; needsConfirmation: boolean; likelyExistingAccount: boolean }>;
  resendConfirmationEmail: (email: string) => Promise<{ error: string | null }>;
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
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
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(isRecoveryUrl);

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

    const { data: subscription } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (!mounted) return;
      // Clicking a password-recovery link signs the user into a real,
      // temporary session (so updateUser() below can work) - without this
      // check, AuthGatedStack would see a non-null session and route
      // straight into the app instead of the "set a new password" screen.
      if (event === "PASSWORD_RECOVERY") setIsPasswordRecovery(true);
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

  /** Accepts either an email or a username (see migration 0036's resolve_username_to_email). A non-email identifier is resolved to its email first; if that lookup fails or finds nothing, the raw identifier is passed through unchanged so signInWithPassword() below still fails with Supabase's own generic "Invalid login credentials" - same message a wrong password would get, so this never leaks whether a username exists. */
  const signInWithPassword = useCallback(async (identifier: string, password: string) => {
    const trimmed = identifier.trim();
    let email = trimmed;
    if (!trimmed.includes("@")) {
      const { data } = await supabase.rpc("resolve_username_to_email", { input_username: trimmed });
      if (data) email = data;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signUpWithPassword = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      // Explicit redirect target instead of relying on the project's Site
      // URL dashboard setting - that's a single static value that can't
      // simultaneously be correct for local dev, native, and the deployed
      // web build. See src/lib/linking.ts for why this can't just be
      // Linking.createURL() on its own.
      options: { emailRedirectTo: createAuthRedirectUrl("/profile") },
    });
    if (error) {
      // Whether a repeat signUp() against an already-confirmed email comes
      // back as this explicit error or as a masked fake-success (handled
      // below via the empty-identities check) turns out to depend on the
      // GoTrue version/config - observed the explicit-error form locally,
      // masked form is Supabase's documented anti-enumeration behavior in
      // general. Route both into the same "account exists" outcome instead
      // of dumping this one as a raw error string, since it needs the same
      // "sign in instead" UI either way.
      if (error.code === "user_already_exists") {
        return { error: null, needsConfirmation: true, likelyExistingAccount: true };
      }
      // Bug fix: for any 5xx response, @supabase/auth-js's handleError()
      // (lib/fetch.js) deliberately skips parsing the response body at all -
      // it treats every 500-599 status as a generic "retryable" transport
      // error and builds the message by JSON.stringify()-ing the raw fetch
      // Response object itself. Response's fields (status, ok, headers, ...)
      // are prototype getters, not own-enumerable properties, so that
      // stringify has nothing to serialize - it silently becomes "{}" (or
      // occasionally another near-empty token depending on the runtime),
      // never the actual server-provided message (e.g. GoTrue's real body
      // here is `{"msg":"Error sending confirmation email", ...}` - confirmed
      // by calling the endpoint directly). A 5xx here in practice means
      // GoTrue couldn't send the confirmation email (broken/misconfigured
      // SMTP), not a client mistake - surfacing our own clear message beats
      // exposing that upstream stringify artifact verbatim.
      if (error.status && error.status >= 500) {
        return {
          error: "We couldn't send your confirmation email right now. Please try again in a few minutes.",
          needsConfirmation: false,
          likelyExistingAccount: false,
        };
      }
      return { error: error.message, needsConfirmation: false, likelyExistingAccount: false };
    }

    // A user with no session back means confirmation is required (see
    // supabase/config.toml [auth.email] enable_confirmations) - the caller
    // should show a "check your email" state instead of expecting to be
    // signed in immediately.
    const needsConfirmation = !!data.user && !data.session;

    // Supabase deliberately returns this same look-alike response (user
    // set, no session, no error) both for a genuine new signup AND for a
    // signUp() call against an email that already has a CONFIRMED account -
    // intentional user-enumeration protection, not a bug, so there's no
    // fully reliable way to distinguish the two from this call alone. An
    // empty `identities` array is the best available signal (documented in
    // Supabase community discussions, not an officially guaranteed contract)
    // that this was actually a re-signup of an existing account rather than
    // a fresh one - good enough to soften the "check your email" copy, not
    // strong enough to assert outright "this email is already registered".
    const likelyExistingAccount = needsConfirmation && data.user?.identities?.length === 0;

    return { error: null, needsConfirmation, likelyExistingAccount };
  }, []);

  /** Re-sends the signup confirmation email - e.g. a "Resend email" action on the "check your inbox" screen. */
  const resendConfirmationEmail = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resend({ type: "signup", email });
    return { error: error?.message ?? null };
  }, []);

  /** Sends a password-recovery email. Always "succeeds" from the caller's perspective even for an unregistered email (same enumeration-protection reasoning as signUpWithPassword) - the UI should show a generic "check your email" message regardless. */
  const requestPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: createAuthRedirectUrl("/auth/reset-password"),
    });
    return { error: error?.message ?? null };
  }, []);

  /** Sets a new password - only meaningful while isPasswordRecovery is true (see the recovery session note above). Clears isPasswordRecovery on success so AuthGatedStack's normal routing takes over. */
  const updatePassword = useCallback(async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { error: error.message };
    setIsPasswordRecovery(false);
    return { error: null };
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
      isPasswordRecovery,
      signInWithPassword,
      signUpWithPassword,
      resendConfirmationEmail,
      requestPasswordReset,
      updatePassword,
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
      isPasswordRecovery,
      signInWithPassword,
      signUpWithPassword,
      resendConfirmationEmail,
      requestPasswordReset,
      updatePassword,
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
