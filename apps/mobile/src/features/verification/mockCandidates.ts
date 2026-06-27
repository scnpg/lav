import type { AccessType } from "../../types/enums";

// ---------------------------------------------------------------------------
// Mock imported bathroom candidates - stand-ins for what the real source
// pipeline (docs/BATHROOM_INVENTORY_AND_VERIFICATION_STRATEGY.md, Section 3)
// will eventually import. No real OSM/open-data import exists yet - these
// are hand-written examples spanning the three launch regions (NYC, DC,
// Baltimore/UMBC) and the range of source types/confidence levels a real
// candidate could show up with.
//
// TODO(verification): once a real source pipeline exists, candidates load
// from Supabase (status `imported_candidate` / `pending_user_submission` /
// `needs_user_confirmation`), not this file.
// ---------------------------------------------------------------------------

export type CandidateSourceType =
  | "osm"
  | "nyc_open_data"
  | "dc_open_data"
  | "baltimore_open_data"
  | "user_submission"
  | "venue_inference";

export const SOURCE_LABELS: Record<CandidateSourceType, string> = {
  osm: "OpenStreetMap",
  nyc_open_data: "NYC Open Data",
  dc_open_data: "DC Open Data",
  baltimore_open_data: "Baltimore Open Data",
  user_submission: "User submission",
  venue_inference: "Venue inference",
};

// Mirrors the 0-5 scale in the strategy doc (Section 7). Candidates that
// reach this prompt are, by definition, not yet at Level 3+ - if they were
// already admin/trusted-user verified they wouldn't need a confirmation ask.
export const CONFIDENCE_LABELS: Record<number, string> = {
  0: "Imported candidate",
  1: "Likely exists (source data)",
  2: "Users have confirmed existence",
  3: "Admin/trusted user verified access",
  4: "Verified with details",
  5: "Recently re-verified",
};

export interface VerificationCandidate {
  id: string;
  name: string;
  venueName: string | null;
  city: string;
  sourceType: CandidateSourceType;
  /** Approximate distance from the asking user, in meters - mock value only. */
  distanceMeters: number;
  confidenceLevel: number;
  lastCheckedAt: string;
  accessType: AccessType | null;
  /** Set when this candidate looks like it might already exist under another name/location. */
  possibleDuplicateOf?: string;
}

export const MOCK_VERIFICATION_CANDIDATES: VerificationCandidate[] = [
  {
    id: "vc-nyc-1",
    name: "Bryant Park Restroom",
    venueName: "Bryant Park",
    city: "NYC",
    sourceType: "nyc_open_data",
    distanceMeters: 640,
    confidenceLevel: 1,
    lastCheckedAt: "2026-06-10T12:00:00.000Z",
    accessType: "public",
  },
  {
    id: "vc-nyc-2",
    name: "Joe's Pizza Restroom",
    venueName: "Joe's Pizza",
    city: "NYC",
    sourceType: "venue_inference",
    distanceMeters: 1930,
    confidenceLevel: 0,
    lastCheckedAt: "2026-05-22T12:00:00.000Z",
    accessType: null,
    possibleDuplicateOf: "Joe's Pizza (Carmine St)",
  },
  {
    id: "vc-dc-1",
    name: "Eastern Market Annex Restroom",
    venueName: "Eastern Market",
    city: "DC",
    sourceType: "osm",
    distanceMeters: 3380,
    confidenceLevel: 1,
    lastCheckedAt: "2026-06-01T12:00:00.000Z",
    accessType: "public",
  },
  {
    id: "vc-dc-2",
    name: "Union Station Lower Level Restroom",
    venueName: "Union Station",
    city: "DC",
    sourceType: "dc_open_data",
    distanceMeters: 1290,
    confidenceLevel: 1,
    lastCheckedAt: "2026-06-18T12:00:00.000Z",
    accessType: "public",
  },
  {
    id: "vc-balt-1",
    name: "Inner Harbor Pavilion Restroom",
    venueName: "Inner Harbor Pavilion",
    city: "Baltimore",
    sourceType: "baltimore_open_data",
    distanceMeters: 5470,
    confidenceLevel: 1,
    lastCheckedAt: "2026-05-30T12:00:00.000Z",
    accessType: "public",
  },
  {
    id: "vc-umbc-1",
    name: "UMBC Library Annex Restroom",
    venueName: "UMBC Library",
    city: "UMBC",
    sourceType: "user_submission",
    distanceMeters: 10780,
    confidenceLevel: 0,
    lastCheckedAt: "2026-06-15T12:00:00.000Z",
    accessType: null,
  },
];
