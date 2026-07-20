import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { LevelBadge } from "../../src/components/LevelBadge";
import { ACCESS_TYPE_LABELS, COST_TYPE_LABELS } from "../../src/constants/enumLabels";
import { getSavedBathrooms, toggleBookmark } from "../../src/features/bathrooms/api";
import { getMyLoggedBathrooms, type LoggedBathroom } from "../../src/features/bathrooms/ratingsApi";
import { getListItemCounts, getListsForUser } from "../../src/features/lists/api";
import { useAuth } from "../../src/lib/auth";
import { uploadAvatar } from "../../src/lib/profiles";
import { cardShadow, colors, fontSize, fontWeight, radii, spacing } from "../../src/theme";
import type { BathroomList, BathroomPublic } from "../../src/types/database";

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

type LeaderboardTab = "been_there" | "want_to_go" | "collections";

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
  const { user, profile, loading, updateDisplayName, updateUsername, refreshProfile, signOut } = useAuth();
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [usernameInput, setUsernameInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<LeaderboardTab>("been_there");
  const [loggedBathrooms, setLoggedBathrooms] = useState<LoggedBathroom[]>([]);
  const [savedBathrooms, setSavedBathrooms] = useState<BathroomPublic[]>([]);
  const [collections, setCollections] = useState<BathroomList[]>([]);
  const [collectionCounts, setCollectionCounts] = useState<Map<string, number>>(new Map());
  const [listsLoading, setListsLoading] = useState(true);
  const [listsError, setListsError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadLists = useCallback(async () => {
    if (!user) return;
    setListsLoading(true);
    setListsError(null);
    try {
      const [logged, saved, lists] = await Promise.all([
        getMyLoggedBathrooms(user.id),
        getSavedBathrooms(user.id),
        getListsForUser(user.id),
      ]);
      setLoggedBathrooms(logged);
      setSavedBathrooms(saved);
      setCollections(lists);
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
          <ActivityIndicator color={colors.accentStrong} />
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
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.contentInner}>
          <View style={[styles.card, cardShadow("sm")]}>
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
                      <ActivityIndicator color={colors.textOnOverlay} size="small" />
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
                    <Text style={styles.pointsText}>
                      {points} point{points === 1 ? "" : "s"}
                    </Text>
                  </View>
                </View>
              </View>

              <Pressable
                style={styles.signOutButton}
                onPress={() => signOut()}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Sign out"
              >
                <Ionicons name="log-out-outline" size={18} color={colors.danger} />
                <Text style={styles.signOutText}>Sign out</Text>
              </Pressable>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statBlock}>
                <Text style={styles.statValue}>{loggedBathrooms.length}</Text>
                <Text style={styles.statLabel}>Logged</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBlock}>
                <View style={styles.statValueRow}>
                  {streak > 0 ? <Ionicons name="flame" size={16} color={colors.warning} /> : null}
                  <Text style={styles.statValue}>{streak}</Text>
                </View>
                <Text style={styles.statLabel}>Day streak</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBlock}>
                <Text style={styles.statValue}>{savedBathrooms.length}</Text>
                <Text style={styles.statLabel}>Want to go</Text>
              </View>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {isEditing ? (
              <View style={styles.editActionsRow}>
                <Pressable style={styles.cancelButton} onPress={() => setIsEditing(false)} disabled={saving}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.saveButton, (!nameInput.trim() || saving) && styles.saveButtonDisabled]}
                  onPress={handleSave}
                  disabled={!nameInput.trim() || saving}
                >
                  {saving ? (
                    <ActivityIndicator color={colors.textOnAccent} size="small" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save</Text>
                  )}
                </Pressable>
              </View>
            ) : (
              <Pressable style={styles.editProfileButton} onPress={startEditing} hitSlop={8}>
                <Ionicons name="pencil-outline" size={14} color={colors.accentStrong} />
                <Text style={styles.editProfileText}>Edit profile</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.leaderboardSection}>
            <View style={styles.tabRow}>
              <Pressable
                style={[styles.tabButton, activeTab === "been_there" && styles.tabButtonActive]}
                onPress={() => setActiveTab("been_there")}
              >
                <Text style={[styles.tabButtonText, activeTab === "been_there" && styles.tabButtonTextActive]}>
                  Been there
                </Text>
              </Pressable>
              <Pressable
                style={[styles.tabButton, activeTab === "want_to_go" && styles.tabButtonActive]}
                onPress={() => setActiveTab("want_to_go")}
              >
                <Text style={[styles.tabButtonText, activeTab === "want_to_go" && styles.tabButtonTextActive]}>
                  Want to go
                </Text>
              </Pressable>
              <Pressable
                style={[styles.tabButton, activeTab === "collections" && styles.tabButtonActive]}
                onPress={() => setActiveTab("collections")}
              >
                <Text style={[styles.tabButtonText, activeTab === "collections" && styles.tabButtonTextActive]}>
                  Collections
                </Text>
              </Pressable>
            </View>

            {listsLoading ? (
              <View style={styles.listLoading}>
                <ActivityIndicator color={colors.accentStrong} />
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
                <Text style={styles.emptyListText}>
                  Nothing logged yet - use "Rate & log" on a bathroom to start your leaderboard.
                </Text>
              ) : (
                <View style={styles.listGap}>
                  {loggedBathrooms.map((review, index) => (
                    <Pressable
                      key={review.id}
                      style={[styles.leaderboardRow, cardShadow("sm")]}
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
                        <Ionicons name="star" size={12} color={colors.gold} />
                        <Text style={styles.ratingBadgeText}>{review.overall_rating.toFixed(1)}</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              )
            ) : activeTab === "want_to_go" ? (
              savedBathrooms.length === 0 ? (
                <Text style={styles.emptyListText}>
                  Nothing saved yet - tap the heart on a bathroom's card on the map to bookmark it.
                </Text>
              ) : (
              <View style={styles.listGap}>
                {savedBathrooms.map((bathroom) => (
                  <Pressable
                    key={bathroom.id}
                    style={[styles.leaderboardRow, cardShadow("sm")]}
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
                        <ActivityIndicator size="small" color={colors.danger} />
                      ) : (
                        <Ionicons name="heart" size={18} color={colors.danger} />
                      )}
                    </Pressable>
                  </Pressable>
                ))}
              </View>
              )
            ) : collections.length === 0 ? (
              <Text style={styles.emptyListText}>No collections yet - save a bathroom to one to create it.</Text>
            ) : (
              <View style={styles.listGap}>
                {collections.map((list) => (
                  <Pressable
                    key={list.id}
                    style={[styles.leaderboardRow, cardShadow("sm")]}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    alignItems: "center",
    paddingVertical: spacing.lg,
  },
  contentInner: {
    width: "100%",
    maxWidth: 480,
    paddingHorizontal: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    flex: 1,
    minWidth: 0,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radii.full,
    backgroundColor: colors.accentMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: {
    width: 56,
    height: 56,
    borderRadius: radii.full,
  },
  avatarOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radii.full,
    backgroundColor: colors.overlay,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: radii.full,
    backgroundColor: colors.accentStrong,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  textBlock: {
    gap: 4,
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  nameInput: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderStrong,
    paddingVertical: 2,
  },
  username: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  usernameInput: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderStrong,
    paddingVertical: 2,
    marginTop: 2,
  },
  pointsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  pointsText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  signOutText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.danger,
  },
  errorText: {
    fontSize: fontSize.sm,
    color: colors.danger,
  },
  editProfileButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
  },
  editProfileText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.accentStrong,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.lg,
    paddingVertical: spacing.sm,
  },
  statBlock: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  statDivider: {
    width: 1,
    alignSelf: "stretch",
    backgroundColor: colors.border,
  },
  statValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  statValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  leaderboardSection: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  tabRow: {
    flexDirection: "row",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.full,
    padding: 3,
  },
  tabButton: {
    flex: 1,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.full,
  },
  tabButtonActive: {
    backgroundColor: colors.surface,
    ...cardShadow("sm"),
  },
  tabButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  tabButtonTextActive: {
    color: colors.textPrimary,
    fontWeight: fontWeight.semibold,
  },
  listLoading: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  retryText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.accentStrong,
  },
  emptyListText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: "center",
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  listGap: {
    gap: spacing.sm,
  },
  leaderboardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  rankText: {
    width: 20,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textMuted,
    textAlign: "center",
  },
  collectionIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.accentMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowName: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  rowVenue: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  rowMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  rowMetaText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.goldMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  ratingBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  removeButton: {
    padding: spacing.xs,
  },
  editActionsRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  cancelButton: {
    paddingHorizontal: spacing.md,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  saveButton: {
    flex: 1,
    backgroundColor: colors.accent,
    height: 40,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textOnAccent,
  },
});
