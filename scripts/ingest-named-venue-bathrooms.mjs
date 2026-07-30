#!/usr/bin/env node
// Rerunnable OSM importer sourcing bathrooms from named venues (restaurants,
// cafes, bars, tourist attractions, parks) that carry a toilets=yes tag,
// plus plain amenity=toilets nodes - all in ONE Overpass query per bounding
// box, so the "what's this bathroom actually inside" naming can be resolved
// entirely client-side from that single result set, no per-row lookups.
//
// Why this script exists (see also import-taiwan-osm.mjs and
// ingest-overpass-bathrooms.ts, which only pull amenity=toilets and fall
// back to the generic name "Public Restroom" when the node itself is
// unnamed - confirmed directly against the hosted DB that this is true for
// ~94% of the existing 352k rows). This script:
//   1. Treats a named venue with toilets=yes AS the bathroom, using the
//      venue's own name directly ("Joe's Diner", not "Public Restroom") -
//      this is also the "pull from restaurants/tourist attractions" source
//      requested, not just a naming fix.
//   2. For a plain (often unnamed) amenity=toilets node, looks for the
//      nearest named building/venue in the SAME query result within
//      NEARBY_NAME_RADIUS_METERS and uses that name instead of falling back
//      to a generic string - "in Riverside Park", not "Public Restroom".
//   3. Only falls back to the street name (or, failing that, the old
//      generic string) when nothing named is nearby at all.
//
// Same safety posture as the other ingestion scripts: every inserted row
// starts at status='pending', dedup runs at 2m via find_nearby_duplicate_bathrooms
// (sequential - see those scripts' own comments on why concurrency there
// reopens an intra-batch duplicate race), and this only ever inserts, never
// updates/deletes. dataset_source is set to a distinct value
// (OSM_NAMED_VENUE_DATASET_SOURCE below) specifically so a subsequent
// `update bathrooms set status='verified' where dataset_source = '...'`
// can promote exactly this batch once reviewed - not a blanket bulk-verify
// of unrelated pending rows.
//
// Usage:
//   SUPABASE_SERVICE_ROLE_KEY=<...> SUPABASE_URL=<...> \
//     node scripts/ingest-named-venue-bathrooms.mjs \
//       --bbox=south,west,north,east [--bbox=...] [--dry-run] [--limit=N]

const OVERPASS_URL = process.env.OVERPASS_URL ?? "https://overpass-api.de/api/interpreter";
const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const DEDUP_RADIUS_METERS = 2;
const NEARBY_NAME_RADIUS_METERS = 40;
const OVERPASS_QUERY_TIMEOUT_SECONDS = 120;
export const OSM_NAMED_VENUE_DATASET_SOURCE = "OpenStreetMap (Overpass - named venues)";

const args = process.argv.slice(2);
const bboxArgs = args.filter((a) => a.startsWith("--bbox="));
const dryRun = args.includes("--dry-run");
const limitArg = args.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : Infinity;

function parseBbox(raw) {
  const parts = raw.split(",").map((s) => Number(s.trim()));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) {
    throw new Error(`Invalid --bbox value "${raw}" - expected south,west,north,east`);
  }
  const [south, west, north, east] = parts;
  return { south, west, north, east };
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Overpass returns lat/lon directly on nodes, but only a `center` {lat,lon}
// on ways/relations (out center) - this normalizes both to the same shape.
function elementLatLon(el) {
  if (typeof el.lat === "number" && typeof el.lon === "number") return { lat: el.lat, lon: el.lon };
  if (el.center) return { lat: el.center.lat, lon: el.center.lon };
  return null;
}

