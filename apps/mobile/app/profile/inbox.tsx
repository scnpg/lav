import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ArabesqueLoader } from "../../src/components/ArabesqueLoader";
import { FloralBloom } from "../../src/components/ArabesquePattern";
import { getNotifications, markAllNotificationsRead, type NotificationRow } from "../../src/features/social/api";
import { useAuth } from "../../src/lib/auth";
import { formatRelativeTime } from "../../src/lib/format";
import { cardShadow, colors, fontSize, fontWeight, radii, spacing } from "../../src/theme";

const ICONS: Record<NotificationRow["type"], keyof typeof Ionicons.glyphMap> = {
  friend_request: "person-add-outline",
  friend_accept: "people-outline",
  review_like: "heart",
  review_reply: "chatbubble-outline",
};

function messageFor(row: NotificationRow): string {
  const name = row.actor?.display_name || row.actor?.username || "Someone";
  switch (row.type) {
    case "friend_request":
      return `${name} sent you a friend request`;
    case "friend_accept":
      return `${name} accepted your friend request`;
    case "review_like":
      return `${name} liked your review`;
    case "review_reply":
      return `${name} replied to your review`;
  }
}

// Opening this screen marks everything as read (see markAllNotificationsRead) -
// simpler than per-item read tracking, and matches how most apps treat "you
// looked at the list" as the read signal for a badge count.
export default function InboxScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getNotifications(user.id)
      .then(setNotifications)
      .finally(() => setLoading(false));
    markAllNotificationsRead(user.id).catch(() => {});
  }, [user]);

  function handlePress(row: NotificationRow) {
    if (row.type === "friend_request" || row.type === "friend_accept") {
      if (row.actor_id) router.push(`/profile/${row.actor_id}`);
    } else if (row.bathroom_id) {
      router.push(`/bathrooms/${row.bathroom_id}`);
    }
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Inbox</Text>
        <View style={styles.backButton} />
      </View>

      {loading ? (
        <View style={styles.centerContent}>
          <ArabesqueLoader size={32} color={colors.accentStrong} />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.centerContent}>
          <FloralBloom size={32} color={colors.borderStrong} />
          <Text style={styles.emptyText}>Nothing yet - likes, replies, and friend requests will show up here.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {notifications.map((row) => {
            const name = row.actor?.display_name || row.actor?.username || "Someone";
            return (
              <Pressable key={row.id} style={[styles.row, cardShadow("sm"), !row.read && styles.rowUnread]} onPress={() => handlePress(row)}>
                <View style={styles.avatar}>
                  {row.actor?.avatar_url ? (
                    <Image source={{ uri: row.actor.avatar_url }} style={styles.avatarImage} />
                  ) : (
                    <Text style={styles.avatarInitial}>{name.charAt(0).toUpperCase()}</Text>
                  )}
                  <View style={styles.iconBadge}>
                    <Ionicons name={ICONS[row.type]} size={11} color={colors.textOnAccent} />
                  </View>
                </View>
                <View style={styles.rowMain}>
                  <Text style={styles.rowText} numberOfLines={2}>
                    {messageFor(row)}
                  </Text>
                  <Text style={styles.timeText}>{formatRelativeTime(row.created_at)}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  backButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  centerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing["2xl"],
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: "center",
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing["2xl"],
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
  rowUnread: {
    backgroundColor: colors.accentMuted,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
  },
  avatarInitial: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  iconBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: radii.full,
    backgroundColor: colors.accentStrong,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowText: {
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },
  timeText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
});
