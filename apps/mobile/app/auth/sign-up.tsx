import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";

import { AnimatedTileBackdrop } from "../../src/components/AnimatedTileBackdrop";
import { ArabesqueLoader } from "../../src/components/ArabesqueLoader";
import { LavLogo } from "../../src/components/LavLogo";
import { PasswordField } from "../../src/components/PasswordField";
import { useAuth } from "../../src/lib/auth";
import { fontSize, fontWeight, lineHeight, radii, serif, spacing, useTheme, useThemedStyles } from "../../src/theme";

// Matches Supabase Auth's default minimum_password_length (see
// supabase/config.toml [auth] - unset, so the CLI default of 6 applies).
const MIN_PASSWORD_LENGTH = 6;

export default function SignUpScreen() {
  const { t } = useTranslation();
  const { signUpWithPassword, resendConfirmationEmail } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Local dev has email confirmation off, so signUp normally returns a
  // session immediately and the root layout's redirect takes over before
  // this ever renders. This only shows if confirmation is required (no
  // session yet after a successful signUp) - see AuthGatedStack in
  // app/_layout.tsx for the redirect this depends on. Driven directly by
  // signUpWithPassword's own return value now, not by re-checking context
  // session after the call.
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [likelyExistingAccount, setLikelyExistingAccount] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

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
    hint: {
      color: c.textMuted,
      fontSize: fontSize.sm,
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

  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const passwordTooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH;
  const canSubmit =
    !!email.trim() && password.length >= MIN_PASSWORD_LENGTH && password === confirmPassword;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const result = await signUpWithPassword(email.trim(), password);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.needsConfirmation) {
      setLikelyExistingAccount(result.likelyExistingAccount);
      setAwaitingConfirmation(true);
    }
    // If a session came back immediately, the root layout's session-watching
    // redirect takes it from here.
  }

  async function handleResend() {
    setResending(true);
    setResendMessage(null);
    const { error: resendError } = await resendConfirmationEmail(email.trim());
    setResending(false);
    setResendMessage(resendError ?? "Sent again - check your inbox (and spam folder).");
  }

  // Two distinct outcomes behind the same "no session yet" response from
  // signUp() - see its own comment for why the empty-identities heuristic
  // is reliable specifically for "already exists AND already confirmed"
  // (as opposed to "exists but still unconfirmed", which Supabase treats as
  // an ordinary resend and which correctly falls into the branch below
  // instead). A genuinely new signup and a stale, already-confirmed repeat
  // signup need different actions, not the same "check your email" copy -
  // resending a confirmation email to an already-confirmed address just
  // repeats the confusion that caused this screen to exist.
  if (awaitingConfirmation && likelyExistingAccount) {
    return (
      <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
        <View style={styles.patternLayer} pointerEvents="none">
          <AnimatedTileBackdrop opacity={0.05} />
        </View>
        <View style={styles.content}>
          <LavLogo size={32} />
          <Text style={styles.description}>An account already exists for {email.trim()}.</Text>
          <Pressable style={styles.button} onPress={() => router.replace("/auth/sign-in")}>
            <Text style={styles.buttonText}>Sign in</Text>
          </Pressable>
          <Pressable
            style={styles.linkRow}
            onPress={() => router.push("/auth/forgot-password")}
            hitSlop={8}
          >
            <Text style={styles.linkText}>Forgot your password?</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (awaitingConfirmation) {
    return (
      <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
        <View style={styles.patternLayer} pointerEvents="none">
          <AnimatedTileBackdrop opacity={0.05} />
        </View>
        <View style={styles.content}>
          <LavLogo size={32} />
          <Text style={styles.description}>Check {email.trim()} for a confirmation link, then sign in.</Text>
          <Pressable style={styles.linkRow} onPress={handleResend} disabled={resending} hitSlop={8}>
            {resending ? (
              <ArabesqueLoader size={18} color={colors.textSecondary} />
            ) : (
              <Text style={styles.linkText}>Resend confirmation email</Text>
            )}
          </Pressable>
          {resendMessage ? <Text style={styles.hint}>{resendMessage}</Text> : null}
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
        <Text style={styles.description}>{t("auth.signUp.description")}</Text>

        <View style={styles.form}>
          <Text style={styles.fieldLabel}>{t("auth.signUp.emailPlaceholder")}</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder={t("auth.signUp.emailPlaceholder")}
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          <Text style={styles.fieldLabel}>{t("auth.signUp.passwordPlaceholder")}</Text>
          <PasswordField
            value={password}
            onChangeText={setPassword}
            placeholder={t("auth.signUp.passwordPlaceholder")}
            style={styles.input}
            textContentType="newPassword"
            returnKeyType="next"
          />
          <Text style={styles.fieldLabel}>{t("auth.signUp.confirmPasswordPlaceholder")}</Text>
          <PasswordField
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder={t("auth.signUp.confirmPasswordPlaceholder")}
            style={styles.input}
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
          />

          {passwordTooShort ? (
            <Text style={styles.hint}>Password must be at least {MIN_PASSWORD_LENGTH} characters.</Text>
          ) : passwordsMismatch ? (
            <Text style={styles.hint}>Passwords don't match.</Text>
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={[styles.button, (submitting || !canSubmit) && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={submitting || !canSubmit}
          >
            {submitting ? (
              <ArabesqueLoader size={20} color={colors.textOnAccent} />
            ) : (
              <Text style={styles.buttonText}>{t("auth.signUp.submit")}</Text>
            )}
          </Pressable>

          <Pressable style={styles.linkRow} onPress={() => router.replace("/auth/sign-in")} hitSlop={8}>
            <Text style={styles.linkText}>{t("auth.signUp.haveAccount")}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
