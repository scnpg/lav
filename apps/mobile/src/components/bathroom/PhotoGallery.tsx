import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";

import { colors, fontSize, fontWeight, radii, spacing } from "../../theme";
import type { BathroomImage } from "../../types/database";

interface PhotoGalleryProps {
  images: BathroomImage[];
}

const COLUMNS = 3;
const GRID_GAP = spacing.xs;

// The hero MediaCarousel up top is one photo at a time, swipe-to-browse -
// this is the "see everything at once" complement to it: every photo this
// bathroom has (community add-photo, ratings, and now approved submission
// photos all land in the same bathroom_images table), tap any thumbnail to
// open it full-screen and swipe from there.
export function PhotoGallery({ images }: PhotoGalleryProps) {
  const { width: screenWidth } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const thumbSize = (screenWidth - spacing.lg * 2 - GRID_GAP * (COLUMNS - 1)) / COLUMNS;

  if (images.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Photos ({images.length})</Text>
      <View style={styles.grid}>
        {images.map((image, index) => (
          <Pressable key={image.id} onPress={() => setActiveIndex(index)}>
            <Image
              source={{ uri: image.public_url }}
              style={[styles.thumb, { width: thumbSize, height: thumbSize }]}
              contentFit="cover"
            />
          </Pressable>
        ))}
      </View>

      {activeIndex !== null ? (
        <PhotoLightbox images={images} initialIndex={activeIndex} onClose={() => setActiveIndex(null)} />
      ) : null}
    </View>
  );
}

function PhotoLightbox({
  images,
  initialIndex,
  onClose,
}: {
  images: BathroomImage[];
  initialIndex: number;
  onClose: () => void;
}) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const scrollRef = useRef<ScrollView>(null);

  return (
    <View style={styles.lightboxOverlay}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        contentOffset={{ x: initialIndex * screenWidth, y: 0 }}
        onMomentumScrollEnd={(e) => {
          setCurrentIndex(Math.round(e.nativeEvent.contentOffset.x / screenWidth));
        }}
      >
        {images.map((image) => (
          <View key={image.id} style={{ width: screenWidth, height: screenHeight }}>
            <Image source={{ uri: image.public_url }} style={styles.lightboxImage} contentFit="contain" />
          </View>
        ))}
      </ScrollView>

      <Pressable
        style={styles.lightboxClose}
        onPress={onClose}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Close photo viewer"
      >
        <Ionicons name="close" size={22} color="#FFFFFF" />
      </Pressable>

      <View style={styles.lightboxCounter}>
        <Text style={styles.lightboxCounterText}>
          {currentIndex + 1} / {images.length}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GRID_GAP,
  },
  thumb: {
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceMuted,
  },
  // A dedicated near-black immersive backdrop, not colors.overlay - this is
  // a full-screen photo viewer moment, not a scrim behind a card, and needs
  // real contrast for photos of every brightness. Scoped to this component
  // only, same reasoning as the Feed screen's one-off dark palette.
  lightboxOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(10, 10, 10, 0.97)",
    zIndex: 1000,
  },
  lightboxImage: {
    width: "100%",
    height: "100%",
  },
  lightboxClose: {
    position: "absolute",
    top: 48,
    right: spacing.lg,
    width: 38,
    height: 38,
    borderRadius: radii.full,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  lightboxCounter: {
    position: "absolute",
    bottom: 40,
    alignSelf: "center",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
  },
  lightboxCounterText: {
    color: "#FFFFFF",
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
});