const VENUE_QUERY_CLAUSES = [
  `nwr["amenity"~"^(restaurant|cafe|fast_food|bar|pub)$"]["toilets"="yes"]["name"]`,
  `nwr["tourism"]["toilets"="yes"]["name"]`,
  `nwr["leisure"~"^(park|garden)$"]["toilets"="yes"]["name"]`,
  // Added for DC/Baltimore/College Park/Montgomery County/NYC density pass -
  // libraries, malls, universities/colleges, and civic "facilities" that
  // explicitly tag toilets=yes become bathrooms themselves, same as a
  // restaurant/park above.
  `nwr["amenity"="library"]["toilets"="yes"]["name"]`,
  `nwr["shop"="mall"]["toilets"="yes"]["name"]`,
  `nwr["amenity"~"^(university|college)$"]["toilets"="yes"]["name"]`,
  `nwr["amenity"~"^(community_centre|townhall|courthouse)$"]["toilets"="yes"]["name"]`,
];
// Purely a naming fallback pool for unnamed toilets nodes - not inserted as
// bathrooms themselves unless nothing else nearby is found (bathrooms
// shouldn't be named after an arbitrary building that merely happens to be
// close, when a real venue/park name is available). Broadened for the same
// density pass to include libraries/malls/schools/facilities even when they
// don't carry toilets=yes themselves - a nearby unnamed toilet node still
// benefits from being named "at Rockville Memorial Library" rather than a
// generic building or street.
const NAME_CONTEXT_CLAUSES = [
  `way["building"]["name"]`,
  `way["highway"]["name"]`,
  `nwr["amenity"="library"]["name"]`,
  `nwr["shop"="mall"]["name"]`,
  `nwr["amenity"~"^(university|college|school)$"]["name"]`,
  `nwr["amenity"~"^(community_centre|townhall|courthouse)$"]["name"]`,
  `nwr["leisure"="sports_centre"]["name"]`,
];

const OVERPASS_MAX_RETRIES = 4;

// Overpass is a shared free service - a 504 "server too busy" under load is
// normal and transient, not a real failure, so a batch run spanning many
// bounding boxes needs to ride that out with backoff rather than aborting
// the whole run over one busy moment.
async function fetchOverpass(bbox) {
  const bboxStr = `(${bbox.south},${bbox.west},${bbox.north},${bbox.east})`;
  const query = `[out:json][timeout:${OVERPASS_QUERY_TIMEOUT_SECONDS}];(
    ${VENUE_QUERY_CLAUSES.map((c) => c + bboxStr + ";").join("\n    ")}
    node["amenity"="toilets"]${bboxStr};
    ${NAME_CONTEXT_CLAUSES.map((c) => c + bboxStr + ";").join("\n    ")}
  );out center;`;

  for (let attempt = 1; attempt <= OVERPASS_MAX_RETRIES; attempt++) {
    const res = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        // Overpass's server now 406s any request with no User-Agent at all
        // (confirmed directly - the exact same query succeeds with this
        // header and fails without it) - not documented in their fair-use
        // page as a hard requirement, but true in practice as of this script.
        "User-Agent": "LavBathroomApp/1.0 (+https://scnpg.github.io/lav/)",
      },
      body: `data=${encodeURIComponent(query)}`,
    });
    if (res.ok) {
      const data = await res.json();
      return data.elements;
    }
    const body = await res.text();
    const retryable = res.status === 504 || res.status === 429 || res.status >= 500;
    if (!retryable || attempt === OVERPASS_MAX_RETRIES) {
      throw new Error(`Overpass query failed (${res.status}): ${body.slice(0, 300)}`);
    }
    const waitMs = attempt * 15000;
    console.log(`  Overpass busy (${res.status}), retrying in ${waitMs / 1000}s... (attempt ${attempt}/${OVERPASS_MAX_RETRIES})`);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}

function isVenueWithToilets(tags) {
  if (tags.toilets !== "yes") return false;
  if (/^(restaurant|cafe|fast_food|bar|pub)$/.test(tags.amenity ?? "")) return true;
  if (tags.tourism) return true;
  if (/^(park|garden)$/.test(tags.leisure ?? "")) return true;
  if (tags.amenity === "library") return true;
  if (tags.shop === "mall") return true;
  if (/^(university|college)$/.test(tags.amenity ?? "")) return true;
  if (/^(community_centre|townhall|courthouse)$/.test(tags.amenity ?? "")) return true;
  return false;
}

function classify(elements) {
  const venues = []; // named venue/attraction/park WITH toilets=yes - becomes a bathroom itself
  const toiletNodes = []; // amenity=toilets - becomes a bathroom, name TBD
  const nameContext = []; // named buildings/streets - naming fallback pool only
  for (const el of elements) {
    const pos = elementLatLon(el);
    if (!pos) continue;
    const tags = el.tags ?? {};
    if (tags.amenity === "toilets") {
      toiletNodes.push({ ...pos, tags });
    } else if (isVenueWithToilets(tags) && tags.name) {
      venues.push({ ...pos, tags });
    } else if (tags.name) {
      nameContext.push({ ...pos, tags, isStreet: !!tags.highway });
    }
  }
  return { venues, toiletNodes, nameContext };
}

