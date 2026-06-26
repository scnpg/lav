import type { VibeTag } from "../types/enums";
import { VIBE_TAGS } from "../types/enums";

export const TAG_LABELS: Record<VibeTag, string> = {
  luxury: "Luxury",
  cursed: "Cursed",
  clean: "Clean",
  sketchy: "Sketchy",
  elite: "Elite",
  hidden_gem: "Hidden gem",
  campus: "Campus",
  hotel: "Hotel",
  event_only: "Event only",
  corporate: "Corporate",
  airport: "Airport",
  mall: "Mall",
  restaurant: "Restaurant",
  emergency_save: "Emergency save",
  outfit_check: "Outfit check",
  bidet: "Bidet",
  no_line: "No line",
  private_rare: "Private & rare",
};

// A light emoji accent for flavor, used sparingly (e.g. list/bathroom chips) -
// keeps the "slightly playful" tone without tipping into joke-app territory.
export const TAG_EMOJI: Partial<Record<VibeTag, string>> = {
  luxury: "✨",
  cursed: "💀",
  elite: "👑",
  hidden_gem: "💎",
  no_line: "⚡",
  bidet: "🚿",
};

export const ALL_TAGS: VibeTag[] = [...VIBE_TAGS];
