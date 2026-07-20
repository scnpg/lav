import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Wordmark } from "../../src/components/Wordmark";
import { useAuth } from "../../src/lib/auth";
import { uploadAvatar } from "../../src/lib/profiles";
import { colors, fontSize, fontWeight, lineHeight, radii, spacing } from "../../src/theme";

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
  const [username, setUsername] = useState(profile?.username ?? "");
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Wordmark size={32} />
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
                <ActivityIndicator color={colors.textOnOverlay} />
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
              <ActivityIndicator color={colors.textOnAccent} />
            ) : (
              <Text style={styles.buttonText}>Finish</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: spacing["2xl"],
    paddingVertical: spacing["2xl"],
  },
  description: {
    marginTop: spacing.md,
    fontSize: fontSize.base,
    color: colors.textSecondary,
    lineHeight: fontSize.base * lineHeight.relaxed,
    textAlign: "center",
  },
  avatarButton: {
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.xl,
  },
  avatarCircle: {
    width: 100,
    height: 100,
    borderRadius: radii.full,
    overflow: "hidden",
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: radii.full,
    backgroundColor: colors.accentMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: radii.full,
  },
  avatarOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlay,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.accentStrong,
  },
  form: {
    width: "100%",
    maxWidth: 360,
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  fieldLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
    marginTop: spacing.xs,
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
  button: {
    backgroundColor: colors.accent,
    borderRadius: radii.lg,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.sm,
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
