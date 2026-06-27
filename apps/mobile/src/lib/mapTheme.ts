import type { MapLibreMap } from "maplibre-gl";

// ---------------------------------------------------------------------------
// Apple-Maps-inspired "oasis" re-theme of OpenFreeMap's "Liberty" vector
// style (https://tiles.openfreemap.org/styles/liberty, OpenMapTiles schema -
// see src/lib/mapStyle.ts). We don't control that style - it's loaded by
// URL, not vendored into this repo - so this runs once the map has finished
// loading it, and recolors known layers in place via
// setPaintProperty/setLayoutProperty.
//
// Every call goes through setPaint/setLayout below, which checks the layer
// exists and swallows any error: if OpenFreeMap ever renames/restructures a
// layer upstream, that one override is silently skipped instead of throwing
// and breaking the whole map. The layer ids/colors referenced here were
// read directly off the live style (`curl https://tiles.openfreemap.org/
// styles/liberty`) while writing this - re-check there if this ever stops
// visibly applying.
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

// Matches the app's own oasis tokens (src/theme/tokens.ts) where there's a
// direct equivalent; a few map-only in-between tones are defined here since
// the app palette doesn't have e.g. a dedicated "water" shade.
const LAND = "#FAF7EF"; // == colors.background - warm off-white land
const WATER = "#D6E6F5"; // pale sky blue, between colors.skyMuted and colors.sky
const WATERWAY_LINE = "#BFD9F0";
const WATER_LABEL = "#6B86AC";
const PARK_FILL = "#DCE8D3"; // muted palm green
const PARK_OUTLINE = "rgba(126, 159, 117, 0.35)"; // == colors.success, low alpha
const ROAD_CASING = "#D8CFBE"; // == colors.borderStrong - subtle, low-contrast outline
const ROAD_MINOR = "#FFFFFF";
const ROAD_SECONDARY = "#F3EEE3";
const ROAD_MOTORWAY = "#FAF1DE"; // == colors.sandMuted
const BUILDING = "#F1ECDF"; // == colors.surfaceMuted
const LABEL_INK = "#252824"; // == colors.textPrimary
const LABEL_SECONDARY = "#6F6A5F"; // == colors.textSecondary

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

export function applyOasisMapTheme(map: MapLibreMap) {
  setPaint(map, "background", "background-color", LAND);

  setPaint(map, "water", "fill-color", WATER);
  for (const id of ["waterway_tunnel", "waterway_river", "waterway_other"]) {
    setPaint(map, id, "line-color", WATERWAY_LINE);
  }
  setPaint(map, "water_name_point_label", "text-color", WATER_LABEL);
  setPaint(map, "water_name_line_label", "text-color", WATER_LABEL);
  setPaint(map, "waterway_line_label", "text-color", WATER_LABEL);

  setPaint(map, "park", "fill-color", PARK_FILL);
  setPaint(map, "park", "fill-outline-color", PARK_OUTLINE);
  setPaint(map, "landcover_wood", "fill-color", PARK_FILL);
  setPaint(map, "landcover_grass", "fill-color", PARK_FILL);

  for (const id of ROAD_CASING_LAYERS) setPaint(map, id, "line-color", ROAD_CASING);
  for (const id of ROAD_MINOR_LAYERS) setPaint(map, id, "line-color", ROAD_MINOR);
  for (const id of ROAD_SECONDARY_LAYERS) setPaint(map, id, "line-color", ROAD_SECONDARY);
  for (const id of ROAD_MOTORWAY_LAYERS) setPaint(map, id, "line-color", ROAD_MOTORWAY);

  setPaint(map, "building", "fill-color", BUILDING);

  setPaint(map, "boundary_2", "line-color", "hsl(30, 8%, 55%)");

  // The path-name label halo was hardcoded to the *original* background
  // color upstream - re-match it to the new one so it still blends in
  // instead of showing a stale off-white box around the text.
  setPaint(map, "highway-name-path", "text-halo-color", LAND);
  for (const id of ["highway-name-minor", "highway-name-major"]) {
    setPaint(map, id, "text-color", LABEL_SECONDARY);
  }
  for (const id of PLACE_LABEL_LAYERS) {
    setPaint(map, id, "text-color", LABEL_INK);
    setPaint(map, id, "text-halo-color", LAND);
    setPaint(map, id, "text-halo-width", 0.8);
  }

  for (const id of POI_CLUTTER_LAYERS) setLayout(map, id, "visibility", "none");
}
