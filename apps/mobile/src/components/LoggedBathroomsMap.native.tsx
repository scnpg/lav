import { Ionicons } from "@expo/vector-icons";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fontSize, fontWeight, radii, spacing } from "../theme";

export interface LoggedMapPin {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

interface LoggedBathroomsMapProps {
  bathrooms: LoggedMapPin[];
  onClose: () => void;
  onSelectBathroom: (id: string) => void;
}

// Same "not built for native yet" honesty as MapView.native.tsx /
// PinPickerMap.native.tsx - a plain tappable list instead of pretending to
// place real pins.
export function LoggedBathroomsMap({ bathrooms, onClose, onSelectBathroom }: LoggedBathroomsMapProps) {
  return (
    <View style={styles.overlay}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {bathrooms.length} bathroom{bathrooms.length === 1 ? "" : "s"} logged
        </Text>
        <Pressable
          style={styles.closeButton}
          onPress={onClose}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Ionicons name="close" size={20} color={colors.textPrimary} />
        </Pressable>
      </View>
      <Text style={styles.hintText}>Interactive map isn't available on this build yet - here's the list instead.</Text>
      <FlatList
        data={bathrooms}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => onSelectBathroom(item.id)}>
            <Ionicons name="location" size={16} color={colors.accentStrong} />
            <Text style={styles.rowText} numberOfLines={1}>
              {item.name}
            </Text>
          </Pressable>
        )}
      />
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
    zIndex: 1000,
    backgroundColor: colors.background,
    paddingTop: 48,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
  },
  title: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
  },
  hintText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  listContent: {
    padding: spacing.lg,
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
  rowText: {
    flex: 1,
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },
});
