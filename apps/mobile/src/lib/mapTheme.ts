import type { MapLibreMap } from "maplibre-gl";

// ---------------------------------------------------------------------------
// Re-theme of OpenFreeMap's "Liberty" vector style
// (https://tiles.openfreemap.org/styles/liberty, OpenMapTiles schema - see
// src/lib/mapStyle.ts) to match src/theme/tokens.ts. We don't control that
// style - it's loaded by URL, not vendored into this repo - so this runs
// once the map has finished loading it, and recolors known layers in place
// via setPaintProperty/setLayoutProperty. Named generically (not after a
// specific palette) so it doesn't go stale the next time the palette does -
// see git history for this file's own comment under the old "oasis" tokens
// if you need the previous color set.
//
// Every call goes through setPaint/setLayout below, which checks the layer
// exists and swallows any error: if OpenFreeMap ever renames/restructures a
// layer upstream, that one override is silently skipped instead of throwing
// and breaking the whole map. The layer ids/colors referenced here were
// read directly off the live style (`curl https://tiles.openfreemap.org/
// styles/liberty`) while writing this - re-check there if this ever stops
// visibly applying.
//
// Two palettes now (Paper/light, Nocturne/dark) - `applyLavMapTheme` takes
// the active scheme and re-runs on every toggle (see call sites), not just
// once on initial map load, so switching theme mid-session repaints an
// already-loaded map instead of waiting for the next screen mount.
// ---------------------------------------------------------------------------

function setPaint(map: MapLibreMap, layerId: string, prop: string, value: unknown) {
  if (!map.getLayer(layerId)) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- paint property value shapes vary per layer type, this is a deliberately loose recoloring helper
    map.setPaintProperty(layerId, prop as any, value as any);
  } catch {
    // Upstream style shape changed for this layer - skip it, keep going.
  }
}

function setLayout(map: MapLibreMap, layerId: string, prop: string, value: unknown) {
  if (!map.getLayer(layerId)) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see setPaint
    map.setLayoutProperty(layerId, prop as any, value as any);
  } catch {
    // Upstream style shape changed for this layer - skip it, keep going.
  }
}

interface MapPalette {
  land: string;
  water: string;
  waterwayLine: string;
  waterLabel: string;
  parkFill: string;
  parkOutline: string;
  roadCasing: string;
  roadMinor: string;
  roadSecondary: string;
  roadMotorway: string;
  building: string;
  labelInk: string;
  labelSecondary: string;
  boundary: string;
}

// Matches the app's own light tokens (src/theme/tokens.ts `colors`) where
// there's a direct equivalent; a few map-only in-between tones are defined
// here since the app palette doesn't have e.g. a dedicated "water" shade.
const LIGHT_MAP_PALETTE: MapPalette = {
  land: "#FAF7F0", // == colors.background - warm parchment land
  water: "#D9E1EC", // pale muted blue, between colors.skyMuted and colors.sky
  waterwayLine: "#C7D3E4",
  waterLabel: "#3D5488", // == colors.accent
  parkFill: "#DDE6DC", // muted "cool" green
  parkOutline: "rgba(79, 111, 102, 0.35)", // == colors.success, low alpha
  roadCasing: "#C7BCA1", // == colors.borderStrong - subtle, low-contrast outline
  roadMinor: "#FFFFFF",
  roadSecondary: "#EEE9DD",
  roadMotorway: "#F5EDDC", // == colors.sandMuted
  building: "#EAE3D5", // == colors.surfaceMuted
  labelInk: "#1F1D1A", // == colors.textPrimary
  labelSecondary: "#6E675E", // == colors.textSecondary
  boundary: "hsl(30, 8%, 55%)",
};

// Matches nocturneColors (src/theme/tokens.ts). Water/parks/roads get their
// own distinct dark tones (rather than reusing background/surface directly)
// so they stay readable against the near-black land fill.
const DARK_MAP_PALETTE: MapPalette = {
  land: "#14161B", // == nocturneColors.background
  water: "#1C2A3D",
  waterwayLine: "#2C4463",
  waterLabel: "#8FA6D8", // == nocturneColors.accent
  parkFill: "#1E2B22",
  parkOutline: "rgba(127, 167, 154, 0.3)", // == nocturneColors.success, low alpha
  roadCasing: "#333944", // == nocturneColors.border
  roadMinor: "#232830",
  roadSecondary: "#272C35",
  roadMotorway: "#2E2A22",
  building: "#20242C",
  labelInk: "#EDE7DA", // == nocturneColors.textPrimary
  labelSecondary: "#C9C2B4", // == nocturneColors.textSecondary
  boundary: "hsl(220, 10%, 45%)",
};

