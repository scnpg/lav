import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text } from "react-native";

import { colors, fontSize, fontWeight, radii, spacing } from "../theme";

interface ToastProps {
  message: string;
  visible: boolean;
}

// A small floating pill, not an inline form banner (see FormStatusBanner in
// components/bathroom/EditableFieldControls.tsx) - for feedback that should
// outlive the sheet/modal that triggered it (e.g. a report submitted just
// as its modal closes). Fades in/out with the native driver so it never
// stutters the surrounding UI.
export function Toast({ message, visible }: ToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [visible, opacity]);

  return (
    <Animated.View pointerEvents="none" style={[styles.container, { opacity }]}>
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing["3xl"],
    backgroundColor: colors.textPrimary,
    borderRadius: radii.full,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
  },
  text: {
    color: colors.background,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    textAlign: "center",
  },
});
