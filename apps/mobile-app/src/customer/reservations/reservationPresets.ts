/** Tap-only presets — no free typing in the booking shell. */

export type TapOption = { id: string; label: string; sublabel?: string };

export const BOOKING_UX_TAGLINE = "Fast taps · large buttons · minimal typing";

export const GUEST_COUNTS = [1, 2, 3, 4, 5, 6, 8] as const;

export const DATE_OPTIONS: TapOption[] = [
  { id: "today", label: "Today", sublabel: "Next available" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "weekend", label: "This weekend", sublabel: "Fri–Sun" },
  { id: "next_week", label: "Next week" }
];

export const TIME_OPTIONS: TapOption[] = [
  { id: "17:30", label: "17:30" },
  { id: "18:00", label: "18:00" },
  { id: "18:30", label: "18:30" },
  { id: "19:00", label: "19:00", sublabel: "Popular" },
  { id: "19:30", label: "19:30" },
  { id: "20:00", label: "20:00" },
  { id: "20:30", label: "20:30" },
  { id: "21:00", label: "21:00" }
];

export const SEATING_OPTIONS = ["Any", "Window", "Booth", "Bar", "Quiet corner"] as const;

export const OCCASION_OPTIONS = ["Casual", "Date night", "Business", "Celebration", "Birthday"] as const;

export const ACCESSIBILITY_OPTIONS = [
  { id: "none", label: "No special needs" },
  { id: "step_free", label: "Step-free access" },
  { id: "high_chair", label: "High chair" },
  { id: "wheelchair", label: "Wheelchair space" },
  { id: "quiet", label: "Quiet table" }
] as const;

export const BRANCH_OPTIONS = [
  { id: "main", label: "Main dining room", sublabel: "Full menu" },
  { id: "terrace", label: "Terrace", sublabel: "Weather permitting" },
  { id: "lounge", label: "Private lounge", sublabel: "Groups 6+" }
] as const;

export const EXPERIENCE_OPTIONS = [
  { id: "standard", label: "Standard table" },
  { id: "chef", label: "Chef's table" },
  { id: "tasting", label: "Tasting menu" },
  { id: "brunch", label: "Sunday brunch" }
] as const;

export const RECOMMENDATION_PICKS = [
  { id: "quiet", label: "Quiet table", sublabel: "Best for 2" },
  { id: "early", label: "Earlier slot", sublabel: "18:00–18:30" },
  { id: "booth", label: "Booth", sublabel: "Cozy" }
] as const;

export const TABLE_OPTIONS = [
  { id: "t12", label: "Table 12", sublabel: "Window" },
  { id: "t08", label: "Table 8", sublabel: "Booth" },
  { id: "t04", label: "Table 4", sublabel: "Main floor" }
] as const;

export const GROUP_SIZE_OPTIONS = [
  { id: "12", label: "12 guests" },
  { id: "20", label: "20 guests" },
  { id: "30", label: "30 guests" },
  { id: "50", label: "50 guests" },
  { id: "80plus", label: "80+" }
] as const;

export const EVENT_TYPE_OPTIONS = [
  { id: "corporate", label: "Corporate dinner" },
  { id: "celebration", label: "Private celebration" },
  { id: "wedding", label: "Wedding party" },
  { id: "launch", label: "Product launch" }
] as const;

export const PACKAGE_OPTIONS = [
  { id: "menu_a", label: "Set menu A" },
  { id: "beverage", label: "Beverage package" },
  { id: "buyout", label: "Full venue buyout" }
] as const;

export const VIP_REQUEST_OPTIONS = [
  { id: "cake", label: "Celebration cake" },
  { id: "av", label: "AV / screen" },
  { id: "brand", label: "Branding" },
  { id: "host", label: "Dedicated host" },
  { id: "none", label: "Nothing else" }
] as const;

export const ADDON_OPTIONS = [
  { id: "wine", label: "Wine pairing" },
  { id: "cake", label: "Celebration cake" },
  { id: "dietary", label: "Dietary note" }
] as const;

export const DEFAULT_DATE_LABEL = DATE_OPTIONS[0].label;
export const DEFAULT_TIME_LABEL = "19:00";
