import { env } from "./env";

// ---------------------------------------------------------------------------
// Map style configuration - THE place to change Lav's map provider.
//
// Lav intentionally avoids Google Maps and Mapbox (see README "Map setup").
// Set EXPO_PUBLIC_MAP_STYLE_URL in apps/mobile/.env to any MapLibre-compatible
// vector style JSON URL. Good options, roughly easiest-to-hardest:
//   - MapTiler (free tier, OSM-based):  https://api.maptiler.com/maps/streets-v2/style.json?key=YOUR_KEY
//   - Stadia Maps (free tier, OSM-based): https://tiles.stadiamaps.com/styles/alidade_smooth.json
//   - OpenFreeMap (no key required):    https://tiles.openfreemap.org/styles/liberty
//   - Self-hosted tileserver-gl + OSM data, for full control in production.
//
// DEV FALLBACK: if EXPO_PUBLIC_MAP_STYLE_URL is unset, we fall back to
// MapLibre's own public demo style. It's free and requires no signup, but is
// low-detail and not meant for production traffic - replace it before
// shipping. When using any third-party OSM-based tile host, also check their
// usage policy/attribution requirements (most require a visible
// "© OpenStreetMap contributors" credit, which MapView.web.tsx /
// MapView.native.tsx already render).
// ---------------------------------------------------------------------------
const DEV_FALLBACK_STYLE_URL = "https://demotiles.maplibre.org/style.json";

export const MAP_STYLE_URL = env.mapStyleUrl?.trim() || DEV_FALLBACK_STYLE_URL;

export const IS_USING_FALLBACK_MAP_STYLE = !env.mapStyleUrl?.trim();

// Default camera when we have no better location to center on (e.g. location
// permission denied / "Use my location" not yet tapped). Centered on
// Washington, DC to match the seed data - change freely.
export const DEFAULT_MAP_CENTER = { latitude: 38.9072, longitude: -77.0369 };
export const DEFAULT_MAP_ZOOM = 12;
