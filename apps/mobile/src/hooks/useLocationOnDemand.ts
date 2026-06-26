import * as Location from "expo-location";
import { useCallback, useState } from "react";

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
