import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";

import { ArabesqueLoader } from "../../src/components/ArabesqueLoader";
import { FlowerMark } from "../../src/components/FlowerMark";
import { LavLogo } from "../../src/components/LavLogo";
import { LevelBadge } from "../../src/components/LevelBadge";
import { LevelProgressBar } from "../../src/components/LevelProgressBar";
import { LoggedBathroomsMap } from "../../src/components/LoggedBathroomsMap";
import { ACCESS_TYPE_LABELS, COST_TYPE_LABELS } from "../../src/constants/enumLabels";
import { getSavedBathrooms, toggleBookmark } from "../../src/features/bathrooms/api";
import { getMyLoggedBathrooms, type LoggedBathroom } from "../../src/features/bathrooms/ratingsApi";
import { getFriendIds, getIncomingRequests } from "../../src/features/friends/api";
import { getListItemCounts, getListsForUser } from "../../src/features/lists/api";
import { getUnreadNotificationCount } from "../../src/features/social/api";
import { SUPPORTED_LANGUAGES, setLanguage, type SupportedLanguage } from "../../src/i18n";
import { useAuth } from "../../src/lib/auth";
import { pinFill } from "../../src/lib/pinColor";
import { uploadAvatar } from "../../src/lib/profiles";
import { cardShadow, fontSize, fontWeight, radii, spacing, useTheme, useThemedStyles, type ThemeMode } from "../../src/theme";
import type { BathroomList, BathroomPublic } from "../../src/types/database";

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

const THEME_MODES: ThemeMode[] = ["paper", "nocturne", "system"];
const THEME_ICONS: Record<ThemeMode, keyof typeof Ionicons.glyphMap> = {
  paper: "sunny-outline",
  nocturne: "moon-outline",
  system: "desktop-outline",
};

type LeaderboardTab = "been_there" | "want_to_go" | "collections";

const LEADERBOARD_TABS: { key: LeaderboardTab; labelKey: string }[] = [
  { key: "been_there", labelKey: "profile.tabs.beenThere" },
  { key: "want_to_go", labelKey: "profile.tabs.wantToGo" },
  { key: "collections", labelKey: "profile.tabs.collections" },
];

