import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";

import { AnimatedTileBackdrop } from "../../src/components/AnimatedTileBackdrop";
import { ArabesqueLoader } from "../../src/components/ArabesqueLoader";
import { LavLogo } from "../../src/components/LavLogo";
import { useAuth } from "../../src/lib/auth";
import { fontSize, fontWeight, lineHeight, radii, serif, spacing, useTheme, useThemedStyles } from "../../src/theme";

export default function SignInScreen() {
  const { t } = useTranslation();
  const { signInWithPassword } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
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
    error: {
      color: c.danger,
      fontSize: fontSize.sm,
    },
    forgotPasswordRow: {
      alignItems: "flex-end" as const,
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
        <AnimatedTileBackdrop opacity={0.05} />
      </View>
      <View style={styles.content}>
        <LavLogo size={32} />
        <Text style={styles.description}>{t("auth.signIn.description")}</Text>

        <View style={styles.form}>
          <Text style={styles.fieldLabel}>{t("auth.signIn.identifierPlaceholder")}</Text>
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
          <Text style={styles.fieldLabel}>{t("auth.signIn.passwordPlaceholder")}</Text>
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
              <ArabesqueLoader size={20} color={colors.textOnAccent} />
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
