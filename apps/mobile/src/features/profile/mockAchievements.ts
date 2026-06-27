import type { ToiletType } from "../../types/enums";

// ---------------------------------------------------------------------------
// Mock-only profile/achievement data. There is no auth and no Supabase
// connection yet, so MOCK_PROFILE is a single hardcoded stand-in, not "your"
// data - the Profile screen says so explicitly (see the preview banner in
// app/(tabs)/profile.tsx).
//
// TODO(achievements): once Supabase + auth land, replace this whole module
// with a real query against `profiles` plus the future contribution/points
// tables described in docs/BATHROOM_INVENTORY_AND_VERIFICATION_STRATEGY.md
// (Section 9 "Achievements & leveling", Section 11 item 4). The shapes below
// are a rough sketch of that future schema, not a commitment to it - no
// points/levels/badges are computed for real anywhere in this app yet.
// ---------------------------------------------------------------------------

export interface ProfileStats {
  verifiedBathroomsAdded: number;
  correctConfirmations: number;
  approvedPhotos: number;
  approvedReviews: number;
  helpfulAccessTips: number;
  duplicateReportsConfirmed: number;
  staleReportsConfirmed: number;
  checkIns: number;
  listsContributedTo: number;
  exclusiveBathroomVisits: number;
  bidetContributions: number;
  toiletTypesVisited: ToiletType[];
}

export interface CityContribution {
  city: string;
  label: string;
  verifiedCount: number;
}

export interface MockProfile {
  displayName: string;
  lavLevel: number;
  totalPoints: number;
  currentLevelStartPoints: number;
  nextLevelPoints: number;
  stats: ProfileStats;
  cityContributions: CityContribution[];
}

// One of the three launch regions from the inventory strategy doc - UMBC is
// tracked as its own "city" for founder-badge purposes since it has its own
// campus community distinct from greater Baltimore.
export const MOCK_PROFILE: MockProfile = {
  displayName: "Lav Explorer",
  lavLevel: 6,
  totalPoints: 482,
  currentLevelStartPoints: 400,
  nextLevelPoints: 600,
  stats: {
    verifiedBathroomsAdded: 7,
    correctConfirmations: 34,
    approvedPhotos: 12,
    approvedReviews: 19,
    helpfulAccessTips: 9,
    duplicateReportsConfirmed: 3,
    staleReportsConfirmed: 2,
    checkIns: 41,
    listsContributedTo: 2,
    exclusiveBathroomVisits: 4,
    bidetContributions: 5,
    toiletTypesVisited: ["sitting", "bidet", "squat"],
  },
  cityContributions: [
    { city: "nyc", label: "NYC", verifiedCount: 3 },
    { city: "dc", label: "DC", verifiedCount: 2 },
    { city: "baltimore", label: "Baltimore", verifiedCount: 0 },
    { city: "umbc", label: "UMBC", verifiedCount: 1 },
  ],
};