// A streak that's still "alive" shouldn't read as 0 just because today's
// log hasn't happened yet - if there's no entry for today, count backward
// starting from yesterday instead of breaking immediately.
function computeLoggingStreak(reviews: { created_at: string }[]): number {
  if (reviews.length === 0) return 0;
  const days = new Set(reviews.map((r) => new Date(r.created_at).toDateString()));
  const cursor = new Date();
  if (!days.has(cursor.toDateString())) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let streak = 0;
  while (days.has(cursor.toDateString())) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// Real profile screen - display_name, username, points, and avatar_url all
// come from useAuth().profile, which AuthProvider already loads via
// supabase.from("profiles").select("*") on sign-in/session-restore (see
// src/lib/auth.tsx's loadProfile). Reading that instead of running a second,
// duplicate query for the same row. Editing calls updateDisplayName()/
// updateUsername(), which do the .update() and refresh the cached profile so
// this (and anywhere else it's read) picks up the change immediately.
//
// contentInner caps the page width and centers it so this doesn't stretch
// into a single sparse row on a wide desktop browser.
export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { user, profile, loading, updateDisplayName, updateUsername, refreshProfile, signOut } = useAuth();
  const { colors, scheme, mode, setMode } = useTheme();
  const router = useRouter();

  const styles = useThemedStyles((c) => ({
    container: {
      flex: 1,
      backgroundColor: c.background,
    },
    centerContent: {
      flex: 1,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    screenHeader: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
    },
    headerActions: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: spacing.sm,
    },
    headerIconButton: {
      width: 36,
      height: 36,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    headerBadge: {
      position: "absolute" as const,
      top: 2,
      right: 2,
      minWidth: 15,
      height: 15,
      paddingHorizontal: 3,
      borderRadius: radii.full,
      backgroundColor: c.danger,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    headerBadgeText: {
      fontSize: 9,
      fontWeight: fontWeight.bold,
      color: c.textOnAccent,
    },
    scrollContent: {
      alignItems: "center" as const,
      paddingVertical: spacing.lg,
    },
    contentInner: {
      width: "100%" as const,
      maxWidth: 480,
      paddingHorizontal: spacing.lg,
    },
    card: {
      backgroundColor: c.surface,
      borderRadius: radii.xl,
      padding: spacing.lg,
      gap: spacing.md,
    },
    headerRow: {
      flexDirection: "row" as const,
      alignItems: "flex-start" as const,
      justifyContent: "space-between" as const,
      gap: spacing.md,
    },
    identityRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: spacing.md,
      flex: 1,
      minWidth: 0,
    },
    avatar: {
      width: 56,
      height: 56,
      borderRadius: radii.full,
      backgroundColor: c.accentMuted,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    avatarImage: {
      width: 56,
      height: 56,
      borderRadius: radii.full,
    },
    avatarOverlay: {
      position: "absolute" as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: radii.full,
      backgroundColor: c.overlay,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    avatarBadge: {
      position: "absolute" as const,
      bottom: -2,
      right: -2,
      width: 20,
      height: 20,
      borderRadius: radii.full,
      backgroundColor: c.accentStrong,
      borderWidth: 2,
      borderColor: c.surface,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    avatarText: {
      fontSize: fontSize.xl,
      fontWeight: fontWeight.bold,
      color: c.textPrimary,
    },
    textBlock: {
      gap: 4,
      flex: 1,
      minWidth: 0,
    },
    name: {
      fontSize: fontSize.lg,
      fontWeight: fontWeight.bold,
      color: c.textPrimary,
    },
    nameInput: {
      fontSize: fontSize.lg,
      fontWeight: fontWeight.bold,
      color: c.textPrimary,
      borderBottomWidth: 1,
      borderBottomColor: c.borderStrong,
      paddingVertical: 2,
    },
    username: {
      fontSize: fontSize.sm,
      color: c.textSecondary,
    },
    usernameInput: {
      fontSize: fontSize.sm,
      color: c.textSecondary,
      borderBottomWidth: 1,
      borderBottomColor: c.borderStrong,
      paddingVertical: 2,
      marginTop: 2,
    },
    pointsRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 6,
    },
    pointsText: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      color: c.textPrimary,
    },
    signOutButton: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 4,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    signOutText: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.medium,
      color: c.danger,
    },
    errorText: {
      fontSize: fontSize.sm,
      color: c.danger,
    },
    editProfileButton: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 4,
      alignSelf: "flex-start" as const,
    },
    editProfileText: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.medium,
      color: c.accentStrong,
    },
    languageRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
      marginTop: spacing.md,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    languageLabel: {
      fontSize: fontSize.sm,
      color: c.textSecondary,
    },
    languagePicker: {
      flexDirection: "row" as const,
      backgroundColor: c.surfaceMuted,
      borderRadius: radii.full,
      padding: 2,
    },
    languageOption: {
      paddingHorizontal: spacing.sm,
      height: 28,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      borderRadius: radii.full,
    },
    languageOptionActive: {
      backgroundColor: c.surface,
      ...cardShadow("sm", scheme),
    },
    languageOptionText: {
      fontSize: fontSize.xs,
      fontWeight: fontWeight.medium,
      color: c.textSecondary,
    },
    languageOptionTextActive: {
      color: c.textPrimary,
      fontWeight: fontWeight.semibold,
    },
    themeRow: {
      marginTop: spacing.lg,
    },
    themeLabel: {
      fontSize: fontSize.xs,
      color: c.textSecondary,
      letterSpacing: 1.2,
      textTransform: "uppercase" as const,
      marginBottom: spacing.sm,
    },
    themePicker: {
      flexDirection: "row" as const,
      gap: spacing.sm,
    },
    themeOption: {
      flex: 1,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xs,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      gap: 5,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: c.border,
    },
    themeOptionActive: {
      borderColor: c.accent,
      backgroundColor: c.accentMuted,
    },
    themeOptionText: {
      fontSize: fontSize.xs,
      fontWeight: fontWeight.medium,
      color: c.textSecondary,
    },
    themeOptionTextActive: {
      color: c.accent,
      fontWeight: fontWeight.semibold,
    },
    statsRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      backgroundColor: c.surfaceMuted,
      borderRadius: radii.lg,
      paddingVertical: spacing.sm,
    },
    statBlock: {
      flex: 1,
      alignItems: "center" as const,
      gap: 2,
    },
    statDivider: {
      width: 1,
      alignSelf: "stretch" as const,
      backgroundColor: c.border,
    },
    statValueRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 2,
    },
    statValue: {
      fontSize: fontSize.lg,
      fontWeight: fontWeight.bold,
      color: c.textPrimary,
    },
    statLabel: {
      fontSize: fontSize.xs,
      color: c.textSecondary,
    },
    leaderboardSection: {
      marginTop: spacing.xl,
      gap: spacing.md,
    },
    tabRow: {
      position: "relative" as const,
      flexDirection: "row" as const,
    },
    tabButton: {
      flex: 1,
      height: 36,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    tabButtonText: {
      fontSize: 10.5,
      fontWeight: fontWeight.medium,
      color: c.textSecondary,
      letterSpacing: 1,
      textTransform: "uppercase" as const,
    },
    tabButtonTextActive: {
      color: c.accent,
      fontWeight: fontWeight.semibold,
    },
    tabUnderline: {
      position: "absolute" as const,
      bottom: 0,
      height: 2,
      backgroundColor: c.accent,
      borderRadius: 1,
    },
    tabRowDivider: {
      height: 1,
      backgroundColor: c.border,
    },
    listLoading: {
      alignItems: "center" as const,
      gap: spacing.sm,
      paddingVertical: spacing.xl,
    },
    retryText: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      color: c.accentStrong,
    },
    emptyState: {
      alignItems: "center" as const,
      gap: spacing.sm,
      paddingTop: spacing.md,
    },
    emptyListText: {
      fontSize: fontSize.sm,
      color: c.textSecondary,
      textAlign: "center" as const,
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.xl,
    },
    listGap: {
      gap: spacing.sm,
    },
    leaderboardRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: spacing.sm,
      backgroundColor: c.surface,
      borderRadius: radii.lg,
      padding: spacing.md,
    },
    rankText: {
      width: 20,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      color: c.textMuted,
      textAlign: "center" as const,
    },
    collectionIcon: {
      width: 36,
      height: 36,
      borderRadius: radii.md,
      backgroundColor: c.accentMuted,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    rowMain: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    rowName: {
      fontSize: fontSize.base,
      fontWeight: fontWeight.semibold,
      color: c.textPrimary,
    },
    rowVenue: {
      fontSize: fontSize.sm,
      color: c.textSecondary,
    },
    rowMetaRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: spacing.sm,
    },
    rowMetaText: {
      fontSize: fontSize.xs,
      color: c.textSecondary,
    },
    ratingBadge: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 4,
    },
    ratingBadgeText: {
      fontSize: fontSize.xs,
      fontWeight: fontWeight.semibold,
    },
    removeButton: {
      padding: spacing.xs,
    },
    editActionsRow: {
      flexDirection: "row" as const,
      gap: spacing.sm,
    },
    cancelButton: {
      paddingHorizontal: spacing.md,
      height: 40,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: c.border,
    },
    cancelButtonText: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.medium,
      color: c.textSecondary,
    },
    saveButton: {
      flex: 1,
      backgroundColor: c.accent,
      height: 40,
      borderRadius: radii.lg,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    saveButtonDisabled: {
      opacity: 0.5,
    },
    saveButtonText: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      color: c.textOnAccent,
    },
  }));

  const [isEditing, setIsEditing] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [usernameInput, setUsernameInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<LeaderboardTab>("been_there");
  const leaderboardTabIndex = LEADERBOARD_TABS.findIndex((t) => t.key === activeTab);
  const leaderboardUnderlineIndex = useRef(new Animated.Value(leaderboardTabIndex)).current;
  useEffect(() => {
    Animated.timing(leaderboardUnderlineIndex, {
      toValue: leaderboardTabIndex,
      duration: 150,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false, // animates `left` as a percentage string, which the native driver can't handle
    }).start();
  }, [leaderboardTabIndex, leaderboardUnderlineIndex]);
  const leaderboardUnderlineLeft = leaderboardUnderlineIndex.interpolate({
    inputRange: LEADERBOARD_TABS.map((_, i) => i),
    outputRange: LEADERBOARD_TABS.map((_, i) => `${(i * 100) / LEADERBOARD_TABS.length}%`),
  });
  const [loggedBathrooms, setLoggedBathrooms] = useState<LoggedBathroom[]>([]);
  const [savedBathrooms, setSavedBathrooms] = useState<BathroomPublic[]>([]);
  const [collections, setCollections] = useState<BathroomList[]>([]);
  const [collectionCounts, setCollectionCounts] = useState<Map<string, number>>(new Map());
  const [friendCount, setFriendCount] = useState(0);
  const [listsLoading, setListsLoading] = useState(true);
  const [listsError, setListsError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [showLoggedMap, setShowLoggedMap] = useState(false);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);

  // Own effect (not folded into loadLists below): refetches on every focus,
  // not just on user-change, so accepting a request or opening the Inbox on
  // those two screens is reflected the moment you come back here - loadLists
  // deliberately doesn't re-run that often, this is cheap enough to.
  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      getIncomingRequests(user.id).then((rows) => setPendingRequestCount(rows.length));
      getUnreadNotificationCount(user.id).then(setUnreadCount);
    }, [user])
  );

  const loadLists = useCallback(async () => {
    if (!user) return;
    setListsLoading(true);
    setListsError(null);
    try {
      const [logged, saved, lists, friendIds] = await Promise.all([
        getMyLoggedBathrooms(user.id),
        getSavedBathrooms(user.id),
        getListsForUser(user.id),
        getFriendIds(user.id),
      ]);
      setLoggedBathrooms(logged);
      setSavedBathrooms(saved);
      setCollections(lists);
      setFriendCount(friendIds.length);
      setCollectionCounts(await getListItemCounts(lists.map((l) => l.id)));
    } catch (err) {
      setListsError(err instanceof Error ? err.message : "Couldn't load your activity.");
    } finally {
      setListsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadLists();
  }, [loadLists]);

  const streak = useMemo(() => computeLoggingStreak(loggedBathrooms), [loggedBathrooms]);

  async function handleRemoveSaved(id: string) {
    if (!user || removingId) return;
    setRemovingId(id);
    try {
      await toggleBookmark(id, user.id, true);
      setSavedBathrooms((prev) => prev.filter((b) => b.id !== id));
    } catch {
      // Leave the row in place - the user can just tap again.
    } finally {
      setRemovingId(null);
    }
  }

  function handleOpenBathroom(id: string) {
    router.push(`/bathrooms/${id}`);
  }

  function handleOpenOnMap(id: string) {
    router.navigate({ pathname: "/", params: { focusBathroomId: id } });
  }

  // Belt-and-suspenders alongside AuthGatedStack's own redirect (see
  // app/_layout.tsx) - a session that survives in storage after its
  // profiles row is gone (e.g. the account was deleted) gets signed out by
  // loadProfile itself (src/lib/auth.tsx), which flips `user` to null and
  // lands here for a beat before that redirect fires.
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth/sign-in");
    }
  }, [loading, user, router]);

  function startEditing() {
    setNameInput(profile?.display_name ?? "");
    setUsernameInput(profile?.username ?? "");
    setError(null);
    setIsEditing(true);
  }

  async function handleSave() {
    const trimmedName = nameInput.trim();
    const trimmedUsername = usernameInput.trim().toLowerCase();
    if (!trimmedName || saving) return;
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

    if (trimmedName !== profile?.display_name) {
      const { error: nameError } = await updateDisplayName(trimmedName);
      if (nameError) {
        setSaving(false);
        setError(nameError);
        return;
      }
    }

    setSaving(false);
    setIsEditing(false);
  }

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
      await uploadAvatar(user.id, result.assets[0].uri);
      await refreshProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't upload photo.");
    } finally {
      setUploadingPhoto(false);
    }
  }

  if (loading || !user) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        <View style={styles.centerContent}>
          <ArabesqueLoader size={40} color={colors.accentStrong} />
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>Couldn't load your profile.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const displayLabel = profile.display_name || profile.username || "";
  const initial = displayLabel.trim().charAt(0).toUpperCase() || "?";
  const points = profile.points;

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.screenHeader}>
        <LavLogo size={22} />
        <View style={styles.headerActions}>
          <Pressable
            style={styles.headerIconButton}
            onPress={() => router.push("/profile/requests")}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Friend requests"
          >
            <Ionicons name="person-add-outline" size={20} color={colors.textPrimary} />
            {pendingRequestCount > 0 ? (
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>{pendingRequestCount > 9 ? "9+" : pendingRequestCount}</Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable
            style={styles.headerIconButton}
            onPress={() => router.push("/profile/inbox")}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Inbox"
          >
            <Ionicons name="mail-outline" size={20} color={colors.textPrimary} />
            {unreadCount > 0 ? (
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.contentInner}>
          <View style={[styles.card, cardShadow("sm", scheme)]}>
            <View style={styles.headerRow}>
              <View style={styles.identityRow}>
                <Pressable
                  style={styles.avatar}
                  onPress={handlePickPhoto}
                  disabled={uploadingPhoto}
                  accessibilityRole="button"
                  accessibilityLabel="Change profile photo"
                >
                  {profile.avatar_url ? (
                    <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
                  ) : (
                    <Text style={styles.avatarText}>{initial}</Text>
                  )}
                  {uploadingPhoto ? (
                    <View style={styles.avatarOverlay}>
                      <ArabesqueLoader size={18} color={colors.textOnOverlay} />
                    </View>
                  ) : (
                    <View style={styles.avatarBadge}>
                      <Ionicons name="camera" size={11} color={colors.textOnAccent} />
                    </View>
                  )}
                </Pressable>
                <View style={styles.textBlock}>
                  {isEditing ? (
                    <>
                      <TextInput
                        value={nameInput}
                        onChangeText={setNameInput}
                        placeholder="Display name"
                        placeholderTextColor={colors.textMuted}
                        style={styles.nameInput}
                        autoFocus
                        returnKeyType="next"
                      />
                      <TextInput
                        value={usernameInput}
                        onChangeText={setUsernameInput}
                        placeholder="username"
                        placeholderTextColor={colors.textMuted}
                        style={styles.usernameInput}
                        autoCapitalize="none"
                        autoCorrect={false}
                        returnKeyType="done"
                        onSubmitEditing={handleSave}
                      />
                    </>
                  ) : (
                    <>
                      <Text style={styles.name} numberOfLines={1}>
                        {displayLabel}
                      </Text>
                      {profile.username ? (
                        <Text style={styles.username} numberOfLines={1}>
                          @{profile.username}
                        </Text>
                      ) : null}
                      <LevelBadge level={profile.level} />
                    </>
                  )}
                  <View style={styles.pointsRow}>
                    <Ionicons name="trophy-outline" size={14} color={colors.textPrimary} />
                    <Text style={styles.pointsText}>{t("profile.points", { count: points })}</Text>
                  </View>
                  <LevelProgressBar points={points} level={profile.level} />
                </View>
              </View>

              <Pressable
                style={styles.signOutButton}
                onPress={() => signOut()}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t("profile.signOut")}
              >
                <Ionicons name="log-out-outline" size={18} color={colors.danger} />
                <Text style={styles.signOutText}>{t("profile.signOut")}</Text>
              </Pressable>
            </View>

            <View style={styles.statsRow}>
              <Pressable
                style={styles.statBlock}
                onPress={() => loggedBathrooms.length > 0 && setShowLoggedMap(true)}
                disabled={loggedBathrooms.length === 0}
                accessibilityRole="button"
                accessibilityLabel="View logged bathrooms on a map"
              >
                <Text style={styles.statValue}>{loggedBathrooms.length}</Text>
                <Text style={styles.statLabel}>{t("profile.stats.logged")}</Text>
              </Pressable>
              <View style={styles.statDivider} />
              <View style={styles.statBlock}>
                <View style={styles.statValueRow}>
                  {streak > 0 ? <Ionicons name="flame" size={16} color={colors.warning} /> : null}
                  <Text style={styles.statValue}>{streak}</Text>
                </View>
                <Text style={styles.statLabel}>{t("profile.stats.dayStreak")}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBlock}>
                <Text style={styles.statValue}>{savedBathrooms.length}</Text>
                <Text style={styles.statLabel}>{t("profile.stats.wantToGo")}</Text>
              </View>
              <View style={styles.statDivider} />
              <Pressable
                style={styles.statBlock}
                onPress={() => friendCount > 0 && router.push("/profile/friends")}
                disabled={friendCount === 0}
                accessibilityRole="button"
                accessibilityLabel="View your friends"
              >
                <Text style={styles.statValue}>{friendCount}</Text>
                <Text style={styles.statLabel}>{t("profile.stats.friends")}</Text>
              </Pressable>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {isEditing ? (
              <View style={styles.editActionsRow}>
                <Pressable style={styles.cancelButton} onPress={() => setIsEditing(false)} disabled={saving}>
                  <Text style={styles.cancelButtonText}>{t("common.cancel")}</Text>
                </Pressable>
                <Pressable
                  style={[styles.saveButton, (!nameInput.trim() || saving) && styles.saveButtonDisabled]}
                  onPress={handleSave}
                  disabled={!nameInput.trim() || saving}
                >
                  {saving ? (
                    <ArabesqueLoader size={20} color={colors.textOnAccent} />
                  ) : (
                    <Text style={styles.saveButtonText}>{t("common.save")}</Text>
                  )}
                </Pressable>
              </View>
            ) : (
              <Pressable style={styles.editProfileButton} onPress={startEditing} hitSlop={8}>
                <Ionicons name="pencil-outline" size={14} color={colors.accentStrong} />
                <Text style={styles.editProfileText}>{t("profile.editProfile")}</Text>
              </Pressable>
            )}

            <View style={styles.languageRow}>
              <Text style={styles.languageLabel}>{t("language.title")}</Text>
              <View style={styles.languagePicker}>
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <Pressable
                    key={lang}
                    style={[styles.languageOption, i18n.language === lang && styles.languageOptionActive]}
                    onPress={() => setLanguage(lang as SupportedLanguage)}
                  >
                    <Text style={[styles.languageOptionText, i18n.language === lang && styles.languageOptionTextActive]}>
                      {t(`language.${lang}`)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.themeRow}>
              <Text style={styles.themeLabel}>{t("theme.title")}</Text>
              <View style={styles.themePicker}>
                {THEME_MODES.map((themeMode) => (
                  <Pressable
                    key={themeMode}
                    style={[styles.themeOption, mode === themeMode && styles.themeOptionActive]}
                    onPress={() => setMode(themeMode)}
                  >
                    <Ionicons
                      name={THEME_ICONS[themeMode]}
                      size={16}
                      color={mode === themeMode ? colors.accent : colors.textSecondary}
                    />
                    <Text style={[styles.themeOptionText, mode === themeMode && styles.themeOptionTextActive]}>
                      {t(`theme.${themeMode}`)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.leaderboardSection}>
            <View style={styles.tabRow}>
              {LEADERBOARD_TABS.map((tab) => (
                <Pressable key={tab.key} style={styles.tabButton} onPress={() => setActiveTab(tab.key)}>
                  <Text style={[styles.tabButtonText, activeTab === tab.key && styles.tabButtonTextActive]}>
                    {t(tab.labelKey)}
                  </Text>
                </Pressable>
              ))}
              <Animated.View
                style={[styles.tabUnderline, { left: leaderboardUnderlineLeft, width: `${100 / LEADERBOARD_TABS.length}%` }]}
              />
            </View>
            <View style={styles.tabRowDivider} />

            {listsLoading ? (
              <View style={styles.listLoading}>
                <ArabesqueLoader size={28} color={colors.accentStrong} />
              </View>
            ) : listsError ? (
              <View style={styles.listLoading}>
                <Text style={styles.errorText}>{listsError}</Text>
                <Pressable onPress={loadLists}>
                  <Text style={styles.retryText}>Retry</Text>
                </Pressable>
              </View>
            ) : activeTab === "been_there" ? (
              loggedBathrooms.length === 0 ? (
                <View style={styles.emptyState}>
                  <FlowerMark size={40} color={colors.border} sw={0.75} />
                  <Text style={styles.emptyListText}>
                    Nothing logged yet - use "Rate & log" on a bathroom to start your leaderboard.
                  </Text>
                </View>
              ) : (
                <View style={styles.listGap}>
                  {loggedBathrooms.map((review, index) => (
                    <Pressable
                      key={review.id}
                      style={[styles.leaderboardRow, cardShadow("sm", scheme)]}
                      onPress={() => handleOpenBathroom(review.bathroom_id)}
                    >
                      <Text style={styles.rankText}>{index + 1}</Text>
                      <View style={styles.rowMain}>
                        <Text style={styles.rowName} numberOfLines={1}>
                          {review.bathroom?.name ?? "Unknown bathroom"}
                        </Text>
                        {review.bathroom?.venue_name ? (
                          <Text style={styles.rowVenue} numberOfLines={1}>
                            {review.bathroom.venue_name}
                          </Text>
                        ) : null}
                      </View>
                      <View style={styles.ratingBadge}>
                        <FlowerMark size={12} color={pinFill(review.overall_rating)} filled />
                        <Text style={[styles.ratingBadgeText, { color: pinFill(review.overall_rating) }]}>{review.overall_rating.toFixed(1)}</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              )
            ) : activeTab === "want_to_go" ? (
              savedBathrooms.length === 0 ? (
                <View style={styles.emptyState}>
                  <FlowerMark size={40} color={colors.border} sw={0.75} />
                  <Text style={styles.emptyListText}>
                    Nothing saved yet - tap the heart on a bathroom's card on the map to bookmark it.
                  </Text>
                </View>
              ) : (
              <View style={styles.listGap}>
                {savedBathrooms.map((bathroom) => (
                  <Pressable
                    key={bathroom.id}
                    style={[styles.leaderboardRow, cardShadow("sm", scheme)]}
                    onPress={() => handleOpenOnMap(bathroom.id)}
                  >
                    <View style={styles.rowMain}>
                      <Text style={styles.rowName} numberOfLines={1}>
                        {bathroom.name}
                      </Text>
                      <View style={styles.rowMetaRow}>
                        {bathroom.venue_name ? (
                          <Text style={styles.rowVenue} numberOfLines={1}>
                            {bathroom.venue_name}
                          </Text>
                        ) : null}
                        {bathroom.access_type ? (
                          <Text style={styles.rowMetaText}>{ACCESS_TYPE_LABELS[bathroom.access_type]}</Text>
                        ) : null}
                        {bathroom.cost_type ? (
                          <Text style={styles.rowMetaText}>{COST_TYPE_LABELS[bathroom.cost_type]}</Text>
                        ) : null}
                      </View>
                    </View>
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        handleRemoveSaved(bathroom.id);
                      }}
                      style={styles.removeButton}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${bathroom.name} from saved`}
                    >
                      {removingId === bathroom.id ? (
                        <ArabesqueLoader size={18} color={colors.danger} />
                      ) : (
                        <Ionicons name="heart" size={18} color={colors.danger} />
                      )}
                    </Pressable>
                  </Pressable>
                ))}
              </View>
              )
            ) : collections.length === 0 ? (
              <View style={styles.emptyState}>
                <FlowerMark size={40} color={colors.border} sw={0.75} />
                <Text style={styles.emptyListText}>No collections yet - save a bathroom to one to create it.</Text>
              </View>
            ) : (
              <View style={styles.listGap}>
                {collections.map((list) => (
                  <Pressable
                    key={list.id}
                    style={[styles.leaderboardRow, cardShadow("sm", scheme)]}
                    onPress={() => router.push(`/collections/${list.id}`)}
                  >
                    <View style={styles.collectionIcon}>
                      <Ionicons name="albums-outline" size={18} color={colors.accentStrong} />
                    </View>
                    <View style={styles.rowMain}>
                      <Text style={styles.rowName} numberOfLines={1}>
                        {list.title}
                      </Text>
                      <Text style={styles.rowVenue}>
                        {collectionCounts.get(list.id) ?? 0} bathroom
                        {(collectionCounts.get(list.id) ?? 0) === 1 ? "" : "s"}
                        {list.visibility !== "public" ? " · Private" : ""}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {showLoggedMap ? (
        <LoggedBathroomsMap
          title={t("profile.usersMap", { name: displayLabel })}
          bathrooms={loggedBathrooms
            .filter((r) => r.bathroom)
            .map((r) => ({
              id: r.bathroom!.id,
              name: r.bathroom!.name,
              latitude: r.bathroom!.latitude,
              longitude: r.bathroom!.longitude,
              overallRating: r.overall_rating,
            }))}
          onClose={() => setShowLoggedMap(false)}
          onSelectBathroom={(id) => {
            setShowLoggedMap(false);
            handleOpenBathroom(id);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

