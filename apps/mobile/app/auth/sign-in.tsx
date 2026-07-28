import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";

import { ArabesquePattern } from "../../src/components/ArabesquePattern";
import { LavLogo } from "../../src/components/LavLogo";
import { useAuth } from "../../src/lib/auth";
import { colors, fontSize, fontWeight, lineHeight, radii, spacing } from "../../src/theme";

export default function SignInScreen() {
  const { t } = useTranslation();
  const { signInWithPassword } = useAuth();
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!identifier.trim() || !password) return;
    setSubmitting(true);
    setError(null);
    const { error: signInError } = await signInWithPassword(identifier.trim(), password);
    setSubmitting(false);
    if (signInError) setError(signInError);
    // On success, the root layout's session-watching redirect takes it from here.
  }

  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
      <View style={styles.patternLayer} pointerEvents="none">
        <ArabesquePattern rows={14} columns={7} starSize={22} gap={16} opacity={0.05} />
      </View>
      <View style={styles.content}>
        <LavLogo size={32} />
        <Text style={styles.description}>{t("auth.signIn.description")}</Text>

        <View style={styles.form}>
          <TextInput
            value={identifier}
            onChangeText={setIdentifier}
            placeholder={t("auth.signIn.identifierPlaceholder")}
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="username"
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder={t("auth.signIn.passwordPlaceholder")}
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            secureTextEntry
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable style={styles.forgotPasswordRow} onPress={() => router.push("/auth/forgot-password")} hitSlop={8}>
            <Text style={styles.linkText}>{t("auth.signIn.forgotPassword")}</Text>
          </Pressable>

          <Pressable
            style={[styles.button, (submitting || !identifier.trim() || !password) && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={submitting || !identifier.trim() || !password}
          >
            {submitting ? (
              <ActivityIndicator color={colors.textOnAccent} />
            ) : (
              <Text style={styles.buttonText}>{t("auth.signIn.submit")}</Text>
            )}
          </Pressable>

          <Pressable style={styles.linkRow} onPress={() => router.push("/auth/sign-up")} hitSlop={8}>
            <Text style={styles.linkText}>{t("auth.signIn.noAccount")}</Text>
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
  error: {
    color: colors.danger,
    fontSize: fontSize.sm,
  },
  forgotPasswordRow: {
    alignItems: "flex-end",
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
