import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fontSize, fontWeight, radii, spacing } from "../../theme";

interface BathroomActionPanelProps {
  isInCollection: boolean;
  checkingCollections: boolean;
  uploadingPhoto: boolean;
  onNavigate: () => void;
  onSaveToCollection: () => void;
  onAddPhoto: () => void;
  onSuggestEdit: () => void;
}

// The four secondary actions ("Navigate", "Save to Collection", "Add
// Photo", "Suggest edit") - "Rate & Log" is its own prominent button above
// this row (see app/bathrooms/[id].tsx), not part of this panel. The middle
// button opens SaveToCollectionModal rather than toggling a single boolean -
// isInCollection just drives whether the icon reads as filled/outline (in at
// least one of the user's collections or not). "Suggest edit" routes to the
// bathroom_submissions moderation queue (app/bathrooms/submit.tsx), not a
// direct write - distinct from the map's own quicker "Edit Info" sheet
// (EditBathroomModal), which still writes straight to `bathrooms`.
export function BathroomActionPanel({
  isInCollection,
  checkingCollections,
  uploadingPhoto,
  onNavigate,
  onSaveToCollection,
  onAddPhoto,
  onSuggestEdit,
}: BathroomActionPanelProps) {
  return (
    <View style={styles.row}>
      <ActionButton icon="navigate" label="Navigate" onPress={onNavigate} />
      <ActionButton
        icon={isInCollection ? "bookmark" : "bookmark-outline"}
        label={isInCollection ? "Saved" : "Save"}
        tone={isInCollection ? "active" : "default"}
        onPress={onSaveToCollection}
        loading={checkingCollections}
      />
      <ActionButton icon="camera-outline" label="Add photo" onPress={onAddPhoto} loading={uploadingPhoto} />
      <ActionButton icon="create-outline" label="Suggest edit" onPress={onSuggestEdit} />
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  loading,
  tone = "default",
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  loading?: boolean;
  tone?: "default" | "active";
}) {
  return (
    <Pressable style={styles.button} onPress={onPress} disabled={loading} accessibilityRole="button" accessibilityLabel={label}>
      <View style={[styles.iconCircle, tone === "active" && styles.iconCircleActive]}>
        {loading ? (
          <ActivityIndicator size="small" color={tone === "active" ? colors.textOnAccent : colors.accentStrong} />
        ) : (
          <Ionicons name={icon} size={19} color={tone === "active" ? colors.textOnAccent : colors.accentStrong} />
        )}
      </View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  button: {
    alignItems: "center",
    gap: spacing.xs,
    flex: 1,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: radii.full,
    backgroundColor: colors.accentMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircleActive: {
    backgroundColor: colors.accent,
  },
  label: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
