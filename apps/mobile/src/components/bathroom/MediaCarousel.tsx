import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";

import { colors, fontSize, fontWeight, radii, spacing } from "../../theme";
import type { BathroomImage } from "../../types/database";

interface MediaCarouselProps {
  images: BathroomImage[];
}

// Real user-submitted photos once there are any; a plain gradient library
// isn't in this project's dependency set (see package.json), so the empty
// state is built from a few overlapping tinted circles over the accent
// fill instead of a true CSS/native gradient - reads as an intentional
// abstract pattern rather than a blank box, no new dependency required.
export function MediaCarousel({ images }: MediaCarouselProps) {
  const { width } = useWindowDimensions();

  if (images.length === 0) {
    return (
      <View style={styles.wrapper}>
        <View style={[styles.tile, { width }, styles.placeholderTile]}>
          <View style={[styles.blob, styles.blobOne]} />
          <View style={[styles.blob, styles.blobTwo]} />
          <View style={[styles.blob, styles.blobThree]} />
          <Ionicons name="images-outline" size={36} color={colors.textOnAccent} style={styles.placeholderIcon} />
          <Text style={styles.placeholderText}>No photos yet</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
        {images.map((image) => (
          <View key={image.id} style={[styles.tile, { width }]}>
            <Image source={{ uri: image.public_url }} style={styles.image} contentFit="cover" />
          </View>
        ))}
      </ScrollView>
      <View style={styles.countBadge}>
        <Ionicons name="images-outline" size={12} color={colors.textOnOverlay} />
        <Text style={styles.countText}>{images.length} photos</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    height: 280,
    backgroundColor: colors.accent,
  },
  tile: {
    height: 280,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  placeholderTile: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  blob: {
    position: "absolute",
    borderRadius: 999,
  },
  blobOne: {
    width: 220,
    height: 220,
    backgroundColor: colors.accentStrong,
    opacity: 0.5,
    top: -80,
    left: -60,
  },
  blobTwo: {
    width: 180,
    height: 180,
    backgroundColor: colors.sky,
    opacity: 0.35,
    bottom: -70,
    right: -50,
  },
  blobThree: {
    width: 140,
    height: 140,
    backgroundColor: colors.sand,
    opacity: 0.4,
    bottom: 20,
    left: 40,
  },
  placeholderIcon: {
    opacity: 0.9,
  },
  placeholderText: {
    marginTop: spacing.sm,
    color: colors.textOnAccent,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    opacity: 0.9,
  },
  countBadge: {
    position: "absolute",
    bottom: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.overlay,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  countText: {
    color: colors.textOnOverlay,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
});
