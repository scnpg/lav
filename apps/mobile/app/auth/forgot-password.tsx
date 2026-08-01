import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AnimatedTileBackdrop } from "../../src/components/AnimatedTileBackdrop";
import { ArabesqueLoader } from "../../src/components/ArabesqueLoader";
import { LavLogo } from "../../src/components/LavLogo";
import { useAuth } from "../../src/lib/auth";
import { fontSize, fontWeight, lineHeight, radii, serif, spacing, useTheme, useThemedStyles } from "../../src/theme";

export default function ForgotPasswordScreen() {
  const { requestPasswordReset } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const styles = useThemedStyles((c) => ({
    container: {
      flex: 1,
      backgroundColor: c.background,
    },
    patternLayer: {
      position: "absolute" as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    content: {
      flex: 1,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      paddingHorizontal: spacing["2xl"],
      gap: spacing.md,
    },
    description: {
      fontFamily: serif.italic,
      fontSize: fontSize.base,
      color: c.textSecondary,
      lineHeight: fontSize.base * lineHeight.relaxed,
      textAlign: "center" as const,
    },
    form: {
      width: "100%" as const,
      gap: spacing.sm,
      marginTop: spacing.lg,
    },
    fieldLabel: {
      fontSize: fontSize.xs,
      color: c.textSecondary,
      fontWeight: fontWeight.medium,
      letterSpacing: 1,
      textTransform: "uppercase" as const,
      marginBottom: 2,
    },
    input: {
      backgroundColor: c.surface,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: spacing.md,
      height: 48,
      fontSize: fontSize.base,
      color: c.textPrimary,
    },
    error: {
      color: c.danger,
      fontSize: fontSize.sm,
    },
    button: {
      backgroundColor: c.accent,
      borderRadius: radii.lg,
      height: 48,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      marginTop: spacing.xs,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    buttonText: {
      color: c.textOnAccent,
      fontSize: fontSize.base,
      fontWeight: fontWeight.semibold,
    },
    linkRow: {
      alignItems: "center" as const,
      marginTop: spacing.sm,
    },
    linkText: {
      color: c.textSecondary,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.medium,
    },
  }));

  async function handleSubmit() {
    if (!email.trim()) return;
    setSubmitting(true);
    setError(null);
    const { error: resetError } = await requestPasswordReset(email.trim());
    setSubmitting(false);
    if (resetError) {
      setError(resetError);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
        <View style={styles.patternLayer} pointerEvents="none">
          <AnimatedTileBackdrop opacity={0.05} />
        </View>
        <View style={styles.content}>
          <LavLogo size={32} />
          <Text style={styles.description}>
            If an account exists for {email.trim()}, a password reset link is on its way - check your inbox
            (and spam folder).
          </Text>
          <Pressable style={styles.button} onPress={() => router.replace("/auth/sign-in")}>
            <Text style={styles.buttonText}>Back to sign in</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
      <View style={styles.patternLayer} pointerEvents="none">
        <AnimatedTileBackdrop opacity={0.05} />
      </View>
      <View style={styles.content}>
        <LavLogo size={32} />
        <Text style={styles.description}>
          Enter your email and we'll send you a link to reset your password.
        </Text>

        <View style={styles.form}>
          <Text style={styles.fieldLabel}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={[styles.button, (submitting || !email.trim()) && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={submitting || !email.trim()}
          >
            {submitting ? (
              <ArabesqueLoader size={20} color={colors.textOnAccent} />
            ) : (
              <Text style={styles.buttonText}>Send reset link</Text>
            )}
          </Pressable>

          <Pressable style={styles.linkRow} onPress={() => router.replace("/auth/sign-in")} hitSlop={8}>
            <Text style={styles.linkText}>Back to sign in</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
