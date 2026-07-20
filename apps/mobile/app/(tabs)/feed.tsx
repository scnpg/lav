import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { LevelBadge } from "../../src/components/LevelBadge";
import { getFriendIds } from "../../src/features/friends/api";
import {
  getFriendsFeed,
  getPopularNearMe,
  getRecentReviews,
  type RecentReviewFeedItem,
} from "../../src/features/bathrooms/ratingsApi";
import { useLiveLocation } from "../../src/hooks/useLiveLocation";
import { useAuth } from "../../src/lib/auth";
import { formatRelativeTime } from "../../src/lib/format";
import { fontSize, fontWeight, radii, spacing } from "../../src/theme";

type FeedTab = "friends" | "popular" | "trending";

const TABS: { key: FeedTab; label: string }[] = [
  { key: "friends", label: "Friends" },
  { key: "popular", label: "Popular Near Me" },
  { key: "trending", label: "National Trending" },
];

// A dedicated dark palette for the activity cards specifically - a
// deliberate "spotlight" treatment for this one screen, not a global
// dark-mode system, so it's kept local to this file rather than added to
// the shared (light, "muted oasis") theme tokens every other screen uses.
const dark = {
  background: "#0B0C0E",
  card: "#17181C",
  cardBorder: "#26282E",
  textPrimary: "#F4F3EF",
  textSecondary: "#9A9CA5",
  textMuted: "#6B6D76",
  accent: "#6FE7D8",
  gold: "#E8B84B",
  scoreBg: "#20261F",
};

const SUB_SCORE_FIELDS: {
  key: "cleanliness_score" | "smell_score" | "ambience_score" | "privacy_score";
  icon: string;
  label: string;
}[] = [
  { key: "cleanliness_score", icon: "🧼", label: "Cleanliness" },
  { key: "smell_score", icon: "👃", label: "Smell" },
  { key: "ambience_score", icon: "✨", label: "Ambience" },
  { key: "privacy_score", icon: "🔒", label: "Privacy" },
];

