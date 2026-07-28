#!/usr/bin/env -S node --import tsx
// Rerunnable OSM `amenity=toilets` importer, queried LIVE from Overpass -
// the general-purpose counterpart to scripts/import-taiwan-osm.mjs (which
// reads a pre-exported GeoJSON file scoped to one country). This one takes
// arbitrary bounding boxes on the command line and fetches straight from
// https://overpass-api.de/api/interpreter, for "just get me the toilets in
// this rectangle" one-offs rather than a whole-country bulk load.
//
// Same safety posture as the Taiwan script: every inserted row starts at
// status='pending' (never 'verified') - nothing appears on the public map
// until an admin reviews it (see docs/BATHROOM_INVENTORY_AND_VERIFICATION_
// STRATEGY.md) - and dedup runs at a strict 2m radius via the same
// find_nearby_duplicate_bathrooms RPC the app's own "Add a bathroom"
// nearby-duplicate warning uses (that RPC's own default radius is 50m,
// intentionally more generous for a human placing a single pin - 2m is a
// bulk-import-specific override, not a change to the default).
//
// Candidates are still processed ONE AT A TIME (not concurrently): the
// dedup check and the insert it guards are two separate round-trips, so
// running multiple candidates in parallel can let two nodes that are near
// each other - but not near any pre-existing row - both pass the check
// before either commits. The Taiwan script hit this in practice; closing it
// requires strictly sequential processing, not a batch size tweak.
//
// Usage:
//   SUPABASE_SERVICE_ROLE_KEY=<from `supabase status`> \
//     node --import tsx scripts/ingest-overpass-bathrooms.ts \
//       --bbox=25.02,121.50,25.08,121.60 [--bbox=another,box,...] [--dry-run] [--limit=500]
//
// Requires a running local Supabase stack (`supabase start`). Only ever
// inserts new rows - never updates or deletes existing ones. Respect
// Overpass's fair-use policy (https://dev.overpass-api.de/overpass-doc/en/preface/commons.html)
// if querying large areas or running this often - it's a shared free
// service, not a dedicated endpoint.

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const DEDUP_RADIUS_METERS = 2;
const OVERPASS_QUERY_TIMEOUT_SECONDS = 60;

interface BoundingBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

interface OverpassNode {
  type: string;
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
}

interface BathroomRow {
  name: string;
  latitude: number;
  longitude: number;
  location: string;
  status: "pending";
  access_type: "public" | "unknown";
  dataset_source: string;
  cost_type: "free" | "paid" | "unknown";
  gender_category: "all_gender" | "accessible" | "unknown";
  amenities: Record<string, boolean>;
  open_hours: Record<string, never>;
  tags: string[];
}

const args = process.argv.slice(2);
const bboxArgs = args.filter((a) => a.startsWith("--bbox="));
const dryRun = args.includes("--dry-run");
const limitArg = args.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : Infinity;

function parseBbox(raw: string): BoundingBox {
  const parts = raw.split(",").map((s) => Number(s.trim()));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) {
    throw new Error(`Invalid --bbox value "${raw}" - expected south,west,north,east (e.g. 25.02,121.50,25.08,121.60)`);
  }
  const [south, west, north, east] = parts;
  return { south, west, north, east };
}

// Conservative tag mapping - only maps the fields the task calls out
// (wheelchair/fee/changing_table/name), same "don't guess" posture as the
// Taiwan script: unmapped fields stay 'unknown'/empty rather than inferred,
// since these rows land in 'pending' for a human to fill in the rest.
function mapNodeToBathroom(node: OverpassNode): BathroomRow {
  const tags = node.tags ?? {};
  const name = tags.name || tags["name:en"] || "Public Restroom";

  const amenities: Record<string, boolean> = {};
  if (tags.wheelchair === "yes") amenities.wheelchair_accessible = true;
  if (tags.changing_table === "yes") amenities.baby_changing = true;

  let cost_type: BathroomRow["cost_type"] = "unknown";
  if (tags.fee === "no") cost_type = "free";
  else if (tags.fee === "yes") cost_type = "paid";

  let gender_category: BathroomRow["gender_category"] = "unknown";
  if (tags.unisex === "yes" || tags["toilets:unisex"] === "yes") gender_category = "all_gender";
  else if (tags.wheelchair === "yes" && tags.male !== "yes" && tags.female !== "yes") gender_category = "accessible";

  return {
    name,
    latitude: node.lat,
    longitude: node.lon,
    location: `SRID=4326;POINT(${node.lon} ${node.lat})`,
    status: "pending",
    access_type: tags.access === "private" ? "unknown" : "public",
    dataset_source: "OpenStreetMap (Overpass)",
    cost_type,
    gender_category,
    amenities,
    open_hours: {},
    tags: [],
  };
}

