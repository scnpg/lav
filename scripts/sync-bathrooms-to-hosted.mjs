#!/usr/bin/env node
// One-time/rerunnable copy of every row in the LOCAL bathrooms table to the
// HOSTED Supabase project, via each project's own REST API (no direct
// Postgres/pg_dump access needed - works from any machine with network
// access to both).
//
// Why this exists: the 350k+ OSM-imported bathrooms (import-taiwan-osm.mjs,
// ingest-overpass-bathrooms.ts) were only ever run against local dev's
// Supabase instance. The hosted project got every schema migration via
// `supabase db push`, but migrations carry schema, not data - so the
// deployed site's `bathrooms` table was sitting at 0 rows the whole time,
// which is why the map showed nothing for real visitors.
//
// `location` (a geography column) is deliberately excluded from the copied
// columns - it's populated by the sync_bathroom_location trigger from
// latitude/longitude on insert, so it doesn't need to travel explicitly.
// `submitted_by`/`verified_by` are forced to null for every row: a small
// handful of local rows carry a real person's local-only user id in those
// columns, which doesn't exist in the hosted project's auth.users and would
// violate its foreign key - nulling them loses attribution on those few rows
// only, not the bathroom data itself.
//
// Safe to re-run: uses upsert (on_conflict=id, resolution=merge-duplicates),
// so a partial/interrupted run can just be started again.
//
// Usage:
//   SOURCE_SERVICE_ROLE_KEY=<local, from `supabase status`> \
//   DEST_URL=https://<ref>.supabase.co \
//   DEST_SERVICE_ROLE_KEY=<hosted service_role key> \
//     node scripts/sync-bathrooms-to-hosted.mjs [--batch-size=2000]

const SOURCE_URL = process.env.SOURCE_URL ?? "http://127.0.0.1:54321";
const SOURCE_SERVICE_ROLE_KEY = process.env.SOURCE_SERVICE_ROLE_KEY;
const DEST_URL = process.env.DEST_URL;
const DEST_SERVICE_ROLE_KEY = process.env.DEST_SERVICE_ROLE_KEY;

const args = process.argv.slice(2);
const batchSizeArg = args.find((a) => a.startsWith("--batch-size="));
const BATCH_SIZE = batchSizeArg ? Number(batchSizeArg.split("=")[1]) : 2000;

if (!SOURCE_SERVICE_ROLE_KEY || !DEST_URL || !DEST_SERVICE_ROLE_KEY) {
  console.error(
    "Set SOURCE_SERVICE_ROLE_KEY (local, from `supabase status`), DEST_URL, and DEST_SERVICE_ROLE_KEY (hosted) first."
  );
  process.exit(1);
}

// Every bathrooms column except `location` (trigger-derived, see header).
const COLUMNS = [
  "id", "name", "venue_name", "description", "address", "city", "region", "country", "floor",
  "latitude", "longitude", "status", "access_type", "purchase_required", "purchase_note",
  "access_difficulty", "access_notes", "private_access_code", "access_code_public_allowed",
  "cost_type", "cost_amount", "gender_category", "toilet_type", "amenities", "tags", "open_hours",
  "cleanliness_score", "safety_score", "privacy_score", "smell_score", "prestige_score",
  "overall_score", "review_count", "photo_count", "submitted_by", "verified_by", "verified_at",
  "last_verified_at", "submission_latitude", "submission_longitude", "created_at", "updated_at",
  "wheelchair_accessible", "has_changing_station", "dataset_source", "name_verified", "name_verified_at",
].join(",");

async function fetchBatch(offset) {
  const res = await fetch(`${SOURCE_URL}/rest/v1/bathrooms?select=${COLUMNS}&order=id.asc`, {
    headers: {
      apikey: SOURCE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SOURCE_SERVICE_ROLE_KEY}`,
      Range: `${offset}-${offset + BATCH_SIZE - 1}`,
      "Range-Unit": "items",
    },
  });
  if (!res.ok && res.status !== 206) throw new Error(`Source fetch failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function upsertBatch(rows) {
  // submitted_by/verified_by nulled here (not at the source query) so the
  // rest of the row still travels through untouched.
  const sanitized = rows.map((r) => ({ ...r, submitted_by: null, verified_by: null }));
  const res = await fetch(`${DEST_URL}/rest/v1/bathrooms?on_conflict=id`, {
    method: "POST",
    headers: {
      apikey: DEST_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${DEST_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(sanitized),
  });
  if (!res.ok) throw new Error(`Dest upsert failed: ${res.status} ${await res.text()}`);
}

async function main() {
  let offset = 0;
  let total = 0;
  for (;;) {
    const batch = await fetchBatch(offset);
    if (batch.length === 0) break;
    await upsertBatch(batch);
    total += batch.length;
    // Advance by what actually came back, not BATCH_SIZE: PostgREST caps a
    // single response at its own db-max-rows setting (1000 by default)
    // regardless of the Range requested, so a smaller-than-requested batch
    // does NOT mean "that was the last page" - only an empty batch does.
    offset += batch.length;
    console.log(`Synced ${total} rows...`);
  }
  console.log(`Done. ${total} rows synced to ${DEST_URL}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
