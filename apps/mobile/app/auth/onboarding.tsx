import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AnimatedTileBackdrop } from "../../src/components/AnimatedTileBackdrop";
import { ArabesqueLoader } from "../../src/components/ArabesqueLoader";
import { LavLogo } from "../../src/components/LavLogo";
import { useAuth } from "../../src/lib/auth";
import { uploadAvatar } from "../../src/lib/profiles";
import { fontSize, fontWeight, lineHeight, radii, serif, spacing, useTheme, useThemedStyles } from "../../src/theme";

// Letters, numbers, underscore - mirrors handle_new_user()'s auto-generated
// shape (supabase/migrations/0004_triggers.sql), just enforced up front here
// instead of only ever being produced by the trigger.
const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

// One-time post-signup step (see app/_layout.tsx's AuthGatedStack): a new
// account starts with handle_new_user()'s auto-generated username/display
// name and no avatar. This is where the user actually picks their own
// identity instead of being stuck with that default forever. The photo is
// the only skippable part - username is required to finish.
export default function OnboardingScreen() {
  const { user, profile, updateUsername, updateDisplayName, completeOnboarding } = useAuth();
  const { colors } = useTheme();
  const [username, setUsername] = useState(profile?.username ?? "");
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
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
    scrollContent: {
      flexGrow: 1,
      alignItems: "center" as const,
      paddingHorizontal: spacing["2xl"],
      paddingVertical: spacing["2xl"],
    },
    description: {
      fontFamily: serif.italic,
      marginTop: spacing.md,
      fontSize: fontSize.base,
      color: c.textSecondary,
      lineHeight: fontSize.base * lineHeight.relaxed,
      textAlign: "center" as const,
    },
    avatarButton: {
      alignItems: "center" as const,
      gap: spacing.xs,
      marginTop: spacing.xl,
    },
    avatarCircle: {
      width: 100,
      height: 100,
      borderRadius: radii.full,
      overflow: "hidden" as const,
    },
    avatarPlaceholder: {
      width: 100,
      height: 100,
      borderRadius: radii.full,
      backgroundColor: c.accentMuted,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    avatarImage: {
      width: 100,
      height: 100,
      borderRadius: radii.full,
    },
    avatarOverlay: {
      position: "absolute" as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: c.overlay,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    avatarLabel: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.medium,
      color: c.accentStrong,
    },
    form: {
      width: "100%" as const,
      maxWidth: 360,
      gap: spacing.sm,
      marginTop: spacing.xl,
    },
    fieldLabel: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.medium,
      color: c.textSecondary,
      marginTop: spacing.xs,
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
      marginTop: spacing.sm,
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

  async function handlePickPhoto() {
    if (!user) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Enable photo library access to set a profile photo.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;

    setUploadingPhoto(true);
    setError(null);
    try {
      const url = await uploadAvatar(user.id, result.assets[0].uri);
      setAvatarUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't upload photo.");
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleFinish() {
    const trimmedUsername = username.trim().toLowerCase();
    if (!USERNAME_PATTERN.test(trimmedUsername)) {
      setError("Username must be 3-20 characters: lowercase letters, numbers, and underscores only.");
      return;
    }
    setSaving(true);
    setError(null);

    if (trimmedUsername !== profile?.username) {
      const { error: usernameError } = await updateUsername(trimmedUsername);
      if (usernameError) {
        setSaving(false);
        setError(usernameError);
        return;
      }
    }

    const trimmedDisplayName = displayName.trim();
    if (trimmedDisplayName && trimmedDisplayName !== profile?.display_name) {
      const { error: nameError } = await updateDisplayName(trimmedDisplayName);
      if (nameError) {
        setSaving(false);
        setError(nameError);
        return;
      }
    }

    await completeOnboarding();
    setSaving(false);
    // AuthGatedStack (app/_layout.tsx) redirects to the tabs once
    // profile.onboarding_completed flips true - no manual navigation here.
  }

  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
      <View style={styles.patternLayer} pointerEvents="none">
        <AnimatedTileBackdrop opacity={0.05} />
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <LavLogo size={32} />
        <Text style={styles.description}>Set up your profile before you start exploring.</Text>

        <Pressable style={styles.avatarButton} onPress={handlePickPhoto} disabled={uploadingPhoto}>
          <View style={styles.avatarCircle}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="camera-outline" size={28} color={colors.textSecondary} />
              </View>
            )}
            {uploadingPhoto ? (
              <View style={styles.avatarOverlay}>
                <ArabesqueLoader size={22} color={colors.textOnOverlay} />
              </View>
            ) : null}
          </View>
          <Text style={styles.avatarLabel}>{avatarUrl ? "Change photo" : "Add a photo"}</Text>
        </Pressable>

        <View style={styles.form}>
          <Text style={styles.fieldLabel}>Username</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder="username"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.fieldLabel}>Display name</Text>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Display name"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={[styles.button, (saving || !username.trim()) && styles.buttonDisabled]}
            onPress={handleFinish}
            disabled={saving || !username.trim()}
          >
            {saving ? (
              <ArabesqueLoader size={20} color={colors.textOnAccent} />
            ) : (
              <Text style={styles.buttonText}>Finish</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