const ROAD_CASING_LAYERS = [
  "tunnel_motorway_link_casing",
  "tunnel_service_track_casing",
  "tunnel_link_casing",
  "tunnel_street_casing",
  "tunnel_secondary_tertiary_casing",
  "tunnel_trunk_primary_casing",
  "tunnel_motorway_casing",
  "road_motorway_link_casing",
  "road_service_track_casing",
  "road_link_casing",
  "road_minor_casing",
  "road_secondary_tertiary_casing",
  "road_trunk_primary_casing",
  "road_motorway_casing",
  "bridge_motorway_link_casing",
  "bridge_service_track_casing",
  "bridge_link_casing",
  "bridge_street_casing",
  "bridge_path_pedestrian_casing",
  "bridge_secondary_tertiary_casing",
  "bridge_trunk_primary_casing",
  "bridge_motorway_casing",
];

const ROAD_MINOR_LAYERS = [
  "tunnel_service_track",
  "tunnel_link",
  "tunnel_minor",
  "road_service_track",
  "road_link",
  "road_minor",
  "bridge_service_track",
  "bridge_link",
  "bridge_street",
];

const ROAD_SECONDARY_LAYERS = [
  "tunnel_secondary_tertiary",
  "tunnel_trunk_primary",
  "road_secondary_tertiary",
  "road_trunk_primary",
  "bridge_secondary_tertiary",
  "bridge_trunk_primary",
];

const ROAD_MOTORWAY_LAYERS = [
  "tunnel_motorway_link",
  "tunnel_motorway",
  "road_motorway_link",
  "road_motorway",
  "bridge_motorway_link",
  "bridge_motorway",
];

const PLACE_LABEL_LAYERS = [
  "label_other",
  "label_village",
  "label_town",
  "label_state",
  "label_city",
  "label_city_capital",
  "label_country_3",
  "label_country_2",
  "label_country_1",
];

// Generic ranked POI icons/labels (shops, restaurants, etc.) - Lav's own
// bathroom pins are the points of interest that matter on this map, so
// these are hidden rather than recolored. `poi_transit` is left alone -
// transit stations are genuinely useful wayfinding context, not clutter.
const POI_CLUTTER_LAYERS = ["poi_r20", "poi_r7", "poi_r1"];

export function applyLavMapTheme(map: MapLibreMap, scheme: "paper" | "nocturne" = "paper") {
  const p = scheme === "nocturne" ? DARK_MAP_PALETTE : LIGHT_MAP_PALETTE;

  setPaint(map, "background", "background-color", p.land);

  setPaint(map, "water", "fill-color", p.water);
  for (const id of ["waterway_tunnel", "waterway_river", "waterway_other"]) {
    setPaint(map, id, "line-color", p.waterwayLine);
  }
  setPaint(map, "water_name_point_label", "text-color", p.waterLabel);
  setPaint(map, "water_name_line_label", "text-color", p.waterLabel);
  setPaint(map, "waterway_line_label", "text-color", p.waterLabel);

  setPaint(map, "park", "fill-color", p.parkFill);
  setPaint(map, "park", "fill-outline-color", p.parkOutline);
  setPaint(map, "landcover_wood", "fill-color", p.parkFill);
  setPaint(map, "landcover_grass", "fill-color", p.parkFill);

  for (const id of ROAD_CASING_LAYERS) setPaint(map, id, "line-color", p.roadCasing);
  for (const id of ROAD_MINOR_LAYERS) setPaint(map, id, "line-color", p.roadMinor);
  for (const id of ROAD_SECONDARY_LAYERS) setPaint(map, id, "line-color", p.roadSecondary);
  for (const id of ROAD_MOTORWAY_LAYERS) setPaint(map, id, "line-color", p.roadMotorway);

  setPaint(map, "building", "fill-color", p.building);

  setPaint(map, "boundary_2", "line-color", p.boundary);

  // The path-name label halo was hardcoded to the *original* background
  // color upstream - re-match it to the active one so it still blends in
  // instead of showing a stale off-white (or, now, off-black) box around
  // the text.
  setPaint(map, "highway-name-path", "text-halo-color", p.land);
  for (const id of ["highway-name-minor", "highway-name-major"]) {
    setPaint(map, id, "text-color", p.labelSecondary);
  }
  for (const id of PLACE_LABEL_LAYERS) {
    setPaint(map, id, "text-color", p.labelInk);
    setPaint(map, id, "text-halo-color", p.land);
    setPaint(map, id, "text-halo-width", 0.8);
  }

  for (const id of POI_CLUTTER_LAYERS) setLayout(map, id, "visibility", "none");
}
