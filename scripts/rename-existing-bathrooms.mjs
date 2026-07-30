#!/usr/bin/env node
// Renames EXISTING bathrooms that still carry a generic fallback name
// ("Public Restroom" / "Accessible Public Restroom" / "Paid Public
// Restroom" - the old amenity=toilets-only ingestion scripts' fallback,
// confirmed to cover ~94% of the pre-existing 352k rows) to a real nearby
// name, wherever OSM has one available within range.
//
// One Overpass query per bounding box (not one per bathroom) - fetches every
// named venue/building/library/mall/school/street in that box, then matches
// each already-generic bathroom already in our own DB against that same
// result set client-side via nearest-distance, exactly like
// ingest-named-venue-bathrooms.mjs's findNearestName. This keeps Overpass
// load to a handful of queries regardless of how many bathrooms need
// renaming in a given box, since the DB read/write side talks to our own
// Supabase project, not the shared Overpass service.
//
// Usage:
//   SUPABASE_SERVICE_ROLE_KEY=<...> SUPABASE_URL=<...> \
//     node scripts/rename-existing-bathrooms.mjs --bbox=south,west,north,east [--bbox=...] [--dry-run]

const OVERPASS_URL = process.env.OVERPASS_URL ?? "https://overpass-api.de/api/interpreter";
const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const NEARBY_NAME_RADIUS_METERS = 60;
const OVERPASS_QUERY_TIMEOUT_SECONDS = 120;
const OVERPASS_MAX_RETRIES = 4;

// Exactly the set of generic fallback names the old ingestion scripts wrote
// (tags.name || tags["name:en"] || "<this>") - anything NOT in this list
// already has a real name and is left alone.
const GENERIC_NAMES = ["Public Restroom", "Accessible Public Restroom", "Paid Public Restroom"];

const args = process.argv.slice(2);
const bboxArgs = args.filter((a) => a.startsWith("--bbox="));
const dryRun = args.includes("--dry-run");

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

function elementLatLon(el) {
  if (typeof el.lat === "number" && typeof el.lon === "number") return { lat: el.lat, lon: el.lon };
  if (el.center) return { lat: el.center.lat, lon: el.center.lon };
  return null;
}

// Same category set as ingest-named-venue-bathrooms.mjs's VENUE_QUERY_CLAUSES
// + NAME_CONTEXT_CLAUSES, minus the toilets=yes restriction (any named
// instance of these is fair game as a naming source here, not just ones
// that also happen to have their own toilet) and minus the raw
// amenity=toilets node query (nothing to rename among those - they have no
// name to lose).
const NAMING_SOURCE_CLAUSES = [
  `nwr["amenity"~"^(restaurant|cafe|fast_food|bar|pub)$"]["name"]`,
  `nwr["tourism"]["name"]`,
  `nwr["leisure"~"^(park|garden|sports_centre)$"]["name"]`,
  `nwr["amenity"="library"]["name"]`,
  `nwr["shop"="mall"]["name"]`,
  `nwr["amenity"~"^(university|college|school)$"]["name"]`,
  `nwr["amenity"~"^(community_centre|townhall|courthouse)$"]["name"]`,
  `way["building"]["name"]`,
  `way["highway"]["name"]`,
];