// Beli-style discovery feed - three lenses over the same bathroom_reviews
// data: who you know (friendships), what's hot around you right now
// (live GPS + 15km/30-day window), and what's hot everywhere (the same
// global recent-activity query the single-tab Feed used before).
export default function FeedScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { status: locationStatus, coords: userLocation } = useLiveLocation();

  const [activeTab, setActiveTab] = useState<FeedTab>("trending");
  const [reviews, setReviews] = useState<RecentReviewFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        let rows: RecentReviewFeedItem[];
        if (activeTab === "friends") {
          rows = user ? await getFriendsFeed(await getFriendIds(user.id), 20) : [];
        } else if (activeTab === "popular") {
          rows = userLocation ? await getPopularNearMe(userLocation, 20) : [];
        } else {
          rows = await getRecentReviews(20);
        }
        setReviews(rows);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't load the feed.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeTab, user, userLocation]
  );

  // Fires on every focus AND whenever `load` itself changes identity (tab
  // switch, sign-in/out, a live GPS fix arriving) - one hook covers both
  // "came back to this tab" and "changed what this tab should show." Only
  // the very first load ever shows the big spinner; everything after that
  // uses the quiet pull-to-refresh path so neither a tab switch nor a
  // refocus flashes the screen blank.
  const hasLoadedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      load(hasLoadedOnce.current);
      hasLoadedOnce.current = true;
    }, [load])
  );

  function renderEmptyState() {
    if (activeTab === "friends" && !user) {
      return { icon: "people-outline" as const, text: "Sign in to see what your friends are rating." };
    }
    if (activeTab === "friends") {
      return {
        icon: "people-outline" as const,
        text: "No friend activity yet - add friends from their profile to see their ratings here.",
      };
    }
    if (activeTab === "popular" && locationStatus === "denied") {
      return { icon: "location-outline" as const, text: "Enable location access to see what's popular near you." };
    }
    if (activeTab === "popular" && locationStatus !== "granted") {
      return { icon: "location-outline" as const, text: "Waiting for your location..." };
    }
    if (activeTab === "popular") {
      return { icon: "trending-up-outline" as const, text: "No ratings within 15km in the last 30 days yet." };
    }
    return { icon: "newspaper-outline" as const, text: "No activity yet - be the first to rate a bathroom with \"Rate & log\"." };
  }

  const empty = renderEmptyState();

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <Text style={styles.title}>Feed</Text>

      <View style={styles.tabRow}>
        {TABS.map((tab) => (
          <Pressable
            key={tab.key}
            style={[styles.tabButton, activeTab === tab.key && styles.tabButtonActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabButtonText, activeTab === tab.key && styles.tabButtonTextActive]} numberOfLines={1}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator color={dark.accent} />
        </View>
      ) : error ? (
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={() => load()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      ) : reviews.length === 0 ? (
        <View style={styles.centerContent}>
          <Ionicons name={empty.icon} size={28} color={dark.textMuted} />
          <Text style={styles.emptyText}>{empty.text}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={dark.accent} />}
        >
          {reviews.map((review) => (
            <FeedCard key={review.id} review={review} onPress={() => router.push(`/bathrooms/${review.bathroom_id}`)} />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function FeedCard({ review, onPress }: { review: RecentReviewFeedItem; onPress: () => void }) {
  const router = useRouter();
  const subScores = SUB_SCORE_FIELDS.map(({ key, icon, label }) => {
    const value = review[key];
    return value != null ? { icon, label, value } : null;
  }).filter((s): s is { icon: string; label: string; value: number } => s !== null);

  const authorName = review.author?.display_name || review.author?.username || "Someone";

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.headerRow}>
        <Pressable
          style={styles.authorRow}
          onPress={(e) => {
            e.stopPropagation();
            if (review.user_id) router.push(`/profile/${review.user_id}`);
          }}
          hitSlop={4}
        >
          <View style={styles.avatar}>
            {review.author?.avatar_url ? (
              <Image source={{ uri: review.author.avatar_url }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarInitial}>{authorName.charAt(0).toUpperCase()}</Text>
            )}
          </View>
          <View style={styles.headerText}>
            <Text style={styles.authorName} numberOfLines={1}>
              {authorName}
            </Text>
            <View style={styles.headerMetaRow}>
              {review.author ? <LevelBadge level={review.author.level} /> : null}
              <Text style={styles.timeText}>{formatRelativeTime(review.created_at)}</Text>
            </View>
          </View>
        </Pressable>
      </View>

      <View style={styles.bathroomRow}>
        <Text style={styles.bathroomName} numberOfLines={1}>
          {review.bathroom?.name ?? "a bathroom"}
        </Text>
        <View style={styles.overallBadge}>
          <Ionicons name="star" size={13} color={dark.gold} />
          <Text style={styles.overallBadgeText}>{review.overall_rating.toFixed(1)}</Text>
        </View>
      </View>
      {review.bathroom?.venue_name ? <Text style={styles.venueText}>{review.bathroom.venue_name}</Text> : null}

      {subScores.length > 0 ? (
        <Text style={styles.subScoreText}>
          {subScores.map((s, i) => `${i > 0 ? "  |  " : ""}${s.icon} ${s.label}: ${s.value}/5`).join("")}
        </Text>
      ) : null}

      {review.review_text ? (
        <Text style={styles.reviewText} numberOfLines={3}>
          {review.review_text}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: dark.background,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: dark.textPrimary,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  tabRow: {
    flexDirection: "row",
    backgroundColor: dark.card,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: dark.cardBorder,
    padding: 3,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  tabButton: {
    flex: 1,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.full,
    paddingHorizontal: 4,
  },
  tabButtonActive: {
    backgroundColor: dark.accent,
  },
  tabButtonText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: dark.textSecondary,
  },
  tabButtonTextActive: {
    color: "#0B0C0E",
    fontWeight: fontWeight.bold,
  },
  centerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing["2xl"],
    gap: spacing.sm,
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: dark.textSecondary,
    textAlign: "center",
  },
  errorText: {
    fontSize: fontSize.sm,
    color: "#E8827A",
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: dark.accent,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xs,
  },
  retryButtonText: {
    color: "#0B0C0E",
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing["2xl"],
    gap: spacing.md,
  },
  card: {
    backgroundColor: dark.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: dark.cardBorder,
    padding: spacing.md,
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  authorRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minWidth: 0,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    backgroundColor: dark.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
  },
  avatarInitial: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: dark.textPrimary,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  authorName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: dark.textPrimary,
  },
  headerMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  timeText: {
    fontSize: fontSize.xs,
    color: dark.textMuted,
  },
  bathroomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  bathroomName: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: dark.textPrimary,
  },
  overallBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: dark.scoreBg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  overallBadgeText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: dark.gold,
  },
  venueText: {
    fontSize: fontSize.sm,
    color: dark.textSecondary,
    marginTop: -4,
  },
  subScoreText: {
    fontSize: fontSize.xs,
    color: dark.textSecondary,
  },
  reviewText: {
    fontSize: fontSize.sm,
    color: dark.textSecondary,
    fontStyle: "italic",
  },
});
