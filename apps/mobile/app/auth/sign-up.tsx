import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";

import { ArabesquePattern } from "../../src/components/ArabesquePattern";
import { LavLogo } from "../../src/components/LavLogo";
import { useAuth } from "../../src/lib/auth";
import { colors, fontSize, fontWeight, lineHeight, radii, spacing } from "../../src/theme";

// Matches Supabase Auth's default minimum_password_length (see
// supabase/config.toml [auth] - unset, so the CLI default of 6 applies).
const MIN_PASSWORD_LENGTH = 6;

export default function SignUpScreen() {
  const { t } = useTranslation();
  const { signUpWithPassword, resendConfirmationEmail } = useAuth();
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
          <ArabesquePattern rows={14} columns={7} starSize={22} gap={16} opacity={0.05} />
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
          <ArabesquePattern rows={14} columns={7} starSize={22} gap={16} opacity={0.05} />
        </View>
        <View style={styles.content}>
          <LavLogo size={32} />
          <Text style={styles.description}>Check {email.trim()} for a confirmation link, then sign in.</Text>
          <Pressable style={styles.linkRow} onPress={handleResend} disabled={resending} hitSlop={8}>
            {resending ? (
              <ActivityIndicator color={colors.textSecondary} />
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
        <ArabesquePattern rows={14} columns={7} starSize={22} gap={16} opacity={0.05} />
      </View>
      <View style={styles.content}>
        <LavLogo size={32} />
        <Text style={styles.description}>{t("auth.signUp.description")}</Text>

        <View style={styles.form}>
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
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder={t("auth.signUp.passwordPlaceholder")}
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            secureTextEntry
            textContentType="newPassword"
            returnKeyType="next"
          />
          <TextInput
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder={t("auth.signUp.confirmPasswordPlaceholder")}
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            secureTextEntry
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
              <ActivityIndicator color={colors.textOnAccent} />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  patternLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing["2xl"],
    gap: spacing.md,
  },
  description: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    lineHeight: fontSize.base * lineHeight.relaxed,
    textAlign: "center",
  },
  form: {
    width: "100%",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 48,
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },
  hint: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
  },
  error: {
    color: colors.danger,
    fontSize: fontSize.sm,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: radii.lg,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xs,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: colors.textOnAccent,
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  linkRow: {
    alignItems: "center",
    marginTop: spacing.sm,
  },
  linkText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
});
