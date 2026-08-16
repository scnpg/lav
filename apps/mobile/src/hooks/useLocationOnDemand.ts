import * as Location from "expo-location";
import { useCallback, useState } from "react";
import { Platform } from "react-native";

import { getCurrentPositionWeb } from "../lib/webGeolocation";

export type LocationRequestStatus = "idle" | "requesting" | "granted" | "denied" | "error";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Location is requested ONLY when requestLocation() is called (i.e. the user
 * tapped "Use my location") - never on mount, never in the background. The
 * resulting coordinates live only in this hook's React state: nothing here
 * writes them to storage or to the database. See README "Security/privacy
 * notes" - Lav never stores or displays a user's live location.
 */
export function useLocationOnDemand() {
  const [status, setStatus] = useState<LocationRequestStatus>("idle");
  const [coords, setCoords] = useState<Coordinates | null>(null);

  const requestLocation = useCallback(async (): Promise<Coordinates | null> => {
    setStatus("requesting");

    // Web: talk to navigator.geolocation directly - see webGeolocation.ts
    // for why expo-location's web permission-check layer is unreliable on
    // iOS Safari (requestForegroundPermissionsAsync throws there instead of
    // resolving denied/granted).
    if (Platform.OS === "web") {
      const result = await getCurrentPositionWeb();
      if ("outcome" in result) {
        setStatus(result.outcome);
        return null;
      }
      setCoords(result);
      setStatus("granted");
      return result;
    }

    try {
      const { status: permStatus } = await Location.requestForegroundPermissionsAsync();
      if (permStatus !== "granted") {
        setStatus("denied");
        return null;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const point: Coordinates = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      setCoords(point);
      setStatus("granted");
      return point;
    } catch {
      setStatus("error");
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setCoords(null);
  }, []);

  return { status, coords, requestLocation, reset };
}
