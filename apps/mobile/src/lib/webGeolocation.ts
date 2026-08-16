// Direct navigator.geolocation wrapper for web only - bypasses expo-location's
// web permission layer entirely.
//
// expo-location's web shim (ExpoLocation.web.js) checks/requests permission
// via navigator.permissions.query({name: "geolocation"}), throwing an
// UnavailabilityError immediately if navigator.permissions.query doesn't
// exist at all. On iOS Safari that query is unreliable across versions -
// confirmed the throw happens outside useLiveLocation.ts's try/catch, so the
// whole hook got stuck at status "requesting" forever with no visible
// failure ("location services do not work" on iPhone). Separately,
// expo-location's own watchPositionAsync web implementation passes
// `undefined` as the error callback to navigator.geolocation.watchPosition,
// so even bypassing the permission check, a denied/failed watch would also
// hang silently rather than ever reporting "denied".
//
// The browser's native getCurrentPosition/watchPosition already handle the
// permission prompt themselves and report denial via a real error callback -
// no separate permission-check step is needed on web at all. This module
// talks to them directly so both problems above are avoided; native
// (iOS/Android app) builds keep using expo-location as before, since neither
// bug applies there.
export type WebGeoOutcome = "denied" | "error";

export interface WebGeoCoords {
  latitude: number;
  longitude: number;
}

export function isWebGeolocationAvailable(): boolean {
  return typeof navigator !== "undefined" && "geolocation" in navigator;
}

function outcomeForError(err: GeolocationPositionError): WebGeoOutcome {
  return err.code === err.PERMISSION_DENIED ? "denied" : "error";
}

export function getCurrentPositionWeb(): Promise<WebGeoCoords | { outcome: WebGeoOutcome }> {
  return new Promise((resolve) => {
    if (!isWebGeolocationAvailable()) {
      resolve({ outcome: "error" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      (err) => resolve({ outcome: outcomeForError(err) }),
      { enableHighAccuracy: false, maximumAge: 60000, timeout: 15000 }
    );
  });
}

/** Returns the watch id (for clearWatchPositionWeb), or null if geolocation isn't available at all (onOutcome already called with "error" in that case). */
export function watchPositionWeb(
  onPosition: (coords: WebGeoCoords) => void,
  onOutcome: (outcome: WebGeoOutcome) => void
): number | null {
  if (!isWebGeolocationAvailable()) {
    onOutcome("error");
    return null;
  }
  return navigator.geolocation.watchPosition(
    (position) => onPosition({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
    (err) => onOutcome(outcomeForError(err)),
    { enableHighAccuracy: false, maximumAge: 10000, timeout: 20000 }
  );
}

export function clearWatchPositionWeb(watchId: number): void {
  if (isWebGeolocationAvailable()) navigator.geolocation.clearWatch(watchId);
}
