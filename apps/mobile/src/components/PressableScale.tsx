import type { ReactNode } from "react";
import { useRef } from "react";
import { Animated, Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from "react-native";

interface PressableScaleProps extends Omit<PressableProps, "style" | "children"> {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  /** Rounds the darken overlay to match the button's own borderRadius - the overlay can't just inherit it from `style`. */
  borderRadius?: number;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Drop-in Pressable replacement for premium-feeling primary buttons: on web
// hover, or while a finger holds it down on native, it scales up slightly
// and darkens via a black overlay - an overlay works regardless of the
// button's own fill color, so this doesn't need every call site to supply
// a specific "darker" shade to interpolate toward.
//
// Animated.createAnimatedComponent(Pressable) applies the scale directly to
// the same element `style` already targets, rather than introducing a
// wrapper View - important here because several buttons this wraps
// (map FAB, etc.) use position: "absolute" for their own placement, which a
// naive wrapper-div approach would break (the outer element wouldn't sizes/
// position itself around an absolutely-positioned child). No overflow:
// hidden on the pressable itself either - several of these buttons carry a
// shadow via cardShadow(), which overflow: hidden would clip; the overlay
// gets its own matching borderRadius instead; so its corners still look
// right without needing to clip the parent.
//
// Core RN Animated (useNativeDriver-compatible transform/opacity only),
// matching the rest of this project's animation choices - see
// RatingSlider.tsx's comment on why reanimated/gesture-handler stay unused
// despite being installed.
//
// Not retrofitted onto every Pressable in the app - applied to the highest-
// visibility primary actions (map FAB, modal submit buttons, auth buttons)
// as the strongest, most load-bearing first pass. Sweeping every button
// across every screen would be a much larger, separate mechanical pass.
export function PressableScale({
  children,
  style,
  scaleTo = 1.04,
  borderRadius = 0,
  onHoverIn,
  onHoverOut,
  onPressIn,
  onPressOut,
  ...rest
}: PressableScaleProps) {
  const progress = useRef(new Animated.Value(0)).current;

  function animate(toValue: number) {
    Animated.timing(progress, { toValue, duration: 150, useNativeDriver: true }).start();
  }

  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [1, scaleTo] });
  const darkenOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 0.16] });

  return (
    <AnimatedPressable
      style={[style, { transform: [{ scale }] }]}
      onHoverIn={(e) => {
        animate(1);
        onHoverIn?.(e);
      }}
      onHoverOut={(e) => {
        animate(0);
        onHoverOut?.(e);
      }}
      onPressIn={(e) => {
        animate(1);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        animate(0);
        onPressOut?.(e);
      }}
      {...rest}
    >
      {children}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.darkenOverlay, { opacity: darkenOpacity, borderRadius }]}
      />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  darkenOverlay: {
    backgroundColor: "#000000",
  },
});
