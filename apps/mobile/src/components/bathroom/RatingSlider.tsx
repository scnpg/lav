import { useMemo, useRef, useState } from "react";
import { PanResponder, StyleSheet, Text, View } from "react-native";

import { colors, fontSize, fontWeight, radii, spacing } from "../../theme";

interface RatingSliderProps {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

const THUMB_SIZE = 28;
const TRACK_HEIGHT = 6;

// Core RN PanResponder + plain Views, not react-native-reanimated /
// react-native-gesture-handler - both are in package.json but nothing in
// this codebase has ever actually exercised them (no shared values, no
// worklets, no GestureDetector), so their babel-plugin wiring is unproven
// here. A drag-to-set-value control doesn't need UI-thread animation
// performance, so there's no upside worth that risk - PanResponder is the
// same battle-tested cross-platform gesture system Toast.tsx's Animated
// already relies on.
export function RatingSlider({ value, onValueChange, min = 0, max = 10, step = 0.5 }: RatingSliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const trackWidthRef = useRef(0);
  const trackXRef = useRef(0);

  function clampToStep(raw: number): number {
    const stepped = Math.round(raw / step) * step;
    return Math.min(max, Math.max(min, Number(stepped.toFixed(2))));
  }

  function valueFromLocationX(locationX: number): number {
    const width = trackWidthRef.current;
    if (width <= 0) return value;
    const ratio = Math.min(1, Math.max(0, locationX / width));
    return clampToStep(min + ratio * (max - min));
  }

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          onValueChange(valueFromLocationX(e.nativeEvent.locationX));
        },
        onPanResponderMove: (e) => {
          // pageX minus the track's measured page offset, not locationX -
          // locationX is relative to whichever child view the finger is
          // currently over (the thumb vs. the track itself), so it jumps
          // discontinuously as the thumb moves under the finger mid-drag.
          const x = e.nativeEvent.pageX - trackXRef.current;
          onValueChange(valueFromLocationX(x));
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [min, max, step]
  );

  const percent = ((value - min) / (max - min)) * 100;

  return (
    <View style={styles.container}>
      <View style={styles.valueRow}>
        <Text style={styles.valueText}>{value.toFixed(1)}</Text>
        <Text style={styles.valueScale}>/ {max.toFixed(1)}</Text>
      </View>
      <View
        style={styles.track}
        onLayout={(e) => {
          trackWidthRef.current = e.nativeEvent.layout.width;
          setTrackWidth(e.nativeEvent.layout.width);
        }}
        ref={(node) => {
          if (node) {
            // onLayout never actually fires for this View on web (confirmed
            // empirically - trackWidthRef/trackWidth stayed 0 indefinitely,
            // so the thumb never rendered and every tap/drag silently
            // no-opped back to the current value). measure() is the
            // reliable source for both width and page-relative x (the
            // latter needed to convert pageX -> track-relative x during
            // onPanResponderMove below) - use it for both instead of
            // depending on onLayout at all.
            node.measure((_x, _y, w, _h, pageX) => {
              trackWidthRef.current = w;
              setTrackWidth(w);
              trackXRef.current = pageX;
            });
          }
        }}
        {...panResponder.panHandlers}
      >
        <View style={styles.trackFill} />
        <View style={[styles.fill, { width: `${percent}%` }]} />
        {trackWidth > 0 ? (
          <View
            style={[
              styles.thumb,
              { left: Math.max(0, (percent / 100) * trackWidth - THUMB_SIZE / 2) },
            ]}
          />
        ) : null}
      </View>
      <View style={styles.scaleLabels}>
        <Text style={styles.scaleLabelText}>{min.toFixed(0)}</Text>
        <Text style={styles.scaleLabelText}>{max.toFixed(0)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    gap: spacing.xs,
  },
  valueText: {
    fontSize: fontSize["2xl"],
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  valueScale: {
    fontSize: fontSize.base,
    color: colors.textMuted,
  },
  track: {
    height: THUMB_SIZE,
    justifyContent: "center",
  },
  trackFill: {
    position: "absolute",
    left: 0,
    right: 0,
    height: TRACK_HEIGHT,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceMuted,
  },
  fill: {
    position: "absolute",
    left: 0,
    height: TRACK_HEIGHT,
    borderRadius: radii.full,
    backgroundColor: colors.accent,
  },
  thumb: {
    position: "absolute",
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.accentStrong,
  },
  scaleLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  scaleLabelText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
});
