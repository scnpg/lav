import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ArabesqueLoader } from "../../src/components/ArabesqueLoader";
import { FloralBloom } from "../../src/components/ArabesquePattern";
import { LevelBadge } from "../../src/components/LevelBadge";
import {
  acceptFriendRequest,
  getIncomingRequests,
  getOutgoingRequests,
  removeFriendship,
} from "../../src/features/friends/api";
import type { ProfileLite } from "../../src/lib/profiles";
import { useAuth } from "../../src/lib/auth";
import { cardShadow, colors, fontSize, fontWeight, radii, spacing } from "../../src/theme";
import type { Friendship } from "../../src/types/database";

type IncomingRow = Friendship & { requester: ProfileLite | null };
type OutgoingRow = Friendship & { recipient: ProfileLite | null };

// Friend requests, split into the two directions - people asking to friend
// you (actionable: accept/decline) and requests you've sent still awaiting
// a reply (actionable: cancel). No admin review anywhere in this flow - see
// migration 0038's header for the two things in this app that actually are
// admin-gated (neither of them is this).
export default function FriendRequestsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [incoming, setIncoming] = useState<IncomingRow[]>([]);
  const [outgoing, setOutgoing] = useState<OutgoingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [incomingRows, outgoingRows] = await Promise.all([
        getIncomingRequests(user.id),
        getOutgoingRequests(user.id),
      ]);
      setIncoming(incomingRows);
      setOutgoing(outgoingRows);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAccept(requesterId: string) {
    if (!user || busyId) return;
    setBusyId(requesterId);
    try {
      await acceptFriendRequest(user.id, requesterId);
      setIncoming((prev) => prev.filter((r) => r.user_id !== requesterId));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDecline(otherUserId: string, isOutgoing: boolean) {
    if (!user || busyId) return;
    setBusyId(otherUserId);
    try {
      await removeFriendship(user.id, otherUserId);
      if (isOutgoing) setOutgoing((prev) => prev.filter((r) => r.friend_id !== otherUserId));
      else setIncoming((prev) => prev.filter((r) => r.user_id !== otherUserId));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Friend requests</Text>
        <View style={styles.backButton} />
      </View>

      {loading ? (
        <View style={styles.centerContent}>
          <ArabesqueLoader size={32} color={colors.accentStrong} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionLabel}>Received</Text>
          {incoming.length === 0 ? (
            <View style={styles.emptyState}>
              <FloralBloom size={28} color={colors.borderStrong} />
              <Text style={styles.emptyText}>No pending requests.</Text>
            </View>
          ) : (
            incoming.map((row) => {
              const name = row.requester?.display_name || row.requester?.username || "Someone";
              return (
                <View key={row.id} style={[styles.row, cardShadow("sm")]}>
                  <Pressable
                    style={styles.rowIdentity}
                    onPress={() => router.push(`/profile/${row.user_id}`)}
                    hitSlop={4}
                  >
                    <View style={styles.avatar}>
                      {row.requester?.avatar_url ? (
                        <Image source={{ uri: row.requester.avatar_url }} style={styles.avatarImage} />
                      ) : (
                        <Text style={styles.avatarInitial}>{name.charAt(0).toUpperCase()}</Text>
                      )}
                    </View>
                    <View style={styles.rowText}>
                      <Text style={styles.rowName} numberOfLines={1}>
                        {name}
                      </Text>
                      {row.requester ? <LevelBadge level={row.requester.level} /> : null}
                    </View>
                  </Pressable>
                  <View style={styles.actionsRow}>
                    <Pressable
                      style={styles.acceptButton}
                      onPress={() => handleAccept(row.user_id)}
                      disabled={busyId === row.user_id}
                    >
                      {busyId === row.user_id ? (
                        <ActivityIndicator size="small" color={colors.textOnAccent} />
                      ) : (
                        <Text style={styles.acceptButtonText}>Accept</Text>
                      )}
                    </Pressable>
                    <Pressable
                      style={styles.declineButton}
                      onPress={() => handleDecline(row.user_id, false)}
                      disabled={busyId === row.user_id}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="Decline"
                    >
                      <Ionicons name="close" size={16} color={colors.textSecondary} />
                    </Pressable>
                  </View>
                </View>
              );
            })
          )}

          <Text style={styles.sectionLabel}>Sent</Text>
          {outgoing.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No outgoing requests.</Text>
            </View>
          ) : (
            outgoing.map((row) => {
              const name = row.recipient?.display_name || row.recipient?.username || "Someone";
              return (
                <View key={row.id} style={[styles.row, cardShadow("sm")]}>
                  <Pressable
                    style={styles.rowIdentity}
                    onPress={() => router.push(`/profile/${row.friend_id}`)}
                    hitSlop={4}
                  >
                    <View style={styles.avatar}>
                      {row.recipient?.avatar_url ? (
                        <Image source={{ uri: row.recipient.avatar_url }} style={styles.avatarImage} />
                      ) : (
                        <Text style={styles.avatarInitial}>{name.charAt(0).toUpperCase()}</Text>
                      )}
                    </View>
                    <View style={styles.rowText}>
                      <Text style={styles.rowName} numberOfLines={1}>
                        {name}
                      </Text>
                      <Text style={styles.pendingText}>Pending</Text>
                    </View>
                  </Pressable>
                  <Pressable
                    style={styles.cancelButton}
                    onPress={() => handleDecline(row.friend_id, true)}
                    disabled={busyId === row.friend_id}
                  >
                    {busyId === row.friend_id ? (
                      <ActivityIndicator size="small" color={colors.textSecondary} />
                    ) : (
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    )}
                  </Pressable>
                </View>
              );
            })
          )}
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
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing["2xl"],
    gap: spacing.sm,
  },
  sectionLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  emptyState: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  rowIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
    minWidth: 0,
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
  pendingText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  acceptButton: {
    backgroundColor: colors.accent,
    borderRadius: radii.full,
    height: 32,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  acceptButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textOnAccent,
  },
  declineButton: {
    width: 32,
    height: 32,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
  },
  cancelButton: {
    height: 32,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
});
