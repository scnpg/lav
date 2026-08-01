import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { useTheme } from "../theme";
import { Lattice } from "./Lattice";

interface EightPointedStarProps {
  size: number;
  color?: string;
  strokeWidth?: number;
}

// The classic Islamic/Roman-tile geometric star ("rub el hizb") - two
// squares of the same size, one rotated 45 deg over the other, both
// outline-only (transparent fill). No SVG dependency in this project (see
// package.json) - the same "shape from plain rotated Views" trick already
// used for the map-pin crosshair (PinPickerMap.web/native.tsx) and the map
// pin teardrop shape, just two squares instead of one.
//
// `color` defaults to the LIVE theme accent (useTheme(), not a static
// import) - dozens of call sites across the app never pass an explicit
// color, so this default is what makes them track the active Paper/Nocturne
// palette instead of staying visually pinned to whichever palette was
// static-imported when this file first loaded.
export function EightPointedStar({ size, color, strokeWidth = 1.5 }: EightPointedStarProps) {
  const { colors } = useTheme();
  const resolvedColor = color ?? colors.accent;
  const squareStyle = {
    width: size,
    height: size,
    borderWidth: strokeWidth,
    borderColor: resolvedColor,
  };
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <View style={[styles.square, squareStyle]} />
      <View style={[styles.square, styles.squareRotated, squareStyle]} />
    </View>
  );
}

interface FloralBloomProps {
  size: number;
  color?: string;
  /** Petal count - only even numbers make sense (each lens contributes an opposite pair). Defaults to an 8-petal rosette, matching EightPointedStar's 8-fold symmetry (the standard Andalusian/Moorish pairing). Previously defaulted to 6, which read as a hexagram (Star of David) rather than a flower once stroked - not the intended motif here. */
  petals?: number;
  strokeWidth?: number;
  /** Solid fill (small tile-icon use) vs outline-only (larger watermark/loader use, matches EightPointedStar's treatment). */
  filled?: boolean;
  /** Adds a small solid center dot, the way a real tile rosette has a carved center - skip for tightly packed/tiny renders where it'd just look like a smudge. */
  centerDot?: boolean;
}

// A curved counterpart to EightPointedStar: instead of sharp square corners,
// each "petal" is a lens shape (two corners rounded to 50%, the opposite two
// left at 0 - the standard CSS/RN "leaf" trick), which is 2-fold symmetric,
// so `petals / 2` of them rotated evenly around a shared center produce a
// full flower silhouette - four lenses at 0/45/90/135deg for eight petals,
// the same "few overlapping rotated shapes sharing one center" idea as the
// star, just curved instead of pointed. This is what makes the motif read as
// "floral" arabesque rather than purely geometric star-and-polygon. (Three
// lenses at 60deg increments - six petals - was the original default, but at
// stroke-outline weight the sharp uncurved corners lined up into a hexagram
// silhouette, reading as a Star of David rather than a flower. Four lenses
// at 45deg increments avoids that 6-fold coincidence entirely.)
export function FloralBloom({ size, color, petals = 8, strokeWidth = 1.5, filled = false, centerDot = false }: FloralBloomProps) {
  const { colors } = useTheme();
  const resolvedColor = color ?? colors.accent;
  const lensCount = Math.max(2, Math.round(petals / 2));
  const lensSize = size * 0.62;
  const angleStep = 180 / lensCount;
  const lensStyle = {
    width: lensSize,
    height: lensSize,
    borderTopRightRadius: lensSize / 2,
    borderBottomLeftRadius: lensSize / 2,
    ...(filled
      ? { backgroundColor: resolvedColor }
      : { borderWidth: strokeWidth, borderColor: resolvedColor, backgroundColor: "transparent" as const }),
  };
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      {Array.from({ length: lensCount }).map((_, i) => (
        <View key={i} style={[styles.lens, lensStyle, { transform: [{ rotate: `${angleStep * i}deg` }] }]} />
      ))}
      {centerDot ? (
        <View style={[styles.centerDot, { width: size * 0.14, height: size * 0.14, borderRadius: size * 0.07, backgroundColor: resolvedColor }]} />
      ) : null}
    </View>
  );
}

interface TileFrameProps {
  size: number;
  color?: string;
  backgroundColor?: string;
  children: React.ReactNode;
}

// A fitted square border around whatever's passed as children - turns a
// bare motif (a flower, a loading spinner) into something that reads as a
// single ceramic bathroom tile, rather than a shape floating with nothing
// around it. Shared by LavLogo (the static logo mark) and ArabesqueLoader's
// `framed` variant, so "what a tile frame looks like" is defined exactly
// once. Corner radius is proportional to size (not a fixed `radii` token) so
// it reads as "squared tile" rather than "rounded blob" across the range of
// sizes this actually gets used at (18-48px).
export function TileFrame({ size, color, backgroundColor, children }: TileFrameProps) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.15,
        borderWidth: Math.max(1.5, size / 16),
        borderColor: color ?? colors.accentStrong,
        backgroundColor: backgroundColor ?? colors.surface,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </View>
  );
}

interface ArabesquePatternProps {
  opacity?: number;
}

// A subtle tiled backdrop - decorative texture for quiet moments (auth
// screens, empty states), not something to drop behind dense content. Now a
// thin non-animated wrapper around the real azulejo-tile Lattice (see
// Lattice.tsx) - the actual reference tile photo, not an invented shape
// grid - for the handful of static (non-scrolling) call sites; see
// AnimatedTileBackdrop.tsx for the animated version used everywhere else.
export function ArabesquePattern({ opacity }: ArabesquePatternProps) {
  const [area, setArea] = useState({ width: 0, height: 0 });
  return (
    <View
      style={{ alignSelf: "stretch", flex: 1 }}
      pointerEvents="none"
      onLayout={(e) => setArea({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
    >
      <Lattice width={area.width} height={area.height} opacity={opacity} />
    </View>
  );
}

const styles = StyleSheet.create({
  square: {
    position: "absolute",
    backgroundColor: "transparent",
  },
  squareRotated: {
    transform: [{ rotate: "45deg" }],
  },
  lens: {
    position: "absolute",
    borderTopLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  centerDot: {
    position: "absolute",
  },
});
