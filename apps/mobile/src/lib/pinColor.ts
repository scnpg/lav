// Map-pin/score color system - ported verbatim from the real Figma Make
// source (App.tsx's `PIN`/`COLOR_STOPS`/`pinColorRgb`/`pinFill`/`pinRgba`).
// These are semantic score colors, not theme tokens - same values in Paper
// and Nocturne, since the reference defines them once outside T.light/T.dark.
// Every score display in the app (map pins/clusters, Feed review scores,
// leaderboard rows, the bathroom-detail rating header) shares this one
// color function so a 6.0 always reads as the same yellow-green everywhere.
export const PIN = {
  high: "#0F6E56",
  mid: "#1D9E75",
  low: "#5DCAA5",
  chipBg: "#085041",
  chipText: "#9FE1CB",
  friend: "#D4537E",
  unratedFill: "#FFFFFF",
  unratedBorder: "#B4B2A9",
  unratedText: "#5F5E5A",
} as const;

// 5-stop interpolation: 10 -> dark green, 7 -> mid green, 5 -> pastel
// yellow, 3 -> pastel orange, 0 -> red.
const COLOR_STOPS: [number, [number, number, number]][] = [
  [10, [15, 110, 86]],
  [7, [29, 158, 117]],
  [5, [242, 209, 102]],
  [3, [240, 154, 106]],
  [0, [212, 69, 69]],
];

export function pinColorRgb(score: number): [number, number, number] {
  const s = Math.max(0, Math.min(10, score));
  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    const [s1, c1] = COLOR_STOPS[i]!;
    const [s2, c2] = COLOR_STOPS[i + 1]!;
    if (s >= s2) {
      const t = (s1 - s) / (s1 - s2);
      return [
        Math.round(c1[0] + (c2[0] - c1[0]) * t),
        Math.round(c1[1] + (c2[1] - c1[1]) * t),
        Math.round(c1[2] + (c2[2] - c1[2]) * t),
      ];
    }
  }
  return COLOR_STOPS[COLOR_STOPS.length - 1]![1];
}

export function pinFill(score: number): string {
  const [r, g, b] = pinColorRgb(score);
  return `rgb(${r},${g},${b})`;
}

export function pinRgba(score: number, alpha: number): string {
  const [r, g, b] = pinColorRgb(score);
  return `rgba(${r},${g},${b},${alpha})`;
}
