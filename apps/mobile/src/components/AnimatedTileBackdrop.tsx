import { useEffect, useRef, useState } from "react";
import { Animated, Easing, View } from "react-native";

import { useTheme } from "../theme";
import { Lattice } from "./Lattice";

interface AnimatedTileBackdropProps {
  opacity?: number;
}

const SCROLL_DISTANCE = 140; // matches Lattice's underlying tile asset size, so the loop's reset-to-zero is an invisible jump

// The real azulejo-tile watermark (see Lattice.tsx), animated so it
// continuously scrolls diagonally (top-left toward bottom-right) - rendered
// oversized and translated by exactly one tile period so the loop's instant
// reset-to-zero is invisible (the pattern repeats exactly every
// SCROLL_DISTANCE px). ArabesquePattern.tsx exports a non-animated version
// of the same Lattice for any one-off static use.
export function AnimatedTileBackdrop({ opacity }: AnimatedTileBackdropProps) {
  const { scheme } = useTheme();
  const resolvedOpacity = opacity ?? (scheme === "nocturne" ? 0.06 : 0.09);

  const translate = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const [area, setArea] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const scroll = Animated.loop(
      Animated.timing(translate, {
        toValue: { x: -SCROLL_DISTANCE, y: -SCROLL_DISTANCE },
        duration: 40000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    scroll.start();
    return () => scroll.stop();
  }, [translate]);

  return (
    <View
      style={{ alignSelf: "stretch", flex: 1, overflow: "hidden" }}
      pointerEvents="none"
      onLayout={(e) => setArea({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
    >
      {area.width > 0 ? (
        <Animated.View
          style={{
            position: "absolute",
            top: -SCROLL_DISTANCE,
            left: -SCROLL_DISTANCE,
            transform: translate.getTranslateTransform(),
          }}
        >
          <Lattice width={area.width + SCROLL_DISTANCE * 2} height={area.height + SCROLL_DISTANCE * 2} opacity={resolvedOpacity} />
        </Animated.View>
      ) : null}
    </View>
  );
}