async function fetchOverpassNodes(bbox: BoundingBox): Promise<OverpassNode[]> {
  const query = `[out:json][timeout:${OVERPASS_QUERY_TIMEOUT_SECONDS}];node["amenity"="toilets"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});out body;`;
  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      // Overpass now 406s a request with no User-Agent at all (confirmed
      // directly - the identical query succeeds with this header and fails
      // without it).
      "User-Agent": "LavBathroomApp/1.0 (+https://scnpg.github.io/lav/)",
    },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!res.ok) throw new Error(`Overpass query failed (${res.status}): ${await res.text()}`);
  const data = (await res.json()) as { elements: OverpassNode[] };
  return data.elements.filter((el) => el.type === "node" && typeof el.lat === "number" && typeof el.lon === "number");
}

async function findNearbyDuplicate(lat: number, lon: number): Promise<boolean> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/find_nearby_duplicate_bathrooms`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ lat, lng: lon, radius_meters: DEDUP_RADIUS_METERS }),
  });
  if (!res.ok) throw new Error(`duplicate check failed (${res.status}): ${await res.text()}`);
  const rows = (await res.json()) as unknown[];
  return rows.length > 0;
}

async function insertBathroom(row: BathroomRow): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/bathrooms`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(`insert failed (${res.status}): ${await res.text()}`);
}

async function main() {
  if (bboxArgs.length === 0) {
    console.error(
      "Usage: node --import tsx scripts/ingest-overpass-bathrooms.ts --bbox=south,west,north,east [--bbox=...] [--dry-run] [--limit=N]"
    );
    process.exit(1);
  }
  if (!SERVICE_ROLE_KEY) {
    console.error("Set SUPABASE_SERVICE_ROLE_KEY first - run `supabase status` and copy the service_role key.");
    process.exit(1);
  }

  const boxes = bboxArgs.map((a) => parseBbox(a.slice("--bbox=".length)));

  const nodesById = new Map<number, OverpassNode>();
  for (const box of boxes) {
    console.log(`Querying Overpass for [${box.south}, ${box.west}, ${box.north}, ${box.east}]...`);
    const nodes = await fetchOverpassNodes(box);
    console.log(`  ${nodes.length} toilet node(s) returned.`);
    for (const node of nodes) nodesById.set(node.id, node);
  }

  const candidates = [...nodesById.values()].slice(0, limit);
  console.log(`${candidates.length} unique candidate(s) across ${boxes.length} bounding box(es)${dryRun ? " (dry run)" : ""}.`);

  const stats = { inserted: 0, skippedDuplicate: 0, errors: 0 };
  let processed = 0;

  // Sequential on purpose - see the file header comment on why concurrency
  // here would reopen the intra-batch duplicate race the Taiwan import hit.
  for (const node of candidates) {
    try {
      const row = mapNodeToBathroom(node);
      const isDuplicate = await findNearbyDuplicate(row.latitude, row.longitude);
      if (isDuplicate) {
        stats.skippedDuplicate += 1;
      } else {
        if (!dryRun) await insertBathroom(row);
        stats.inserted += 1;
      }
    } catch (err) {
      stats.errors += 1;
      console.error(`Error on node ${node.id}:`, err instanceof Error ? err.message : err);
    }
    processed += 1;
    if (processed % 200 === 0) {
      console.log(`  ...${processed}/${candidates.length} processed`);
    }
  }

  console.log("\nDone.");
  console.log(`  Inserted:            ${stats.inserted}${dryRun ? " (dry run - nothing actually written)" : ""}`);
  console.log(`  Skipped (duplicate): ${stats.skippedDuplicate}`);
  console.log(`  Errors:              ${stats.errors}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
