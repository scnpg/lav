import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

import { colors } from "../theme";
import { FloralBloom } from "./ArabesquePattern";

interface ArabesqueLoaderProps {
  size?: number;
  color?: string;
}

// The loading spinner: an eight-pointed star (two rotating square outlines)
// layered with a six-petal floral bloom underneath, each rotating at a
// different speed/direction so the two never lock into a repeating unison,
// and a shared opacity crossfade so the silhouette actually *switches*
// between "mostly star" and "mostly floral" as it loops - not just one
// shape spinning, or two shapes permanently superimposed. Everything also
// breathes in scale together. Core RN Animated (Toast.tsx's already-proven
// pattern in this codebase), not reanimated - see RatingSlider.tsx for why
// reanimated/gesture-handler stay unused here.
export function ArabesqueLoader({ size = 48, color = colors.accent }: ArabesqueLoaderProps) {
  const rotateA = useRef(new Animated.Value(0)).current;
  const rotateB = useRef(new Animated.Value(0)).current;
  const rotateFloral = useRef(new Animated.Value(0)).current;
  const blend = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const spinA = Animated.loop(
      Animated.timing(rotateA, { toValue: 1, duration: 4000, easing: Easing.linear, useNativeDriver: true })
    );
    const spinB = Animated.loop(
      Animated.timing(rotateB, { toValue: 1, duration: 4000, easing: Easing.linear, useNativeDriver: true })
    );
    const spinFloral = Animated.loop(
      Animated.timing(rotateFloral, { toValue: 1, duration: 7000, easing: Easing.linear, useNativeDriver: true })
    );
    const crossfade = Animated.loop(
      Animated.sequence([
        Animated.timing(blend, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(blend, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.15, duration: 1000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    spinA.start();
    spinB.start();
    spinFloral.start();
    crossfade.start();
    breathe.start();
    return () => {
      spinA.stop();
      spinB.stop();
      spinFloral.stop();
      crossfade.stop();
      breathe.stop();
    };
  }, [rotateA, rotateB, rotateFloral, blend, scale]);

  const spinAInterpolate = rotateA.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "90deg"] });
  const spinBInterpolate = rotateB.interpolate({ inputRange: [0, 1], outputRange: ["45deg", "-45deg"] });
  const spinFloralInterpolate = rotateFloral.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "-360deg"] });
  const starOpacity = blend.interpolate({ inputRange: [0, 1], outputRange: [1, 0.25] });
  const bloomOpacity = blend.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] });

  const squareStyle = {
    width: size,
    height: size,
    borderWidth: Math.max(1.5, size / 20),
    borderColor: color,
  };

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Animated.View
        style={[styles.floralWrapper, { opacity: bloomOpacity, transform: [{ rotate: spinFloralInterpolate }, { scale }] }]}
      >
        <FloralBloom size={size * 1.08} color={color} strokeWidth={Math.max(1.5, size / 24)} />
      </Animated.View>
      <Animated.View
        style={[
          styles.square,
          squareStyle,
          { opacity: starOpacity, transform: [{ rotate: spinAInterpolate }, { scale }] },
        ]}
      />
      <Animated.View
        style={[
          styles.square,
          squareStyle,
          { opacity: starOpacity, transform: [{ rotate: spinBInterpolate }, { scale }] },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  square: {
    position: "absolute",
    backgroundColor: "transparent",
  },
  floralWrapper: {
    position: "absolute",
  },
});
