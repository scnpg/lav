import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";

import type { ProfileStats } from "./mockAchievements";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

export interface BadgeTierDef {
  /** "" for a single-tier (binary) badge. */
  tier: string;
  threshold: number;
}

export interface BadgeDef {
  key: string;
  name: string;
  description: string;
  icon: IoniconName;
  tiers: BadgeTierDef[];
  getValue: (stats: ProfileStats) => number;
}

export interface BadgeProgress {
  badge: BadgeDef;
  /** -1 means no tier unlocked yet. */
  unlockedTierIndex: number;
  currentValue: number;
  nextTier: BadgeTierDef | null;
}

// TODO(achievements): thresholds below are placeholders chosen to make the
// mock data demo a mix of locked/in-progress/unlocked states - not balanced
// against any real points economy yet. See
// docs/BATHROOM_INVENTORY_AND_VERIFICATION_STRATEGY.md Section 9.4 for the
// Cartographer thresholds this is loosely based on (that doc tiers
// Cartographer by *correct confirmations*; this screen ties it to verified
// *submissions* per product direction, with Master kept at the doc's
// alternate "50 verified submissions" threshold for continuity).
export const BADGE_DEFS: BadgeDef[] = [
  {
    key: "first_flush",
    name: "First Flush",
    description: "Make your first approved contribution of any kind.",
    icon: "sparkles-outline",
    tiers: [{ tier: "", threshold: 1 }],
    getValue: (s) => s.verifiedBathroomsAdded + s.approvedPhotos + s.approvedReviews + s.helpfulAccessTips,
  },
  {
    key: "cartographer",
    name: "Cartographer",
    description: "Submit bathrooms that go on to get verified.",
    icon: "map-outline",
    tiers: [
      { tier: "I", threshold: 1 },
      { tier: "II", threshold: 5 },
      { tier: "III", threshold: 15 },
      { tier: "Master", threshold: 50 },
    ],
    getValue: (s) => s.verifiedBathroomsAdded,
  },
  {
    key: "detective",
    name: "Detective",
    description: "Help verify bathrooms - correct existence votes, duplicate catches, and stale-listing reports.",
    icon: "search-outline",
    tiers: [
      { tier: "I", threshold: 5 },
      { tier: "II", threshold: 25 },
      { tier: "III", threshold: 100 },
    ],
    getValue: (s) => s.correctConfirmations + s.duplicateReportsConfirmed + s.staleReportsConfirmed,
  },
  {
    key: "photographer",
    name: "Photographer",
    description: "Get bathroom photos approved.",
    icon: "camera-outline",
    tiers: [
      { tier: "I", threshold: 3 },
      { tier: "II", threshold: 10 },
      { tier: "III", threshold: 30 },
    ],
    getValue: (s) => s.approvedPhotos,
  },
  {
    key: "reviewer",
    name: "Reviewer",
    description: "Get bathroom reviews approved.",
    icon: "create-outline",
    tiers: [
      { tier: "I", threshold: 3 },
      { tier: "II", threshold: 10 },
      { tier: "III", threshold: 30 },
    ],
    getValue: (s) => s.approvedReviews,
  },
  {
    key: "local_guide",
    name: "Local Guide",
    description: "Get access tips approved - the \"how do I actually get in\" notes.",
    icon: "bulb-outline",
    tiers: [
      { tier: "I", threshold: 3 },
      { tier: "II", threshold: 10 },
      { tier: "III", threshold: 25 },
    ],
    getValue: (s) => s.helpfulAccessTips,
  },
  {
    key: "regular",
    name: "Regular",
    description: "Check in to bathrooms.",
    icon: "location-outline",
    tiers: [
      { tier: "I", threshold: 5 },
      { tier: "II", threshold: 20 },
      { tier: "III", threshold: 50 },
    ],
    getValue: (s) => s.checkIns,
  },
  {
    key: "listmaker",
    name: "Listmaker",
    description: "Contribute to ranked or themed bathroom lists.",
    icon: "albums-outline",
    tiers: [
      { tier: "I", threshold: 1 },
      { tier: "II", threshold: 5 },
    ],
    getValue: (s) => s.listsContributedTo,
  },
  {
    key: "access_angel",
    name: "Access Angel",
    description: "Visit bathrooms with rare or exclusive access requirements.",
    icon: "lock-open-outline",
    tiers: [
      { tier: "I", threshold: 2 },
      { tier: "II", threshold: 8 },
    ],
    getValue: (s) => s.exclusiveBathroomVisits,
  },
  {
    key: "bidet_baron",
    name: "Bidet Baron",
    description: "Contribute to bidet-equipped bathrooms.",
    icon: "water-outline",
    tiers: [
      { tier: "I", threshold: 2 },
      { tier: "II", threshold: 10 },
    ],
    getValue: (s) => s.bidetContributions,
  },
  {
    key: "porcelain_elite",
    name: "Porcelain Elite",
    description: "Visit every toilet type Lav tracks - sitting, squat, bidet, urinal, mixed.",
    icon: "ribbon-outline",
    tiers: [{ tier: "", threshold: 5 }],
    getValue: (s) => new Set(s.toiletTypesVisited).size,
  },
];

export function getBadgeProgress(badge: BadgeDef, stats: ProfileStats): BadgeProgress {
  const currentValue = badge.getValue(stats);
  let unlockedTierIndex = -1;
  for (let i = 0; i < badge.tiers.length; i++) {
    if (currentValue >= badge.tiers[i]!.threshold) unlockedTierIndex = i;
  }
  const nextTier = unlockedTierIndex + 1 < badge.tiers.length ? badge.tiers[unlockedTierIndex + 1]! : null;
  return { badge, unlockedTierIndex, currentValue, nextTier };
}
