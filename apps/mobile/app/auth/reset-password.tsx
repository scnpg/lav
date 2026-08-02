import { useState } from "react";
import { Pressable, Text, View } from "react-native";
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

// Only reachable via AuthGatedStack routing here while isPasswordRecovery is
// true (app/_layout.tsx) - i.e. after clicking a password-recovery email
// link, which signs the user into a real, temporary session. There's no
// "current password" field because that temporary session is itself the
// proof of identity, same as every other password-reset flow works.
export default function ResetPasswordScreen() {
  const { updatePassword } = useAuth();
  const { colors } = useTheme();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  }));

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
        <AnimatedTileBackdrop opacity={0.05} />
      </View>
      <View style={styles.content}>
        <LavLogo size={32} />
        <Text style={styles.description}>Set a new password for your account.</Text>

        <View style={styles.form}>
          <Text style={styles.fieldLabel}>New password</Text>
          <PasswordField
            value={password}
            onChangeText={setPassword}
            placeholder="New password"
            style={styles.input}
            textContentType="newPassword"
            returnKeyType="next"
          />
          <Text style={styles.fieldLabel}>Confirm new password</Text>
          <PasswordField
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirm new password"
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
              <Text style={styles.buttonText}>Update password</Text>
            )}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
