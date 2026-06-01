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

export const SEATING_CARD_OPTIONS = [
  { id: "Any", label: "Any", sublabel: "Best available" },
  { id: "Window", label: "Window", sublabel: "Scenic" },
  { id: "Booth", label: "Booth", sublabel: "Cozy" },
  { id: "Bar", label: "Bar", sublabel: "Casual" },
  { id: "Quiet corner", label: "Quiet corner", sublabel: "Low noise" }
] as const;

export const OCCASION_OPTIONS = ["Casual", "Date night", "Business", "Celebration", "Birthday"] as const;

export const OCCASION_CARD_OPTIONS = [
  { id: "Casual", label: "Casual", sublabel: "Everyday dining" },
  { id: "Date night", label: "Date night", sublabel: "Table for two" },
  { id: "Business", label: "Business", sublabel: "Meetings" },
  { id: "Celebration", label: "Celebration", sublabel: "Special night" },
  { id: "Birthday", label: "Birthday", sublabel: "Cake friendly" }
] as const;

/** Swipeable accessibility cards (step 2) — auth signup–style tones with detail bullets. */
export const ACCESSIBILITY_CARD_OPTIONS = [
  {
    id: "none",
    label: "No special needs",
    title: "Standard visit",
    bullets: ["No extra setup needed", "Flexible seating assignment", "Works for most bookings"]
  },
  {
    id: "step_free",
    label: "Step-free access",
    title: "Step-free access",
    bullets: ["Ramp or level entry", "No stairs to your table", "Host notified before arrival"]
  },
  {
    id: "high_chair",
    label: "High chair",
    title: "High chair",
    bullets: ["Secure seat for little ones", "Placed near your table", "Set up before you sit"]
  },
  {
    id: "wheelchair",
    label: "Wheelchair space",
    title: "Wheelchair space",
    bullets: ["Room to manoeuvre", "Accessible route to table", "Staff ready to assist"]
  },
  {
    id: "quiet",
    label: "Quiet table",
    title: "Quiet table",
    bullets: ["Lower noise area", "Away from speakers & kitchen", "Better for conversation"]
  }
] as const;

export type AccessibilityCardOption = (typeof ACCESSIBILITY_CARD_OPTIONS)[number];

export const ACCESSIBILITY_OPTIONS = ACCESSIBILITY_CARD_OPTIONS.map((o) => ({
  id: o.id,
  label: o.label
}));

export const BRANCH_OPTIONS = [
  { id: "main", label: "Main dining room", sublabel: "Full menu" },
  { id: "terrace", label: "Terrace", sublabel: "Weather permitting" },
  { id: "lounge", label: "Private lounge", sublabel: "Groups 6+" }
] as const;

/** Step 1 experience carousel — branches + quick picks (portrait cards, multi-select). */
export const EXPERIENCE_CARD_OPTIONS = [
  {
    id: "main",
    label: "Main dining room",
    title: "Main dining room",
    bullets: ["Full menu available", "Classic dining room", "Best for most visits"]
  },
  {
    id: "terrace",
    label: "Terrace",
    title: "Terrace",
    bullets: ["Outdoor seating", "Weather permitting", "Fresh-air dining"]
  },
  {
    id: "lounge",
    label: "Private lounge",
    title: "Private lounge",
    bullets: ["Groups of 6 or more", "More private setting", "Host will confirm layout"]
  },
  {
    id: "quiet",
    label: "Quiet table",
    title: "Quiet table",
    bullets: ["Best for two guests", "Lower noise area", "Away from speakers"]
  },
  {
    id: "early",
    label: "Earlier slot",
    title: "Earlier slot",
    bullets: ["18:00–18:30 seating", "Often easier to book", "Great before the rush"]
  },
  {
    id: "booth",
    label: "Booth",
    title: "Booth",
    bullets: ["Cozy booth seating", "Comfortable for groups", "Popular choice"]
  }
] as const;

export type ExperienceCardOption = (typeof EXPERIENCE_CARD_OPTIONS)[number];

export const EXPERIENCE_BRANCH_IDS = new Set<string>(BRANCH_OPTIONS.map((b) => b.id));

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

export const FLOOR_ZONE_CARD_OPTIONS = [
  { id: "main", label: "Main floor", sublabel: "Full dining room" },
  { id: "terrace", label: "Terrace", sublabel: "Outdoor seating" },
  { id: "bar", label: "Bar area", sublabel: "High tops" },
  { id: "lounge", label: "Lounge", sublabel: "Quiet corner" }
] as const;

export const WAITLIST_CARD_OPTION = {
  id: "waitlist",
  label: "Join waitlist",
  sublabel: "We'll text when a table opens"
} as const;

export const CONFIRMATION_EXTRA_CARD_OPTIONS = [
  { id: "remind", label: "Remind me before", sublabel: "1 hr & 15 min" },
  { id: "late", label: "Running late", sublabel: "Notify the host" },
  { id: "calendar", label: "Add to calendar", sublabel: "Apple / Google" }
] as const;

export const BOOK_AGAIN_CARD_OPTION = {
  id: "book_again",
  label: "Make another booking",
  sublabel: "New date, time & preferences"
} as const;

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
