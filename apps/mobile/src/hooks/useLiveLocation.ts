import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";

export type LiveLocationStatus = "idle" | "requesting" | "granted" | "denied" | "error";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Map screen (Phase 2): requests foreground location permission as soon as
 * this mounts, then keeps a live-updating position via watchPositionAsync
 * for as long as the screen is mounted, torn down on unmount. This is
 * intentionally different from useLocationOnDemand (kept as-is for the
 * submit flow's one-shot, tap-triggered "use my current location" read) -
 * the two hooks cover different product moments, not a redundant pair.
 *
 * Same privacy invariant as useLocationOnDemand still holds: foreground-only
 * (no background permission requested), and coordinates live only in this
 * hook's React state - nothing here writes to storage or the database. See
 * README "Security/privacy notes".
 */
export function useLiveLocation() {
  const [status, setStatus] = useState<LiveLocationStatus>("idle");
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    let mounted = true;
    setStatus("requesting");

    (async () => {
      const { status: permStatus } = await Location.requestForegroundPermissionsAsync();
      if (!mounted) return;
      if (permStatus !== "granted") {
        setStatus("denied");
        return;
      }
      try {
        const subscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, timeInterval: 4000, distanceInterval: 10 },
          (position) => {
            if (!mounted) return;
            setCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude });
            setStatus("granted");
          }
        );
        if (!mounted) {
          subscription.remove();
          return;
        }
        subscriptionRef.current = subscription;
      } catch {
        if (mounted) setStatus("error");
      }
    })();

    return () => {
      mounted = false;
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
    };
  }, []);

  return { status, coords };
}
