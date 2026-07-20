#!/usr/bin/env node
// One-time/rerunnable OSM `amenity=toilets` bulk importer, scoped to Taiwan.
//
// Reads an Overpass-API-shaped GeoJSON export (FeatureCollection of Point
// features, each with properties.tags) and inserts a new `bathrooms` row for
// every node inside Taiwan's bounding box that is NOT within 2 meters of an
// existing row. Taiwan's public-toilet density is high enough that the
// default 50m dedup radius (find_nearby_duplicate_bathrooms(), used by the
// app's own "Add a bathroom" nearby-duplicate warning) would incorrectly
// treat genuinely distinct, closely-spaced bathrooms as duplicates - this
// script calls that same RPC with an explicit radius_meters=2 instead of
// changing its default, since the default still needs to stay generous for
// the user-submission flow.
//
// Every inserted row starts at status='pending' (never 'verified') so
// nothing appears on the public map until an admin reviews it - see
// docs/BATHROOM_INVENTORY_AND_VERIFICATION_STRATEGY.md, "no source other
// than a firsthand admin visit starts at verified."
//
// Usage:
//   SUPABASE_SERVICE_ROLE_KEY=<from `supabase status`> \
//     node scripts/import-taiwan-osm.mjs /path/to/toilets.geojson [--dry-run] [--limit=500]
//
// Requires a running local Supabase stack (`supabase start`). Only ever
// inserts new rows - never updates or deletes existing ones.

import { readFileSync } from "node:fs";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const args = process.argv.slice(2);
const filePath = args.find((a) => !a.startsWith("--"));
const dryRun = args.includes("--dry-run");
const limitArg = args.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : Infinity;
// Sequential, not concurrent: the dedup check and the insert it guards are
// two separate round-trips (PostgREST has no atomic "insert if not within
// 2m" primitive), so two candidates within 2m of *each other* - but not of
// any pre-existing row - can both pass the check before either commits its
// insert. Confirmed in practice at CONCURRENCY=20 (12 intra-batch
// near-duplicates slipped through on the first real run, cleaned up by
// hand). Running one candidate at a time closes that window entirely; at
// ~4,000 Taiwan candidates this costs a couple of minutes, not hours.
const CONCURRENCY = 1;
const DEDUP_RADIUS_METERS = 2;

if (!filePath) {
  console.error("Usage: node scripts/import-taiwan-osm.mjs <path-to-toilets.geojson> [--dry-run] [--limit=N]");
  process.exit(1);
}
if (!SERVICE_ROLE_KEY) {
  console.error("Set SUPABASE_SERVICE_ROLE_KEY first - run `supabase status` and copy the service_role key.");
  process.exit(1);
}

// Generous box covering the main island plus Penghu, Kinmen, and Matsu.
// Deliberately a coarse rectangle, not a precise polygon - it can't perfectly
// exclude the sliver of mainland Fujian coastline nearest Kinmen/Matsu, but
// that's an acceptable trade for a cheap pre-filter ahead of the real
// per-node 2-meter dedup check against the database.
const TAIWAN_BOUNDS = { minLat: 21.8, maxLat: 26.4, minLon: 118.0, maxLon: 122.1 };

function isInTaiwan(lat, lon) {
  return (
    lat >= TAIWAN_BOUNDS.minLat &&
    lat <= TAIWAN_BOUNDS.maxLat &&
    lon >= TAIWAN_BOUNDS.minLon &&
    lon <= TAIWAN_BOUNDS.maxLon
  );
}

