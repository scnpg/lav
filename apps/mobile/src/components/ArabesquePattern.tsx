import { StyleSheet, View } from "react-native";

import { colors } from "../theme";

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
export function EightPointedStar({ size, color = colors.accent, strokeWidth = 1.5 }: EightPointedStarProps) {
  const squareStyle = {
    width: size,
    height: size,
    borderWidth: strokeWidth,
    borderColor: color,
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
  /** Petal count - only even numbers make sense (each lens contributes an opposite pair). Defaults to a 6-petal rosette, the classic Andalusian/Persian tile flower - deliberately distinct from EightPointedStar's sharp 8 points. */
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
// full flower silhouette - three lenses at 0/60/120deg for six petals, the
// same "few overlapping rotated shapes sharing one center" idea as the star,
// just curved instead of pointed. This is what makes the motif read as
// "floral" arabesque rather than purely geometric star-and-polygon.
export function FloralBloom({ size, color = colors.accent, petals = 6, strokeWidth = 1.5, filled = false, centerDot = false }: FloralBloomProps) {
  const lensCount = Math.max(2, Math.round(petals / 2));
  const lensSize = size * 0.62;
  const angleStep = 180 / lensCount;
  const lensStyle = {
    width: lensSize,
    height: lensSize,
    borderTopRightRadius: lensSize / 2,
    borderBottomLeftRadius: lensSize / 2,
    ...(filled
      ? { backgroundColor: color }
      : { borderWidth: strokeWidth, borderColor: color, backgroundColor: "transparent" as const }),
  };
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      {Array.from({ length: lensCount }).map((_, i) => (
        <View key={i} style={[styles.lens, lensStyle, { transform: [{ rotate: `${angleStep * i}deg` }] }]} />
      ))}
      {centerDot ? (
        <View style={[styles.centerDot, { width: size * 0.14, height: size * 0.14, borderRadius: size * 0.07, backgroundColor: color }]} />
      ) : null}
    </View>
  );
}

interface ArabesquePatternProps {
  starSize?: number;
  gap?: number;
  rows?: number;
  columns?: number;
  color?: string;
  opacity?: number;
  /** "star" (original rub el hizb only), "floral" (bloom only), or "mixed" (alternates per cell, checkerboard-style - the richer default). */
  motif?: "star" | "floral" | "mixed";
}

// A subtle tiled backdrop - decorative texture for quiet moments (auth
// screens, empty states), not something to drop behind dense content.
// Deliberately low default opacity - a watermark, not a busy pattern,
// matching "not too corporate but not gaudy either". `motif="mixed"`
// alternates star/floral per cell so the backdrop reads as a real tessellated
// tile pattern (star AND flower, the way actual Andalusian zellige tilework
// combines both in one wall) rather than one shape repeated flatly.
export function ArabesquePattern({
  starSize = 28,
  gap = 20,
  rows = 6,
  columns = 6,
  color = colors.accent,
  opacity = 0.08,
  motif = "mixed",
}: ArabesquePatternProps) {
  const cell = starSize + gap;
  return (
    <View style={{ opacity, gap }} pointerEvents="none">
      {Array.from({ length: rows }).map((_, row) => (
        <View key={row} style={{ flexDirection: "row", gap }}>
          {Array.from({ length: columns }).map((_, col) => {
            const useFloral = motif === "floral" || (motif === "mixed" && (row + col) % 2 === 1);
            return (
              <View key={col} style={{ width: cell, height: cell, alignItems: "center", justifyContent: "center" }}>
                {useFloral ? (
                  <FloralBloom size={starSize} color={color} />
                ) : (
                  <EightPointedStar size={starSize} color={color} />
                )}
              </View>
            );
          })}
        </View>
      ))}
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
