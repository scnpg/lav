import { Stack, usePathname, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { LoadingScreen } from "../src/components/LoadingScreen";
import { AuthProvider, useAuth } from "../src/lib/auth";
import { colors } from "../src/theme";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <AuthProvider>
          <AuthGatedStack />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// Everything requires sign-in (see 0006_rls.sql) - redirect to/from
// auth/sign-in based on session state instead of gating each screen
// individually. `loading` covers the initial supabase.auth.getSession()
// round-trip, so we don't bounce a signed-in user to sign-in for a flash
// before their session is restored from storage. A signed-in user whose
// profile hasn't finished onboarding (see app/auth/onboarding.tsx) gets
// routed there instead of the tabs - handle_new_user()'s auto-generated
// username/display_name are meant as a fallback, not the end state.
function AuthGatedStack() {
  const { session, profile, loading } = useAuth();
  const segments = useSegments();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === "auth";
    const onOnboardingScreen = pathname === "/auth/onboarding";

    if (!session) {
      if (!inAuthGroup) router.replace("/auth/sign-in");
      return;
    }

    const needsOnboarding = !!profile && !profile.onboarding_completed;
    if (needsOnboarding) {
      if (!onOnboardingScreen) router.replace("/auth/onboarding");
      return;
    }

    if (inAuthGroup) {
      router.replace("/");
    }
  }, [session, profile, loading, segments, pathname, router]);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="auth/sign-in"
        options={{ headerShown: true, title: "Sign in", presentation: "modal" }}
      />
      <Stack.Screen
        name="auth/sign-up"
        options={{ headerShown: true, title: "Sign up", presentation: "modal" }}
      />
      <Stack.Screen
        name="auth/onboarding"
        options={{ headerShown: true, title: "Set up your profile", presentation: "modal" }}
      />
    </Stack>
  );
}