// Conservative tag mapping - only maps OSM tags that translate unambiguously
// to an existing column/enum value (see apps/mobile/src/types/enums.ts).
// Everything else is left null/'unknown' rather than guessed, since these
// rows land in 'pending' for admin review anyway, not straight to the map.
function mapFeatureToBathroom(feature) {
  const { lat, lon, tags = {} } = feature.properties;
  const name = tags.name || tags["name:en"] || "Public Restroom";

  const amenities = {};
  if (tags.wheelchair === "yes") amenities.wheelchair_accessible = true;
  if (tags.changing_table === "yes") amenities.baby_changing = true;

  let cost_type = "unknown";
  if (tags.fee === "no") cost_type = "free";
  else if (tags.fee === "yes") cost_type = "paid";

  let gender_category = "unknown";
  if (tags.unisex === "yes" || tags["toilets:unisex"] === "yes") gender_category = "all_gender";
  else if (tags.wheelchair === "yes" && tags.male !== "yes" && tags.female !== "yes") gender_category = "accessible";

  let toilet_type = "unknown";
  if (tags.toilets === "urinal" || tags["toilets:urinal"] === "yes") toilet_type = "urinal_only";
  else if (tags["toilets:position"] === "squatting") toilet_type = "squat";
  else if (tags["toilets:position"] === "seated") toilet_type = "sitting";
  else if (tags.bidet === "yes") toilet_type = "bidet";

  return {
    name,
    latitude: lat,
    longitude: lon,
    location: `SRID=4326;POINT(${lon} ${lat})`,
    status: "pending",
    access_type: tags.access === "private" ? "unknown" : "public",
    country: "Taiwan",
    dataset_source: "OpenStreetMap",
    cost_type,
    gender_category,
    toilet_type,
    amenities,
    open_hours: {},
    tags: [],
  };
}

async function findNearbyDuplicate(lat, lon) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/find_nearby_duplicate_bathrooms`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ lat, lng: lon, radius_meters: DEDUP_RADIUS_METERS }),
  });
  if (!res.ok) throw new Error(`duplicate check failed (${res.status}): ${await res.text()}`);
  const rows = await res.json();
  return rows.length > 0 ? rows[0] : null;
}

async function insertBathroom(row) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/bathrooms`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(`insert failed (${res.status}): ${await res.text()}`);
}

async function processCandidate(feature, stats) {
  const row = mapFeatureToBathroom(feature);
  const duplicate = await findNearbyDuplicate(row.latitude, row.longitude);
  if (duplicate) {
    stats.skippedDuplicate += 1;
    return;
  }
  if (!dryRun) {
    await insertBathroom(row);
  }
  stats.inserted += 1;
}

async function runWithConcurrency(items, worker, concurrency) {
  let index = 0;
  async function next() {
    while (index < items.length) {
      const current = index++;
      await worker(items[current], current);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, next));
}

async function main() {
  console.log(`Reading ${filePath}...`);
  const geojson = JSON.parse(readFileSync(filePath, "utf-8"));
  const allFeatures = geojson.features ?? [];
  console.log(`${allFeatures.length} total nodes in file.`);

  const taiwanCandidates = allFeatures
    .filter((f) => f.properties && isInTaiwan(f.properties.lat, f.properties.lon))
    .slice(0, limit);
  console.log(`${taiwanCandidates.length} candidates inside the Taiwan bounding box${dryRun ? " (dry run)" : ""}.`);

  const stats = { inserted: 0, skippedDuplicate: 0, errors: 0 };
  let processed = 0;

  await runWithConcurrency(
    taiwanCandidates,
    async (feature) => {
      try {
        await processCandidate(feature, stats);
      } catch (err) {
        stats.errors += 1;
        console.error(`Error on node ${feature.properties?.id}:`, err.message);
      }
      processed += 1;
      if (processed % 200 === 0) {
        console.log(`  ...${processed}/${taiwanCandidates.length} processed`);
      }
    },
    CONCURRENCY
  );

  console.log("\nDone.");
  console.log(`  Inserted:            ${stats.inserted}${dryRun ? " (dry run - nothing actually written)" : ""}`);
  console.log(`  Skipped (duplicate): ${stats.skippedDuplicate}`);
  console.log(`  Errors:              ${stats.errors}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
