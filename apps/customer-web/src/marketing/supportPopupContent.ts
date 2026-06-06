/** Copy for the global support drawer (marketing site). */

export const SUPPORT_POPUP_FAQS = [
  {
    id: "migration",
    q: "Can we migrate from our current POS or reservation system?",
    a: "Yes. We support phased migration — menu and staff first, then orders and reservations — so you avoid a risky single-night cutover."
  },
  {
    id: "hardware",
    q: "Do we need new hardware?",
    a: "No. ServeOS works with existing tablets, monitors, kitchen displays, Stripe, Swish, printers, and many POS setups."
  },
  {
    id: "locations",
    q: "Does ServeOS support multiple locations?",
    a: "Growth and Enterprise plans include multi-venue permissions, shared reporting, and location-scoped staff access."
  }
] as const;

export const SUPPORT_POPUP_TITLE = "Support center";
export const SUPPORT_POPUP_SUBTITLE = "Help for operators, staff admins, and technical teams.";
