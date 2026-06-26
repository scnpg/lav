import type { AmenityKey } from "../types/enums";
import { AMENITY_KEYS } from "../types/enums";

export const AMENITY_LABELS: Record<AmenityKey, string> = {
  paper_towels: "Paper towels",
  hand_dryer: "Hand dryer",
  toilet_paper: "Toilet paper",
  tampons: "Tampons",
  pads: "Pads",
  soap: "Soap",
  bidet: "Bidet",
  baby_changing: "Baby changing table",
  wheelchair_accessible: "Wheelchair accessible",
  gender_neutral: "Gender neutral",
  mirror: "Mirror",
  outlet: "Power outlet",
  sharps_disposal: "Sharps disposal",
  coat_hook: "Coat hook",
  full_length_mirror: "Full-length mirror",
  touchless_sink: "Touchless sink",
  touchless_flush: "Touchless flush",
};

// Ionicons names (via @expo/vector-icons) used for amenity chips.
export const AMENITY_ICONS: Record<AmenityKey, string> = {
  paper_towels: "receipt-outline",
  hand_dryer: "leaf-outline",
  toilet_paper: "albums-outline",
  tampons: "ellipse-outline",
  pads: "ellipse-outline",
  soap: "water-outline",
  bidet: "water",
  baby_changing: "body-outline",
  wheelchair_accessible: "accessibility-outline",
  gender_neutral: "person-outline",
  mirror: "square-outline",
  outlet: "flash-outline",
  sharps_disposal: "medkit-outline",
  coat_hook: "shirt-outline",
  full_length_mirror: "body-outline",
  touchless_sink: "hand-left-outline",
  touchless_flush: "refresh-outline",
};

export const ALL_AMENITIES: AmenityKey[] = [...AMENITY_KEYS];