async function fetchNamingSources(bbox) {
  const bboxStr = `(${bbox.south},${bbox.west},${bbox.north},${bbox.east})`;
  const query = `[out:json][timeout:${OVERPASS_QUERY_TIMEOUT_SECONDS}];(
    ${NAMING_SOURCE_CLAUSES.map((c) => c + bboxStr + ";").join("\n    ")}
  );out center;`;

  for (let attempt = 1; attempt <= OVERPASS_MAX_RETRIES; attempt++) {
    const res = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
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

function classifyNamingSources(elements) {
  const named = []; // { lat, lon, name, isStreet }
  for (const el of elements) {
    const pos = elementLatLon(el);
    if (!pos) continue;
    const tags = el.tags ?? {};
    if (!tags.name) continue;
    named.push({ ...pos, name: tags.name, isStreet: !!tags.highway });
  }
  return named;
}

function findNearestName(point, named) {
  let bestNonStreet = null;
  let bestNonStreetDist = Infinity;
  let bestStreet = null;
  let bestStreetDist = Infinity;
  for (const candidate of named) {
    const dist = haversineMeters(point.lat, point.lon, candidate.lat, candidate.lon);
    if (dist > NEARBY_NAME_RADIUS_METERS) continue;
    if (candidate.isStreet) {
      if (dist < bestStreetDist) {
        bestStreet = candidate;
        bestStreetDist = dist;
      }
    } else if (dist < bestNonStreetDist) {
      bestNonStreet = candidate;
      bestNonStreetDist = dist;
    }
  }
  if (bestNonStreet) return bestNonStreet.name;
  if (bestStreet) return `Restroom on ${bestStreet.name}`;
  return null;
}

async function fetchGenericBathroomsInBox(bbox) {
  const nameFilter = GENERIC_NAMES.map((n) => `"${n}"`).join(",");
  const url =
    `${SUPABASE_URL}/rest/v1/bathrooms?select=id,name,latitude,longitude` +
    `&latitude=gte.${bbox.south}&latitude=lte.${bbox.north}` +
    `&longitude=gte.${bbox.west}&longitude=lte.${bbox.east}` +
    `&name=in.(${nameFilter})`;
  const res = await fetch(url, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
  });
  if (!res.ok) throw new Error(`fetch bathrooms failed (${res.status}): ${await res.text()}`);
  return res.json();
}

async function renameBathroom(id, name) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/bathrooms?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(`rename failed (${res.status}): ${await res.text()}`);
}

async function main() {
  if (bboxArgs.length === 0) {
    console.error("Usage: node scripts/rename-existing-bathrooms.mjs --bbox=south,west,north,east [...] [--dry-run]");
    process.exit(1);
  }
  if (!SERVICE_ROLE_KEY) {
    console.error("Set SUPABASE_SERVICE_ROLE_KEY first.");
    process.exit(1);
  }

  const boxes = bboxArgs.map((a) => parseBbox(a.slice("--bbox=".length)));
  const stats = { renamed: 0, stillGeneric: 0, errors: 0 };
  let boxesFailed = 0;

  for (const [boxIndex, box] of boxes.entries()) {
    // A deliberate pause between boxes (not just within-box retries) - the
    // observed failure pattern is a handful of successful queries followed
    // by a burst of "fetch failed"s, on both the primary instance and the
    // kumi.systems mirror, which reads as a short-window rate limit rather
    // than a hard ban. Spacing requests out is the cheap thing to try
    // before giving up on a box entirely.
    if (boxIndex > 0) await new Promise((resolve) => setTimeout(resolve, 25000));
    console.log(`\nBox [${box.south}, ${box.west}, ${box.north}, ${box.east}]...`);
    let elements;
    try {
      elements = await fetchNamingSources(box);
    } catch (err) {
      boxesFailed += 1;
      console.error(`  Skipping this box - Overpass never recovered: ${err instanceof Error ? err.message : err}`);
      continue;
    }
    const named = classifyNamingSources(elements);
    console.log(`  ${named.length} named source(s) found.`);

    const generic = await fetchGenericBathroomsInBox(box);
    console.log(`  ${generic.length} generically-named bathroom(s) already in the DB here.`);

    const CONCURRENCY = 10;
    let cursor = 0;
    async function worker() {
      for (;;) {
        const i = cursor++;
        if (i >= generic.length) return;
        const bathroom = generic[i];
        try {
          const newName = findNearestName({ lat: bathroom.latitude, lon: bathroom.longitude }, named);
          if (!newName || newName === bathroom.name) {
            stats.stillGeneric += 1;
            continue;
          }
          if (dryRun) {
            console.log(`  [rename] "${bathroom.name}" -> "${newName}"`);
          } else {
            await renameBathroom(bathroom.id, newName);
          }
          stats.renamed += 1;
        } catch (err) {
          stats.errors += 1;
          console.error(`Error renaming ${bathroom.id}:`, err instanceof Error ? err.message : err);
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, generic.length) }, worker));
  }

  console.log("\nDone.");
  console.log(`  Renamed:               ${stats.renamed}${dryRun ? " (dry run)" : ""}`);
  console.log(`  Still generic:         ${stats.stillGeneric}`);
  console.log(`  Errors:                ${stats.errors}`);
  console.log(`  Boxes skipped (busy):  ${boxesFailed}/${boxes.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
