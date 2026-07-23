import { StyleSheet, View } from "react-native";

import { colors, spacing } from "../theme";
import { ArabesqueDivider } from "./ArabesqueDivider";
import { ArabesqueLoader } from "./ArabesqueLoader";
import { ArabesquePattern } from "./ArabesquePattern";
import { LavLogo } from "./LavLogo";

// The branded loading moment - shown from app/_layout.tsx while the initial
// auth session check is in flight (AuthProvider's `loading`), replacing what
// used to be a blank flash before the first real screen mounts. A quiet
// tiled arabesque backdrop sits behind the logo/spinner - low-opacity,
// pointerEvents none, purely atmospheric, the same restraint as
// ArabesquePattern's own doc comment describes for auth screens.
export function LoadingScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.patternLayer}>
        <ArabesquePattern rows={10} columns={6} starSize={24} gap={18} opacity={0.05} />
      </View>
      <View style={styles.content}>
        <LavLogo size={36} />
        <View style={styles.divider}>
          <ArabesqueDivider count={10} />
        </View>
        <ArabesqueLoader size={40} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  patternLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    alignItems: "center",
    gap: spacing["2xl"],
  },
  divider: {
    width: 96,
  },
});
