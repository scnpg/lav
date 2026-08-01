import Svg, { Circle, Line, Rect } from "react-native-svg";

import { useTheme } from "../theme";

interface FlowerMarkProps {
  size?: number;
  color?: string;
  /** Solid-fill petals/center vs. stroke-only outline (matches the reference's `filled` prop). */
  filled?: boolean;
  /** Stroke width at the reference's 20x20 viewBox scale. */
  sw?: number;
  /** Petal count - the traced motif is 8-fold symmetric by default; 4 produces the same formula every other position, used by ArabesqueLoader's shapeshift. */
  petals?: number;
}

// Faithful port of the azulejo tile's traced flower motif (see the real
// Figma Make source's `FlowerMark`, extracted from the reference tile photo
// the user uploaded - a Andalusian tile with 8-petal rosettes) - NOT the
// invented lens-shaped FloralBloom this app used before that discovery. 8
// circles at radius `pd` from center, each `pr` in size, plus a square
// center with an inner cross grid. Uses react-native-svg (an installed but
// previously-unused dependency) for exact circle/line geometry rather than
// approximating with rotated Views.
export function FlowerMark({ size = 20, color, filled = false, sw = 1, petals = 8 }: FlowerMarkProps) {
  const { colors } = useTheme();
  const resolvedColor = color ?? colors.accent;
  const cx = 10;
  const cy = 10;
  const pd = 5.15; // petal center distance from origin
  const pr = 2.15; // petal radius

  const points = Array.from({ length: petals }, (_, k) => {
    const angle = (k * (360 / petals) * Math.PI) / 180;
    return {
      x: +(cx + pd * Math.sin(angle)).toFixed(3),
      y: +(cy - pd * Math.cos(angle)).toFixed(3),
    };
  });

  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      {points.map((p, i) => (
        <Circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={pr}
          fill={filled ? resolvedColor : "none"}
          stroke={resolvedColor}
          strokeWidth={sw}
        />
      ))}
      <Rect x="7" y="7" width="6" height="6" fill={filled ? resolvedColor : "none"} stroke={resolvedColor} strokeWidth={sw} />
      <Line x1="7" y1="10" x2="13" y2="10" stroke={resolvedColor} strokeWidth={sw * 0.6} />
      <Line x1="10" y1="7" x2="10" y2="13" stroke={resolvedColor} strokeWidth={sw * 0.6} />
    </Svg>
  );
}
