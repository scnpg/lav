import { ACCESS_TYPE_LABELS } from "../../constants/enumLabels";
import { AMENITY_LABELS } from "../../constants/amenities";
import { TAG_LABELS } from "../../constants/tags";
import type { BathroomNearby } from "../../types/database";
import type { AmenityKey, VibeTag } from "../../types/enums";

// Lowest index = most relevant. Checked in order, first match wins - a
// bathroom matching only on, say, an amenity is still included but ranked
// behind one matching on name.
const RELEVANCE_TESTS: Array<(bathroom: BathroomNearby, query: string) => boolean> = [
  (b, q) => b.name.toLowerCase().startsWith(q),
  (b, q) => b.name.toLowerCase().includes(q),
  (b, q) => (b.venue_name ?? "").toLowerCase().includes(q),
  (b, q) => [b.address, b.city, b.region].filter(Boolean).join(" ").toLowerCase().includes(q),
  (b, q) => Boolean(b.access_type) && (ACCESS_TYPE_LABELS[b.access_type!].toLowerCase().includes(q) || b.access_type!.includes(q)),
  (b, q) =>
    Object.entries(b.amenities).some(
      ([key, enabled]) => enabled && AMENITY_LABELS[key as AmenityKey].toLowerCase().includes(q)
    ),
  (b, q) => b.tags.some((tag) => (TAG_LABELS[tag as VibeTag] ?? tag).toLowerCase().includes(q)),
];

// Search across name / venue / address+city+region / access type / amenities
// / tags, then sort: proximity first (distance_meters - the mock stand-in
// for "distance from the current/mock user location"), then text relevance
// tier, then rating. Returns [] for an empty query - callers decide whether
// that means "show nothing" or "show everything".
export function searchBathrooms(bathrooms: BathroomNearby[], query: string): BathroomNearby[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const matches: Array<{ bathroom: BathroomNearby; relevanceTier: number }> = [];
  for (const bathroom of bathrooms) {
    const relevanceTier = RELEVANCE_TESTS.findIndex((test) => test(bathroom, q));
    if (relevanceTier !== -1) matches.push({ bathroom, relevanceTier });
  }

  matches.sort((a, b) => {
    if (a.bathroom.distance_meters !== b.bathroom.distance_meters) {
      return a.bathroom.distance_meters - b.bathroom.distance_meters;
    }
    if (a.relevanceTier !== b.relevanceTier) return a.relevanceTier - b.relevanceTier;
    return b.bathroom.overall_score - a.bathroom.overall_score;
  });

  return matches.map((m) => m.bathroom);
}
