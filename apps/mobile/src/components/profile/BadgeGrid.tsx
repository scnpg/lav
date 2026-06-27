import { BADGE_DEFS, getBadgeProgress } from "../../features/profile/badges";
import type { ProfileStats } from "../../features/profile/mockAchievements";
import { BadgeCard } from "./BadgeCard";
import { ResponsiveGrid } from "./ResponsiveGrid";

interface BadgeGridProps {
  stats: ProfileStats;
}

export function BadgeGrid({ stats }: BadgeGridProps) {
  return (
    <ResponsiveGrid>
      {BADGE_DEFS.map((badge) => (
        <BadgeCard key={badge.key} progress={getBadgeProgress(badge, stats)} />
      ))}
    </ResponsiveGrid>
  );
}
