import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ACCESS_TYPE_LABELS, COST_TYPE_LABELS } from "../../src/constants/enumLabels";
import { getListById, getListItems } from "../../src/features/lists/api";
import { formatScore } from "../../src/lib/format";
import { cardShadow, colors, fontSize, fontWeight, radii, spacing } from "../../src/theme";
import type { BathroomList, BathroomPublic } from "../../src/types/database";

// Read-only viewer for a single collection's contents - reachable from a
// profile's collections tab. Adding/removing bathrooms happens from the
// Save to Collection sheet on the bathroom detail screen itself, so this
// screen doesn't need its own edit affordances.
export default function CollectionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [list, setList] = useState<BathroomList | null>(null);
  const [bathrooms, setBathrooms] = useState<BathroomPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [listRow, items] = await Promise.all([getListById(id), getListItems(id)]);
      setList(listRow);
      setBathrooms(items);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Couldn't load this collection.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator color={colors.accentStrong} />
      </View>
    );
  }

  if (loadError || !list) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{loadError ?? "Couldn't find this collection."}</Text>
        <Pressable style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={1}>
            {list.title}
          </Text>
          <Text style={styles.subtitle}>
            {bathrooms.length} bathroom{bathrooms.length === 1 ? "" : "s"}
            {list.visibility !== "public" ? " · Private" : ""}
          </Text>
        </View>
      </View>

      {list.description ? <Text style={styles.description}>{list.description}</Text> : null}

      {bathrooms.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="albums-outline" size={28} color={colors.textMuted} />
          <Text style={styles.emptyText}>Nothing saved here yet.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {bathrooms.map((bathroom) => (
            <Pressable
              key={bathroom.id}
              style={[styles.row, cardShadow("sm")]}
              onPress={() => router.push(`/bathrooms/${bathroom.id}`)}
            >
              <View style={styles.rowMain}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {bathroom.name}
                </Text>
                {bathroom.venue_name ? (
                  <Text style={styles.rowVenue} numberOfLines={1}>
                    {bathroom.venue_name}
                  </Text>
                ) : null}
                <View style={styles.rowMetaRow}>
                  <View style={styles.scoreBadge}>
                    <Ionicons name="star" size={11} color={colors.gold} />
                    <Text style={styles.scoreText}>{formatScore(bathroom.overall_score)}</Text>
                  </View>
                  {bathroom.access_type ? (
                    <Text style={styles.rowMetaText}>{ACCESS_TYPE_LABELS[bathroom.access_type]}</Text>
                  ) : null}
                  {bathroom.cost_type ? (
                    <Text style={styles.rowMetaText}>{COST_TYPE_LABELS[bathroom.cost_type]}</Text>
                  ) : null}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
          ))}
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
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    gap: spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  backButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  description: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  emptyContainer: {
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
  listContent: {
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
    marginTop: spacing.xs,
  },
  rowMetaText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  scoreBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.goldMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  scoreText: {
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
