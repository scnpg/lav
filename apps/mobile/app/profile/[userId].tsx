import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LevelBadge } from "../../src/components/LevelBadge";
import { LoggedBathroomsMap } from "../../src/components/LoggedBathroomsMap";
import { getMyLoggedBathrooms, type LoggedBathroom } from "../../src/features/bathrooms/ratingsApi";
import {
  acceptFriendRequest,
  getFriendshipState,
  removeFriendship,
  sendFriendRequest,
  type FriendshipState,
} from "../../src/features/friends/api";
import { getListItemCounts, getListsForUser } from "../../src/features/lists/api";
import { useAuth } from "../../src/lib/auth";
import { getPublicProfile } from "../../src/lib/profiles";
import { cardShadow, colors, fontSize, fontWeight, radii, spacing } from "../../src/theme";
import type { BathroomList, Profile } from "../../src/types/database";

type Tab = "been_there" | "collections";

// The cross-profile route - tapping a name/avatar anywhere (Feed cards,
// review blocks) lands here. Read-only: no editing controls, and no "Want
// to go" tab, since saved_bathrooms is owner-only data (RLS wouldn't return
// anyone else's anyway). "Been there" and public collections are visible to
// everyone by design - that's the whole point of a social leaderboard.
export default function PublicProfileScreen() {
  const { t } = useTranslation();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user: viewer } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loggedBathrooms, setLoggedBathrooms] = useState<LoggedBathroom[]>([]);
  const [lists, setLists] = useState<BathroomList[]>([]);
  const [listCounts, setListCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("been_there");
  const [friendState, setFriendState] = useState<FriendshipState>("none");
  const [friendActionBusy, setFriendActionBusy] = useState(false);
  const [showLoggedMap, setShowLoggedMap] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [profileRow, logged, listRows] = await Promise.all([
        getPublicProfile(userId),
        getMyLoggedBathrooms(userId),
        getListsForUser(userId),
      ]);
      setProfile(profileRow);
      setLoggedBathrooms(logged);
      setLists(listRows);
      setListCounts(await getListItemCounts(listRows.map((l) => l.id)));
      if (viewer && viewer.id !== userId) {
        setFriendState(await getFriendshipState(viewer.id, userId));
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Couldn't load this profile.");
    } finally {
      setLoading(false);
    }
  }, [userId, viewer]);

  async function handleFriendAction() {
    if (!viewer || !userId || friendActionBusy) return;
    setFriendActionBusy(true);
    try {
      if (friendState === "none") {
        await sendFriendRequest(viewer.id, userId);
        setFriendState("outgoing");
      } else if (friendState === "incoming") {
        await acceptFriendRequest(viewer.id, userId);
        setFriendState("friends");
      } else {
        // "outgoing" (withdraw) or "friends" (unfriend) - same delete, either direction.
        await removeFriendship(viewer.id, userId);
        setFriendState("none");
      }
    } catch {
      // Low-stakes social toggle - leave the button at its last known state on failure.
    } finally {
      setFriendActionBusy(false);
    }
  }

  useEffect(() => {
    load();
  }, [load]);

  // Visiting your own public link is a no-op detour - send it to the real
  // (editable) Profile tab instead.
  useEffect(() => {
    if (viewer && userId && viewer.id === userId) {
      router.replace("/(tabs)/profile");
    }
  }, [viewer, userId, router]);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator color={colors.accentStrong} />
      </View>
    );
  }

  if (loadError || !profile) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{loadError ?? "This person couldn't be found."}</Text>
        <Pressable style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const displayLabel = profile.display_name || profile.username || "Someone";
  const initial = displayLabel.trim().charAt(0).toUpperCase() || "?";

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backButton}>
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </Pressable>
        </View>

        {friendState === "incoming" ? (
          <Pressable
            style={styles.confirmBanner}
            onPress={handleFriendAction}
            disabled={friendActionBusy}
            accessibilityRole="button"
            accessibilityLabel="Confirm friend request"
          >
            <Ionicons name="person-add" size={16} color={colors.textOnAccent} />
            <Text style={styles.confirmBannerText}>
              {displayLabel} sent you a friend request - Confirm friend request?
            </Text>
            {friendActionBusy ? <ActivityIndicator size="small" color={colors.textOnAccent} /> : null}
          </Pressable>
        ) : null}

        <View style={styles.contentInner}>
          <View style={styles.identityBlock}>
            <View style={styles.avatar}>
              {profile.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>{initial}</Text>
              )}
            </View>
            <Text style={styles.name}>{displayLabel}</Text>
            {profile.username ? <Text style={styles.username}>@{profile.username}</Text> : null}
            <LevelBadge level={profile.level} size="md" />

            {viewer ? (
              <Pressable
                style={[
                  styles.friendButton,
                  (friendState === "friends" || friendState === "incoming") && styles.friendButtonActive,
                ]}
                onPress={handleFriendAction}
                disabled={friendActionBusy}
              >
                {friendActionBusy ? (
                  <ActivityIndicator
                    size="small"
                    color={friendState === "friends" || friendState === "incoming" ? colors.textOnAccent : colors.accentStrong}
                  />
                ) : (
                  <>
                    <Ionicons
                      name={
                        friendState === "friends"
                          ? "people"
                          : friendState === "incoming"
                            ? "checkmark-circle-outline"
                            : friendState === "outgoing"
                              ? "time-outline"
                              : "person-add-outline"
                      }
                      size={15}
                      color={
                        friendState === "friends" || friendState === "incoming" ? colors.textOnAccent : colors.accentStrong
                      }
                    />
                    <Text
                      style={[
                        styles.friendButtonText,
                        (friendState === "friends" || friendState === "incoming") && styles.friendButtonTextActive,
                      ]}
                    >
                      {friendState === "friends"
                        ? "Friends"
                        : friendState === "incoming"
                          ? "Accept request"
                          : friendState === "outgoing"
                            ? "Request sent"
                            : "Add friend"}
                    </Text>
                  </>
                )}
              </Pressable>
            ) : null}

            <View style={styles.statsRow}>
              <Pressable
                style={styles.statBlock}
                onPress={() => loggedBathrooms.length > 0 && setShowLoggedMap(true)}
                disabled={loggedBathrooms.length === 0}
                accessibilityRole="button"
                accessibilityLabel={`View ${displayLabel}'s map`}
              >
                <Text style={styles.statValue}>{loggedBathrooms.length}</Text>
                <Text style={styles.statLabel}>Logged</Text>
              </Pressable>
              <View style={styles.statDivider} />
              <View style={styles.statBlock}>
                <Text style={styles.statValue}>{profile.points}</Text>
                <Text style={styles.statLabel}>Points</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBlock}>
                <Text style={styles.statValue}>{lists.length}</Text>
                <Text style={styles.statLabel}>Collections</Text>
              </View>
            </View>
          </View>

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
              style={[styles.tabButton, activeTab === "collections" && styles.tabButtonActive]}
              onPress={() => setActiveTab("collections")}
            >
              <Text style={[styles.tabButtonText, activeTab === "collections" && styles.tabButtonTextActive]}>
                Collections
              </Text>
            </Pressable>
          </View>

          {activeTab === "been_there" ? (
            loggedBathrooms.length === 0 ? (
              <Text style={styles.emptyText}>Nothing logged yet.</Text>
            ) : (
              <View style={styles.listGap}>
                {loggedBathrooms.map((review, index) => (
                  <Pressable
                    key={review.id}
                    style={[styles.row, cardShadow("sm")]}
                    onPress={() => router.push(`/bathrooms/${review.bathroom_id}`)}
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
          ) : lists.length === 0 ? (
            <Text style={styles.emptyText}>No public collections yet.</Text>
          ) : (
            <View style={styles.listGap}>
              {lists.map((list) => (
                <Pressable
                  key={list.id}
                  style={[styles.row, cardShadow("sm")]}
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
                      {listCounts.get(list.id) ?? 0} bathroom{(listCounts.get(list.id) ?? 0) === 1 ? "" : "s"}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </Pressable>
              ))}
            </View>
          )}
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
            router.push(`/bathrooms/${id}`);
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    gap: spacing.md,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
    paddingBottom: spacing["2xl"],
  },
  header: {
    width: "100%",
    paddingHorizontal: spacing.lg,
  },
  backButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  contentInner: {
    width: "100%",
    maxWidth: 480,
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  identityBlock: {
    alignItems: "center",
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: radii.full,
    backgroundColor: colors.accentMuted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  avatarImage: {
    width: 84,
    height: 84,
    borderRadius: radii.full,
  },
  avatarText: {
    fontSize: fontSize["2xl"],
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  name: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  username: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  friendButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    height: 36,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.accentStrong,
  },
  friendButtonActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  friendButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.accentStrong,
  },
  friendButtonTextActive: {
    color: colors.textOnAccent,
  },
  confirmBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.accentStrong,
  },
  confirmBannerText: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textOnAccent,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.lg,
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
    width: "100%",
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
  statValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
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
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: "center",
    paddingVertical: spacing.xl,
  },
  listGap: {
    gap: spacing.sm,
  },
  row: {
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
  errorText: {
    fontSize: fontSize.sm,
    color: colors.danger,
    textAlign: "center",
    paddingHorizontal: spacing["2xl"],
  },
  backLink: {
    marginTop: spacing.xs,
  },
  backLinkText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
});