// Nearest named thing within radius, preferring a real venue/building over a
// street (a bathroom "at 5th Avenue" is a worse name than "at Riverside
// Park" when both are technically in range) - only falls through to the
// nearest street at all if there's no non-street candidate within radius.
function nearestWithin(point, candidates) {
  let best = null;
  let bestDist = Infinity;
  for (const candidate of candidates) {
    const dist = haversineMeters(point.lat, point.lon, candidate.lat, candidate.lon);
    if (dist <= NEARBY_NAME_RADIUS_METERS && dist < bestDist) {
      best = candidate;
      bestDist = dist;
    }
  }
  return best;
}

function findNearestName(point, venues, nameContext) {
  const nonStreet = [...venues, ...nameContext.filter((c) => !c.isStreet)];
  const nonStreetMatch = nearestWithin(point, nonStreet);
  if (nonStreetMatch) return nonStreetMatch.tags.name;

  const streetMatch = nearestWithin(point, nameContext.filter((c) => c.isStreet));
  if (streetMatch) return `Restroom on ${streetMatch.tags.name}`;

  return null;
}

function mapTagsToFields(tags) {
  const amenities = {};
  if (tags.wheelchair === "yes") amenities.wheelchair_accessible = true;
  if (tags.changing_table === "yes") amenities.baby_changing = true;

  let cost_type = "unknown";
  if (tags.fee === "no") cost_type = "free";
  else if (tags.fee === "yes") cost_type = "paid";

  let gender_category = "unknown";
  if (tags.unisex === "yes" || tags["toilets:unisex"] === "yes") gender_category = "all_gender";
  else if (tags.wheelchair === "yes" && tags.male !== "yes" && tags.female !== "yes") gender_category = "accessible";

  return { amenities, cost_type, gender_category };
}

// Best-effort only - full OSM opening_hours syntax (comma-separated day
// ranges, PH/SH modifiers, etc.) isn't parsed here, just the two cases worth
// distinguishing for the app's own OpenHours shape (DetailsGrid's
// formatOpenHours): "24/7" maps to is_24_hours, anything else is kept as the
// raw OSM string in `notes` rather than dropped - some hours info beats
// none, and it's still legible to a person even unparsed. This only ever
// covers bathrooms ingested from here on - it does not backfill the
// ~353k rows already in the table, which would mean re-querying Overpass
// for all of them at the same scale as the original ingestion runs.
function parseOpeningHours(tags) {
  const raw = tags.opening_hours;
  if (!raw) return {};
  if (raw === "24/7") return { is_24_hours: true };
  return { notes: raw };
}

