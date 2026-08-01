import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ArabesqueLoader } from "../../src/components/ArabesqueLoader";
import { ArabesquePattern } from "../../src/components/ArabesquePattern";
import { LavLogo } from "../../src/components/LavLogo";
import { ACCESS_TYPE_LABELS, COST_TYPE_LABELS } from "../../src/constants/enumLabels";
import { getSavedBathrooms, toggleBookmark } from "../../src/features/bathrooms/api";
import { getListItemCounts, getListsForUser } from "../../src/features/lists/api";
import { useAuth } from "../../src/lib/auth";
import { formatScore } from "../../src/lib/format";
import { cardShadow, fontSize, fontWeight, radii, spacing, useTheme, useThemedStyles } from "../../src/theme";
import type { BathroomList, BathroomPublic } from "../../src/types/database";

// A directory of every list the user has - their custom collections
// (bathroom_lists) plus "Saved" (the quick heart-icon bookmark from
// BathroomBottomCard/saved_bathrooms), which is just one entry among them,
// not the whole tab. Tapping a custom collection opens the shared
// app/collections/[id] viewer; tapping "Saved" expands the flat
// saved-bathrooms view in place, since that data doesn't live in
// bathroom_lists.
export default function ListsScreen() {
  const { user } = useAuth();
  const { colors, scheme } = useTheme();
  const router = useRouter();
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
    },
    centerContent: {
      flex: 1,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      paddingHorizontal: spacing["2xl"],
      gap: spacing.sm,
    },
    header: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
    },
    title: {
      fontSize: fontSize.xl,
      fontWeight: fontWeight.bold,
      color: c.textPrimary,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
    },
    backRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
    },
    emptyText: {
      fontSize: fontSize.sm,
      color: c.textSecondary,
      textAlign: "center" as const,
    },
    errorText: {
      fontSize: fontSize.sm,
      color: c.danger,
      textAlign: "center" as const,
    },
    signInButton: {
      backgroundColor: c.accent,
      borderRadius: radii.lg,
      paddingHorizontal: spacing.lg,
      height: 40,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      marginTop: spacing.xs,
    },
    signInButtonText: {
      color: c.textOnAccent,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
    },
    listContent: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing["2xl"],
      gap: spacing.sm,
    },
    listIcon: {
      width: 36,
      height: 36,
      borderRadius: radii.md,
      backgroundColor: c.accentMuted,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    row: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: spacing.sm,
      backgroundColor: c.surface,
      borderRadius: radii.lg,
      padding: spacing.md,
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
      marginTop: spacing.xs,
    },
    rowMetaText: {
      fontSize: fontSize.xs,
      color: c.textSecondary,
    },
    scoreBadge: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 4,
      backgroundColor: c.goldMuted,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radii.full,
    },
    scoreText: {
      fontSize: fontSize.xs,
      fontWeight: fontWeight.semibold,
      color: c.textPrimary,
    },
    removeButton: {
      padding: spacing.xs,
    },
  }));
  const [bathrooms, setBathrooms] = useState<BathroomPublic[]>([]);
  const [collections, setCollections] = useState<BathroomList[]>([]);
  const [collectionCounts, setCollectionCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [viewingSaved, setViewingSaved] = useState(false);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!user) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const [saved, lists] = await Promise.all([getSavedBathrooms(user.id), getListsForUser(user.id)]);
        setBathrooms(saved);
        setCollections(lists);
        setCollectionCounts(await getListItemCounts(lists.map((l) => l.id)));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't load your lists.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user]
  );

  // Refetches every time this tab gains focus (not just on first mount) -
  // bookmarking a bathroom or saving to a collection elsewhere, then
  // switching back here, used to show stale data until a manual reload.
  // Only the first load shows the big spinner; later focuses use the quiet
  // pull-to-refresh path so switching tabs doesn't flash the screen blank.
  const hasLoadedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      load(hasLoadedOnce.current);
      hasLoadedOnce.current = true;
    }, [load])
  );

  function handleOpenOnMap(id: string) {
    // navigate, not push: push onto a sibling tab creates a second stack
    // instance of the Map screen (confirmed - MapLibre visibly re-fetches
    // its style/tiles from scratch when done that way) instead of
    // refocusing the existing one, which would strand the flyTo/select
    // logic on the old instance while a brand new, empty one mounts.
    router.navigate({ pathname: "/", params: { focusBathroomId: id } });
  }

  async function handleRemove(id: string) {
    if (!user || removingId) return;
    setRemovingId(id);
    try {
      await toggleBookmark(id, user.id, true);
      setBathrooms((prev) => prev.filter((b) => b.id !== id));
    } catch {
      // Leave the row in place - the user can just tap again.
    } finally {
      setRemovingId(null);
    }
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        <View style={styles.patternLayer} pointerEvents="none">
          <ArabesquePattern opacity={0.05} />
        </View>
        <View style={styles.centerContent}>
          <Ionicons name="albums-outline" size={28} color={colors.textMuted} />
          <Text style={styles.emptyText}>Sign in to see your lists.</Text>
          <Pressable style={styles.signInButton} onPress={() => router.push("/auth/sign-in")}>
            <Text style={styles.signInButtonText}>Sign in</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        <View style={styles.patternLayer} pointerEvents="none">
          <ArabesquePattern opacity={0.05} />
        </View>
        <View style={styles.centerContent}>
          <ArabesqueLoader size={32} color={colors.accentStrong} framed />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        <View style={styles.patternLayer} pointerEvents="none">
          <ArabesquePattern opacity={0.05} />
        </View>
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.signInButton} onPress={() => load()}>
            <Text style={styles.signInButtonText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (viewingSaved) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        <View style={styles.patternLayer} pointerEvents="none">
          <ArabesquePattern opacity={0.05} />
        </View>
        <Pressable style={styles.backRow} onPress={() => setViewingSaved(false)} hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
          <Text style={styles.title}>Saved</Text>
        </Pressable>
        {bathrooms.length === 0 ? (
          <View style={styles.centerContent}>
            <Ionicons name="bookmark-outline" size={28} color={colors.textMuted} />
            <Text style={styles.emptyText}>
              Nothing saved yet - tap the heart on a bathroom's card on the map to bookmark it.
            </Text>
          </View>
        ) : (
          <FlatList
            data={bathrooms}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.accentStrong} />
            }
            renderItem={({ item }) => (
              <Pressable style={[styles.row, cardShadow("sm", scheme)]} onPress={() => handleOpenOnMap(item.id)}>
                <View style={styles.rowMain}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {item.venue_name ? (
                    <Text style={styles.rowVenue} numberOfLines={1}>
                      {item.venue_name}
                    </Text>
                  ) : null}
                  <View style={styles.rowMetaRow}>
                    <View style={styles.scoreBadge}>
                      <Ionicons name="star" size={11} color={colors.gold} />
                      <Text style={styles.scoreText}>{formatScore(item.overall_score)}</Text>
                    </View>
                    {item.access_type ? (
                      <Text style={styles.rowMetaText}>{ACCESS_TYPE_LABELS[item.access_type]}</Text>
                    ) : null}
                    {item.cost_type ? (
                      <Text style={styles.rowMetaText}>{COST_TYPE_LABELS[item.cost_type]}</Text>
                    ) : null}
                    {item.amenities.wheelchair_accessible ? (
                      <Ionicons name="accessibility-outline" size={13} color={colors.textSecondary} />
                    ) : null}
                  </View>
                </View>

                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    handleRemove(item.id);
                  }}
                  style={styles.removeButton}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${item.name} from saved`}
                >
                  {removingId === item.id ? (
                    <ArabesqueLoader size={18} color={colors.danger} />
                  ) : (
                    <Ionicons name="heart" size={20} color={colors.danger} />
                  )}
                </Pressable>
              </Pressable>
            )}
          />
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.patternLayer} pointerEvents="none">
        <ArabesquePattern opacity={0.05} />
      </View>
      <View style={styles.header}>
        <LavLogo size={22} />
      </View>
      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.accentStrong} />
        }
      >
        <Pressable style={[styles.row, cardShadow("sm", scheme)]} onPress={() => setViewingSaved(true)}>
          <View style={styles.listIcon}>
            <Ionicons name="bookmark" size={18} color={colors.accentStrong} />
          </View>
          <View style={styles.rowMain}>
            <Text style={styles.rowName}>Saved</Text>
            <Text style={styles.rowVenue}>
              {bathrooms.length} bathroom{bathrooms.length === 1 ? "" : "s"}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </Pressable>

        {collections.map((list) => (
          <Pressable
            key={list.id}
            style={[styles.row, cardShadow("sm", scheme)]}
            onPress={() => router.push(`/collections/${list.id}`)}
          >
            <View style={styles.listIcon}>
              <Ionicons name="albums-outline" size={18} color={colors.accentStrong} />
            </View>
            <View style={styles.rowMain}>
              <Text style={styles.rowName} numberOfLines={1}>
                {list.title}
              </Text>
              <Text style={styles.rowVenue}>
                {collectionCounts.get(list.id) ?? 0} bathroom{(collectionCounts.get(list.id) ?? 0) === 1 ? "" : "s"}
                {list.visibility !== "public" ? " · Private" : ""}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

