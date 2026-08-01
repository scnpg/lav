import { Image } from "react-native";

import { useTheme } from "../theme";

const LIGHT_TILE = require("../../assets/images/azulejo-tile-light.png");
const DARK_TILE = require("../../assets/images/azulejo-tile-dark.png");

interface LatticeProps {
  /** Explicit pixel size to tile across - required because RN's `resizeMode="repeat"` only tiles within a definite frame; given via `position:absolute, inset:0` alone (no width/height), react-native-web collapses the image to its own natural size instead of stretching-then-tiling. */
  width: number;
  height: number;
  opacity?: number;
}

// The real background watermark: the actual azulejo tile photo the user
// uploaded (Andalusian botanical-flower tilework), pre-processed once into
// two seamless, alpha-only PNGs tinted to each theme's own accent color
// (see scripts/process_tile.py in this session's scratchpad - not checked
// into the repo, a one-time asset-prep step) - NOT a live CSS blend-mode
// trick (the reference Figma prototype's `mix-blend-mode`/`filter:invert()`
// approach, which has no RN equivalent and is web-only). A plain low-opacity
// `Image` with `resizeMode="repeat"` tiles identically on web today and on
// native whenever that ships, no Platform branching needed - callers must
// measure their own bounds (onLayout) and pass them in, since this needs a
// definite frame to tile within.
export function Lattice({ width, height, opacity }: LatticeProps) {
  const { scheme } = useTheme();
  const resolvedOpacity = opacity ?? (scheme === "nocturne" ? 0.06 : 0.09);
  const source = scheme === "nocturne" ? DARK_TILE : LIGHT_TILE;
  if (width <= 0 || height <= 0) return null;
  return <Image source={source} resizeMode="repeat" style={{ width, height, opacity: resolvedOpacity }} />;
}
