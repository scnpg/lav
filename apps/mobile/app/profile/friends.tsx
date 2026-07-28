import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ArabesqueLoader } from "../../src/components/ArabesqueLoader";
import { FloralBloom } from "../../src/components/ArabesquePattern";
import { LevelBadge } from "../../src/components/LevelBadge";
import { getFriends } from "../../src/features/friends/api";
import { useAuth } from "../../src/lib/auth";
import type { ProfileLite } from "../../src/lib/profiles";
import { cardShadow, colors, fontSize, fontWeight, radii, spacing } from "../../src/theme";

// Reached by tapping the Friends count on the (own) Profile screen. Always
// the signed-in user's own friend list - there's no route param here since
// nothing currently links to "someone else's friends" (public profiles don't
// show a friend count to tap in the first place).
export default function FriendsListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [friends, setFriends] = useState<ProfileLite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getFriends(user.id)
      .then(setFriends)
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Friends</Text>
        <View style={styles.backButton} />
      </View>

      {loading ? (
        <View style={styles.centerContent}>
          <ArabesqueLoader size={32} color={colors.accentStrong} />
        </View>
      ) : friends.length === 0 ? (
        <View style={styles.centerContent}>
          <FloralBloom size={32} color={colors.borderStrong} />
          <Text style={styles.emptyText}>No friends yet - add some from their profile.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {friends.map((friend) => {
            const name = friend.display_name || friend.username || "Someone";
            return (
              <Pressable
                key={friend.id}
                style={[styles.row, cardShadow("sm")]}
                onPress={() => router.push(`/profile/${friend.id}`)}
              >
                <View style={styles.avatar}>
                  {friend.avatar_url ? (
                    <Image source={{ uri: friend.avatar_url }} style={styles.avatarImage} />
                  ) : (
                    <Text style={styles.avatarInitial}>{name.charAt(0).toUpperCase()}</Text>
                  )}
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {name}
                  </Text>
                  <LevelBadge level={friend.level} />
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
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
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
  },
  avatarInitial: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowName: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
});
