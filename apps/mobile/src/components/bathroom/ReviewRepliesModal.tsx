import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { addReviewReply, deleteReviewReply, getReviewReplies } from "../../features/social/api";
import type { ProfileLite } from "../../lib/profiles";
import { formatRelativeTime } from "../../lib/format";
import { cardShadow, colors, fontSize, fontWeight, radii, spacing } from "../../theme";
import type { ReviewReply } from "../../types/database";
import { FormStatusBanner, type FormStatus } from "./EditableFieldControls";

const MAX_REPLY_LENGTH = 500;

interface ReviewRepliesModalProps {
  reviewId: string;
  userId: string;
  /** The signed-in user's own lite profile - used only to label/avatar their own reply instantly on send, instead of falling back to "Someone" until the next full refetch. */
  myProfile: ProfileLite | null;
  onClose: () => void;
  /** Fires after a successful add/delete so the caller (Feed) can bump its own reply count without a full refetch. */
  onCountChange?: (delta: number) => void;
}

type ReplyRow = ReviewReply & { author: ProfileLite | null };

// A flat reply list, not threaded - matches the scope of "responses" on a
// review/post rather than a full nested-comment system. Same admin-review-
// free path as likes: insert/delete straight through RLS, no queue.
export function ReviewRepliesModal({ reviewId, userId, myProfile, onClose, onCountChange }: ReviewRepliesModalProps) {
  const [replies, setReplies] = useState<ReplyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<FormStatus | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getReviewReplies(reviewId)
      .then(setReplies)
      .catch((err) => setStatus({ type: "error", message: err instanceof Error ? err.message : "Couldn't load replies." }))
      .finally(() => setLoading(false));
  }, [reviewId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSend() {
    const trimmed = draft.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setStatus(null);
    try {
      const reply = await addReviewReply(reviewId, userId, trimmed);
      setReplies((prev) => [...prev, { ...reply, author: myProfile }]);
      setDraft("");
      onCountChange?.(1);
    } catch (err) {
      setStatus({ type: "error", message: err instanceof Error ? err.message : "Couldn't post that reply." });
    } finally {
      setSending(false);
    }
  }

  async function handleDelete(id: string) {
    if (deletingId) return;
    setDeletingId(id);
    try {
      await deleteReviewReply(id);
      setReplies((prev) => prev.filter((r) => r.id !== id));
      onCountChange?.(-1);
    } catch (err) {
      setStatus({ type: "error", message: err instanceof Error ? err.message : "Couldn't delete that reply." });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <View style={styles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />

      <View style={[styles.sheet, cardShadow("md")]}>
        <View style={styles.header}>
          <Text style={styles.title}>Replies</Text>
          <Pressable onPress={onClose} style={styles.closeButton} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>

        <FormStatusBanner status={status} />

        {loading ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator color={colors.accentStrong} />
          </View>
        ) : (
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
            {replies.length === 0 ? (
              <Text style={styles.emptyText}>No replies yet - be the first.</Text>
            ) : (
              replies.map((reply) => {
                const authorName = reply.author?.display_name || reply.author?.username || "Someone";
                return (
                  <View key={reply.id} style={styles.replyRow}>
                    <View style={styles.avatar}>
                      {reply.author?.avatar_url ? (
                        <Image source={{ uri: reply.author.avatar_url }} style={styles.avatarImage} />
                      ) : (
                        <Text style={styles.avatarInitial}>{authorName.charAt(0).toUpperCase()}</Text>
                      )}
                    </View>
                    <View style={styles.replyMain}>
                      <View style={styles.replyHeaderRow}>
                        <Text style={styles.replyAuthor}>{authorName}</Text>
                        <Text style={styles.replyTime}>{formatRelativeTime(reply.created_at)}</Text>
                      </View>
                      <Text style={styles.replyBody}>{reply.body}</Text>
                    </View>
                    {reply.user_id === userId ? (
                      <Pressable
                        onPress={() => handleDelete(reply.id)}
                        disabled={deletingId === reply.id}
                        style={styles.deleteButton}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="Delete reply"
                      >
                        {deletingId === reply.id ? (
                          <ActivityIndicator size="small" color={colors.danger} />
                        ) : (
                          <Ionicons name="trash-outline" size={15} color={colors.textMuted} />
                        )}
                      </Pressable>
                    ) : null}
                  </View>
                );
              })
            )}
          </ScrollView>
        )}

        <View style={styles.composeRow}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Write a reply..."
            placeholderTextColor={colors.textMuted}
            style={styles.composeInput}
            maxLength={MAX_REPLY_LENGTH}
            multiline
          />
          <Pressable
            style={[styles.sendButton, (!draft.trim() || sending) && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!draft.trim() || sending}
            accessibilityRole="button"
            accessibilityLabel="Send reply"
          >
            {sending ? <ActivityIndicator size="small" color={colors.textOnAccent} /> : <Ionicons name="send" size={16} color={colors.textOnAccent} />}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "flex-end",
    backgroundColor: colors.overlay,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    maxHeight: "80%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  closeButton: {
    padding: spacing.xs,
  },
  loadingBlock: {
    paddingVertical: spacing["3xl"],
    alignItems: "center",
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: "center",
    paddingVertical: spacing.lg,
  },
  replyRow: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: radii.full,
    backgroundColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: {
    width: 30,
    height: 30,
    borderRadius: radii.full,
  },
  avatarInitial: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  replyMain: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  replyHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  replyAuthor: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  replyTime: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  replyBody: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  deleteButton: {
    padding: spacing.xs,
  },
  composeRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  composeInput: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.base,
    color: colors.textPrimary,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
