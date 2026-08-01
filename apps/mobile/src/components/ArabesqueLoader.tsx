import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

import { useTheme } from "../theme";
import { FlowerMark } from "./FlowerMark";
import { TileFrame } from "./ArabesquePattern";

interface ArabesqueLoaderProps {
  size?: number;
  color?: string;
  /** Wraps the shapeshifting shapes in a square tile frame (TileFrame) - use for standalone/full-screen loading moments; leave off for small inline spinners embedded in buttons/rows, where a bordered tile would clash with the surrounding chrome. */
  framed?: boolean;
}

// The loading indicator: cycles through three looks built from the SAME
// traced flower motif (FlowerMark - see FlowerMark.tsx, ported from the real
// azulejo-tile reference, not the invented star/lens shapes an earlier pass
// used) - an 8-petal outline, a 4-petal outline, and a filled 8-petal - each
// rotating at its own speed/direction so none of them ever lock into a
// repeating unison, with a triangular opacity crossfade driven by a single
// looping `phase` value so exactly one shape reads as dominant at a time
// while the others recede rather than vanish outright. Everything also
// breathes in scale together. Core RN Animated (Toast.tsx's already-proven
// pattern in this codebase), not reanimated - see RatingSlider.tsx for why
// reanimated/gesture-handler stay unused here.
//
// `color` defaults to the live theme accent (useTheme()), same reasoning as
// FlowerMark - most call sites never pass one explicitly.
export function ArabesqueLoader({ size = 48, color, framed = false }: ArabesqueLoaderProps) {
  const { colors } = useTheme();
  const resolvedColor = color ?? colors.accent;

  const rotate8Outline = useRef(new Animated.Value(0)).current;
  const rotate4Outline = useRef(new Animated.Value(0)).current;
  const rotate8Filled = useRef(new Animated.Value(0)).current;
  const phase = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const spin8Outline = Animated.loop(
      Animated.timing(rotate8Outline, { toValue: 1, duration: 7000, easing: Easing.linear, useNativeDriver: true })
    );
    const spin4Outline = Animated.loop(
      Animated.timing(rotate4Outline, { toValue: 1, duration: 5500, easing: Easing.linear, useNativeDriver: true })
    );
    const spin8Filled = Animated.loop(
      Animated.timing(rotate8Filled, { toValue: 1, duration: 4000, easing: Easing.linear, useNativeDriver: true })
    );
    // One full 8-outline -> 4-outline -> 8-filled -> 8-outline cycle, 2200ms
    // per phase (matching the original two-shape crossfade's timing).
    const cycle = Animated.loop(
      Animated.timing(phase, { toValue: 3, duration: 6600, easing: Easing.linear, useNativeDriver: true })
    );
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.15, duration: 1000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    spin8Outline.start();
    spin4Outline.start();
    spin8Filled.start();
    cycle.start();
    breathe.start();
    return () => {
      spin8Outline.stop();
      spin4Outline.stop();
      spin8Filled.stop();
      cycle.stop();
      breathe.stop();
    };
  }, [rotate8Outline, rotate4Outline, rotate8Filled, phase, scale]);

  const spin8OutlineInterpolate = rotate8Outline.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const spin4OutlineInterpolate = rotate4Outline.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "-360deg"] });
  const spin8FilledInterpolate = rotate8Filled.interpolate({ inputRange: [0, 1], outputRange: ["360deg", "0deg"] });

  // Triangular crossfade: each shape peaks at its own phase and recedes
  // (never to zero, so the loop never reads as a hard cut) at the others'.
  const outline8Opacity = phase.interpolate({ inputRange: [0, 1, 2, 3], outputRange: [1, 0.15, 0.15, 1] });
  const outline4Opacity = phase.interpolate({ inputRange: [0, 1, 2, 3], outputRange: [0.15, 1, 0.15, 0.15] });
  const filled8Opacity = phase.interpolate({ inputRange: [0, 1, 2, 3], outputRange: [0.15, 0.15, 1, 0.15] });

  const shapes = (
    <View style={[styles.container, { width: size, height: size }]}>
      <Animated.View style={[styles.layer, { opacity: outline8Opacity, transform: [{ rotate: spin8OutlineInterpolate }, { scale }] }]}>
        <FlowerMark size={size} color={resolvedColor} sw={Math.max(1, size / 24)} petals={8} />
      </Animated.View>
      <Animated.View style={[styles.layer, { opacity: outline4Opacity, transform: [{ rotate: spin4OutlineInterpolate }, { scale }] }]}>
        <FlowerMark size={size} color={resolvedColor} sw={Math.max(1, size / 24)} petals={4} />
      </Animated.View>
      <Animated.View style={[styles.layer, { opacity: filled8Opacity, transform: [{ rotate: spin8FilledInterpolate }, { scale }] }]}>
        <FlowerMark size={size} color={resolvedColor} filled petals={8} />
      </Animated.View>
    </View>
  );

  if (!framed) return shapes;

  return <TileFrame size={size * 1.7}>{shapes}</TileFrame>;
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  layer: {
    position: "absolute",
  },
});
