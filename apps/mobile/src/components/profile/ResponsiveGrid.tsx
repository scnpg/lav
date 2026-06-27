import { Children, type ReactNode, useCallback, useState } from "react";
import { type LayoutChangeEvent, View } from "react-native";

interface ResponsiveGridProps {
  children: ReactNode;
  gap?: number;
  minColumnWidth?: number;
  maxColumns?: number;
}

// Measures its own rendered width (which already reflects the profile
// page's max-width container and padding - see app/(tabs)/profile.tsx) and
// lays children out in as many minColumnWidth-ish columns as fit, capped at
// maxColumns. Same idea as CSS Grid's `repeat(auto-fill, minmax(...))`,
// done in JS since plain RN StyleSheet has no media queries. This is what
// keeps badge/founder cards from stretching into wide, sparse rectangles
// on web - on a narrow phone it collapses to one column, on a wide desktop
// it caps out at maxColumns instead of growing forever.
export function ResponsiveGrid({ children, gap = 12, minColumnWidth = 230, maxColumns = 4 }: ResponsiveGridProps) {
  const [width, setWidth] = useState(0);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  }, []);

  const columns =
    width > 0 ? Math.max(1, Math.min(maxColumns, Math.floor((width + gap) / (minColumnWidth + gap)))) : 1;
  const itemWidth = width > 0 ? (width - gap * (columns - 1)) / columns : undefined;

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap }} onLayout={onLayout}>
      {Children.map(children, (child) => (
        <View style={itemWidth ? { width: itemWidth } : { width: "100%" }}>{child}</View>
      ))}
    </View>
  );
}
