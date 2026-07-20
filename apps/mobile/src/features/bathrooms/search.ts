import PinyinMatch from "pinyin-match/lib/traditional.js";

import { ACCESS_TYPE_LABELS } from "../../constants/enumLabels";
import { AMENITY_LABELS } from "../../constants/amenities";
import { TAG_LABELS } from "../../constants/tags";
import type { BathroomNearby } from "../../types/database";
import type { AmenityKey, VibeTag } from "../../types/enums";

// Traditional-Chinese build (not the default simplified one) - Lav's Taipei
// data is Traditional Chinese (fac_p_07.csv, Taipei city government data).
// PinyinMatch.match() handles plain substring matching for any text it's
// given (English included, confirmed against this dataset's NYC/DC names)
// as well as pinyin/initials matching for Chinese text, so it replaces the
// old toLowerCase().includes() checks for every free-text field instead of
// needing a separate "is this Chinese" branch.
function pinyinIncludes(text: string | null | undefined, query: string): boolean {
  if (!text) return false;
  return PinyinMatch.match(text, query) !== false;
}

function pinyinStartsWith(text: string, query: string): boolean {
  const match = PinyinMatch.match(text, query);
  return match !== false && match[0] === 0;
}

// Lowest index = most relevant. Checked in order, first match wins - a
// bathroom matching only on, say, an amenity is still included but ranked
// behind one matching on name.
const RELEVANCE_TESTS: Array<(bathroom: BathroomNearby, query: string) => boolean> = [
  (b, q) => pinyinStartsWith(b.name, q),
  (b, q) => pinyinIncludes(b.name, q),
  (b, q) => pinyinIncludes(b.venue_name, q),
  (b, q) => pinyinIncludes([b.address, b.city, b.region].filter(Boolean).join(" "), q),
  (b, q) => Boolean(b.access_type) && (ACCESS_TYPE_LABELS[b.access_type!].toLowerCase().includes(q) || b.access_type!.includes(q)),
  (b, q) =>
    Object.entries(b.amenities).some(
      ([key, enabled]) => enabled && AMENITY_LABELS[key as AmenityKey].toLowerCase().includes(q)
    ),
  (b, q) => b.tags.some((tag) => (TAG_LABELS[tag as VibeTag] ?? tag).toLowerCase().includes(q)),
];

// Search across name / venue / address+city+region / access type / amenities
// / tags (with pinyin/initials support via PinyinMatch above), then sort:
// proximity first (distance_meters - 0 until useLiveLocation has a fix, see
// the Map screen), then text relevance tier, then rating. Returns [] for an
// empty query - callers decide whether that means "show nothing" or "show
// everything".
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
