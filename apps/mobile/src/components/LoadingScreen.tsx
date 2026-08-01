import { View } from "react-native";

import { spacing, useThemedStyles } from "../theme";
import { AnimatedTileBackdrop } from "./AnimatedTileBackdrop";
import { ArabesqueDivider } from "./ArabesqueDivider";
import { ArabesqueLoader } from "./ArabesqueLoader";
import { LavLogo } from "./LavLogo";

// The branded loading moment - shown from app/_layout.tsx while the initial
// auth session check is in flight (AuthProvider's `loading`), replacing what
// used to be a blank flash before the first real screen mounts. The
// animated tile backdrop sits behind the logo/spinner - low-opacity,
// pointerEvents none, purely atmospheric, the same restraint
// ArabesquePattern's own doc comment describes for auth screens.
export function LoadingScreen() {
  const styles = useThemedStyles((c) => ({
    container: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.background,
    },
    patternLayer: {
      position: "absolute" as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    content: {
      alignItems: "center" as const,
      gap: spacing["2xl"],
    },
    divider: {
      width: 96,
    },
  }));

  return (
    <View style={styles.container}>
      <View style={styles.patternLayer}>
        <AnimatedTileBackdrop opacity={0.05} />
      </View>
      <View style={styles.content}>
        <LavLogo size={36} />
        <View style={styles.divider}>
          <ArabesqueDivider count={10} />
        </View>
        <ArabesqueLoader size={40} framed />
      </View>
    </View>
  );
}