function buildBathroomRow(point, name, tags) {
  const { amenities, cost_type, gender_category } = mapTagsToFields(tags);
  return {
    name,
    latitude: point.lat,
    longitude: point.lon,
    location: `SRID=4326;POINT(${point.lon} ${point.lat})`,
    status: "pending",
    access_type: tags.access === "private" ? "unknown" : "public",
    dataset_source: OSM_NAMED_VENUE_DATASET_SOURCE,
    cost_type,
    gender_category,
    amenities,
    open_hours: parseOpeningHours(tags),
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
  return rows.length > 0;
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

async function main() {
  if (bboxArgs.length === 0) {
    console.error("Usage: node scripts/ingest-named-venue-bathrooms.mjs --bbox=south,west,north,east [...] [--dry-run] [--limit=N]");
    process.exit(1);
  }
  if (!SERVICE_ROLE_KEY) {
    console.error("Set SUPABASE_SERVICE_ROLE_KEY first.");
    process.exit(1);
  }

  const boxes = bboxArgs.map((a) => parseBbox(a.slice("--bbox=".length)));
  const stats = { inserted: 0, skippedDuplicate: 0, errors: 0, namedFromVenue: 0, namedFromNearby: 0, namedGeneric: 0 };
  let processed = 0;
  let boxesFailed = 0;

  for (const [boxIndex, box] of boxes.entries()) {
    // Deliberate pause between boxes, not just within-box retries - observed
    // failure pattern is a handful of successful queries followed by a burst
    // of "fetch failed"s (on both the primary instance and the kumi.systems
    // mirror), which reads as a short-window rate limit rather than a hard
    // ban. Spacing requests out is the cheap thing to try before giving up.
    if (boxIndex > 0) await new Promise((resolve) => setTimeout(resolve, 25000));
    console.log(`Querying Overpass for [${box.south}, ${box.west}, ${box.north}, ${box.east}]...`);
    // A box that's still failing after fetchOverpass's own retries (e.g.
    // Overpass staying overloaded for minutes straight) skips to the NEXT
    // box instead of aborting the whole run - losing the one box is a much
    // smaller cost than losing every box queued after it, confirmed the hard
    // way (a single exhausted-retry box killed a run that had 30+ boxes
    // still queued behind it).
    let elements;
    try {
      elements = await fetchOverpass(box);
    } catch (err) {
      boxesFailed += 1;
      console.error(`  Skipping this box - Overpass never recovered: ${err instanceof Error ? err.message : err}`);
      continue;
    }
    const { venues, toiletNodes, nameContext } = classify(elements);
    console.log(`  ${venues.length} named venue(s) with toilets, ${toiletNodes.length} plain toilet node(s), ${nameContext.length} naming-context feature(s).`);

    const candidates = [
      ...venues.map((v) => ({ point: v, name: v.tags.name, tags: v.tags, source: "venue" })),
      ...toiletNodes.map((t) => {
        const ownName = t.tags.name || t.tags["name:en"];
        if (ownName) return { point: t, name: ownName, tags: t.tags, source: "own_name" };
        const nearby = findNearestName(t, venues, nameContext);
        if (nearby) return { point: t, name: nearby, tags: t.tags, source: "nearby" };
        return { point: t, name: "Public Restroom", tags: t.tags, source: "generic" };
      }),
    ].slice(0, limit - processed);

    // Bounded concurrency, not fully sequential: unlike the raw amenity=toilets
    // scripts (which hit a real intra-batch duplicate race at high
    // concurrency because dense toilet nodes are often within 2m of each
    // other), venue-sourced candidates here are restaurants/cafes/attractions
    // - genuinely distinct businesses essentially never sitting within 2m of
    // one another, so the same race isn't a practical risk at this
    // concurrency level. Bounded (not unbounded) purely to stay a reasonable
    // citizen of both the dedup RPC and Overpass's shared infrastructure.
    const CONCURRENCY = 8;
    let cursor = 0;
    async function worker() {
      for (;;) {
        const i = cursor++;
        if (i >= candidates.length) return;
        const candidate = candidates[i];
        try {
          if (dryRun) console.log(`  [${candidate.source}] ${candidate.name}`);
          const isDuplicate = await findNearbyDuplicate(candidate.point.lat, candidate.point.lon);
          if (isDuplicate) {
            stats.skippedDuplicate += 1;
          } else {
            const row = buildBathroomRow(candidate.point, candidate.name, candidate.tags);
            if (!dryRun) await insertBathroom(row);
            stats.inserted += 1;
            if (candidate.source === "venue" || candidate.source === "own_name") stats.namedFromVenue += 1;
            else if (candidate.source === "nearby") stats.namedFromNearby += 1;
            else stats.namedGeneric += 1;
          }
        } catch (err) {
          stats.errors += 1;
          console.error(`Error on candidate at ${candidate.point.lat},${candidate.point.lon}:`, err instanceof Error ? err.message : err);
        }
        processed += 1;
        if (processed % 200 === 0) console.log(`  ...${processed} processed so far`);
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, candidates.length) }, worker));
    if (processed >= limit) break;
  }

  console.log("\nDone.");
  console.log(`  Inserted:              ${stats.inserted}${dryRun ? " (dry run)" : ""}`);
  console.log(`    named from venue:    ${stats.namedFromVenue}`);
  console.log(`    named from nearby:   ${stats.namedFromNearby}`);
  console.log(`    generic fallback:    ${stats.namedGeneric}`);
  console.log(`  Skipped (duplicate):   ${stats.skippedDuplicate}`);
  console.log(`  Errors:                ${stats.errors}`);
  console.log(`  Boxes skipped (busy):  ${boxesFailed}/${boxes.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
