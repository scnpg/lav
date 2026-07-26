import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ArabesquePattern } from "../../src/components/ArabesquePattern";
import { LavLogo } from "../../src/components/LavLogo";
import { useAuth } from "../../src/lib/auth";
import { colors, fontSize, fontWeight, lineHeight, radii, spacing } from "../../src/theme";

// Matches Supabase Auth's default minimum_password_length (see
// supabase/config.toml [auth] - unset, so the CLI default of 6 applies).
const MIN_PASSWORD_LENGTH = 6;

// Only reachable via AuthGatedStack routing here while isPasswordRecovery is
// true (app/_layout.tsx) - i.e. after clicking a password-recovery email
// link, which signs the user into a real, temporary session. There's no
// "current password" field because that temporary session is itself the
// proof of identity, same as every other password-reset flow works.
export default function ResetPasswordScreen() {
  const { updatePassword } = useAuth();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const passwordTooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH;
  const canSubmit = password.length >= MIN_PASSWORD_LENGTH && password === confirmPassword;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const { error: updateError } = await updatePassword(password);
    setSubmitting(false);
    if (updateError) {
      setError(updateError);
      return;
    }
    // isPasswordRecovery clears on success, so AuthGatedStack's normal
    // routing takes over (into the app, or onboarding) - no explicit
    // navigation needed here.
  }

  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
      <View style={styles.patternLayer} pointerEvents="none">
        <ArabesquePattern rows={14} columns={7} starSize={22} gap={16} opacity={0.05} />
      </View>
      <View style={styles.content}>
        <LavLogo size={32} />
        <Text style={styles.description}>Set a new password for your account.</Text>

        <View style={styles.form}>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="New password"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            secureTextEntry
            textContentType="newPassword"
            returnKeyType="next"
          />
          <TextInput
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirm new password"
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
              <Text style={styles.buttonText}>Update password</Text>
            )}
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
});
