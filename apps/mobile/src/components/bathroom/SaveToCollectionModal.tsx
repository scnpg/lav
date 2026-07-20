import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import {
  addBathroomToList,
  createList,
  getListsContainingBathroom,
  getListsForUser,
  removeBathroomFromList,
} from "../../features/lists/api";
import { cardShadow, colors, fontSize, fontWeight, radii, spacing } from "../../theme";
import type { BathroomList } from "../../types/database";
import { FormStatusBanner, type FormStatus } from "./EditableFieldControls";

interface SaveToCollectionModalProps {
  bathroomId: string;
  userId: string;
  onClose: () => void;
}

// The "Deep Curation" bottom sheet: every one of the user's collections
// (bathroom_lists) with a live checkmark for whether this bathroom is
// already in it, plus an inline "New collection" affordance that creates the
// list and adds the bathroom in one step.
export function SaveToCollectionModal({ bathroomId, userId, onClose }: SaveToCollectionModalProps) {
  const [lists, setLists] = useState<BathroomList[]>([]);
  const [memberOf, setMemberOf] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busyListId, setBusyListId] = useState<string | null>(null);
  const [status, setStatus] = useState<FormStatus | null>(null);
  const [showNewList, setShowNewList] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getListsForUser(userId), getListsContainingBathroom(userId, bathroomId)])
      .then(([listRows, memberSet]) => {
        if (cancelled) return;
        setLists(listRows);
        setMemberOf(memberSet);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus({ type: "error", message: err instanceof Error ? err.message : "Couldn't load your collections." });
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, bathroomId]);

  async function handleToggle(list: BathroomList) {
    if (busyListId) return;
    setBusyListId(list.id);
    setStatus(null);
    const currentlyIn = memberOf.has(list.id);
    try {
      if (currentlyIn) {
        await removeBathroomFromList(list.id, bathroomId);
        setMemberOf((prev) => {
          const next = new Set(prev);
          next.delete(list.id);
          return next;
        });
      } else {
        await addBathroomToList(list.id, bathroomId);
        setMemberOf((prev) => new Set(prev).add(list.id));
      }
    } catch (err) {
      setStatus({ type: "error", message: err instanceof Error ? err.message : "Couldn't update that collection." });
    } finally {
      setBusyListId(null);
    }
  }

  async function handleCreate() {
    const trimmed = newListName.trim();
    if (!trimmed || creating) return;
    setCreating(true);
    setStatus(null);
    try {
      const list = await createList(userId, trimmed);
      await addBathroomToList(list.id, bathroomId);
      setLists((prev) => [...prev, list]);
      setMemberOf((prev) => new Set(prev).add(list.id));
      setNewListName("");
      setShowNewList(false);
    } catch (err) {
      setStatus({ type: "error", message: err instanceof Error ? err.message : "Couldn't create that collection." });
    } finally {
      setCreating(false);
    }
  }

  return (
    <View style={styles.overlay}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityLabel="Close"
        accessibilityRole="button"
      />

      <View style={[styles.sheet, cardShadow("md")]}>
        <View style={styles.header}>
          <Text style={styles.title}>Save to collection</Text>
          <Pressable
            onPress={onClose}
            style={styles.closeButton}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>

        <FormStatusBanner status={status} />

        {loading ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator color={colors.accentStrong} />
          </View>
        ) : (
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {lists.map((list) => {
              const isIn = memberOf.has(list.id);
              return (
                <Pressable
                  key={list.id}
                  style={styles.row}
                  onPress={() => handleToggle(list)}
                  disabled={busyListId === list.id}
                >
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle}>{list.title}</Text>
                    {list.visibility !== "public" ? <Text style={styles.rowMeta}>Private</Text> : null}
                  </View>
                  {busyListId === list.id ? (
                    <ActivityIndicator size="small" color={colors.accentStrong} />
                  ) : (
                    <Ionicons
                      name={isIn ? "checkmark-circle" : "ellipse-outline"}
                      size={22}
                      color={isIn ? colors.accentStrong : colors.textMuted}
                    />
                  )}
                </Pressable>
              );
            })}

            {showNewList ? (
              <View style={styles.newListRow}>
                <TextInput
                  value={newListName}
                  onChangeText={setNewListName}
                  placeholder="Collection name"
                  placeholderTextColor={colors.textMuted}
                  style={styles.newListInput}
                  autoFocus
                  onSubmitEditing={handleCreate}
                />
                <Pressable
                  style={[styles.newListSaveButton, (!newListName.trim() || creating) && styles.newListSaveButtonDisabled]}
                  onPress={handleCreate}
                  disabled={!newListName.trim() || creating}
                >
                  {creating ? (
                    <ActivityIndicator size="small" color={colors.textOnAccent} />
                  ) : (
                    <Text style={styles.newListSaveText}>Add</Text>
                  )}
                </Pressable>
              </View>
            ) : (
              <Pressable style={styles.newListButton} onPress={() => setShowNewList(true)}>
                <Ionicons name="add-circle-outline" size={20} color={colors.accentStrong} />
                <Text style={styles.newListButtonText}>New collection</Text>
              </Pressable>
            )}
          </ScrollView>
        )}
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
    gap: spacing.xs,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
  },
  rowText: {
    gap: 1,
  },
  rowTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
  },
  rowMeta: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  newListButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  newListButtonText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    color: colors.accentStrong,
  },
  newListRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  newListInput: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    height: 44,
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },
  newListSaveButton: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    height: 44,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  newListSaveButtonDisabled: {
    opacity: 0.5,
  },
  newListSaveText: {
    color: colors.textOnAccent,
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
});
