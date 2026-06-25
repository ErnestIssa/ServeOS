/** Stable pick for the day + time bucket so greetings rotate but don’t flicker every render. */
function pickIndex(seed: string, modulo: number): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % modulo;
}

export type TimeBucket = "morning" | "afternoon" | "evening" | "late";

export function getTimeBucket(hours = new Date().getHours()): TimeBucket {
  if (hours >= 5 && hours < 12) return "morning";
  if (hours < 17) return "afternoon";
  if (hours < 22) return "evening";
  return "late";
}

export function customerDisplayName(signupProfile: unknown, email?: string | null): string {
  if (signupProfile && typeof signupProfile === "object" && "firstName" in signupProfile) {
    const raw = String((signupProfile as { firstName?: string }).firstName ?? "").trim();
    if (raw) return raw.split(/\s+/)[0] ?? "there";
  }
  if (email && email.includes("@")) {
    const local = email.split("@")[0]?.split(/[._+-]/)[0]?.trim();
    if (local && local.length > 0) {
      return local.charAt(0).toUpperCase() + local.slice(1).toLowerCase();
    }
  }
  return "there";
}

type HeaderArgs = {
  firstName: string;
  restaurantName?: string | null;
  cartCount: number;
  hasVenue: boolean;
  /** When false and `hasVenue`, home copy explains the venue has no published menu yet. */
  hasBrowsableMenu?: boolean;
  /** Lowercase phrase from `mobileExperience.activeExperience` — e.g. "customer", "manager". */
  userRoleExperience?: string;
};

/** User-facing experience noun from backend manifest (SSOT for role/experience label). */
export function formatUserRoleExperience(
  activeExperience?: { mode?: string; label?: string; roleLabel?: string } | null
): string {
  if (!activeExperience) return "ServeOS";
  if (activeExperience.mode === "CUSTOMER") return "customer";
  const role = activeExperience.roleLabel?.trim();
  if (role) return role.toLowerCase();
  const label = activeExperience.label?.trim();
  if (label && label.toLowerCase() !== "workspace") return label.toLowerCase();
  return "ServeOS";
}

const NO_VENUE_SUBS: readonly string[] = [
  "{{name}}, choose a venue to browse the menu and get more from your {{experience}} experience.",
  "Pick a bar, restaurant, or venue — your {{experience}} experience comes alive once you're connected.",
  "Set your venue to see what's on offer and order in a few taps, {{name}}.",
  "{{name}}, your menu and orders start with one venue — take a moment to choose yours."
];

const NO_MENU_SUBS: readonly string[] = [
  "{{venue}} doesn't have a menu for customers yet. Switch venue to browse dishes and place orders.",
  "Nothing is published on the menu at **{{venue}}** right now. Try another venue, {{name}}.",
  "{{name}}, **{{venue}}** isn't serving a menu in the app yet — switch venue to keep exploring.",
  "The kitchen at **{{venue}}** hasn't published a menu yet. Pick another venue when you're ready."
];

const GREETINGS: Record<TimeBucket, readonly string[]> = {
  morning: [
    "Good morning, {{name}} ☀️",
    "Rise and shine, {{name}}",
    "Morning, {{name}} — let’s eat well today.",
    "Start your day right, {{name}} ☀️"
  ],
  afternoon: [
    "Good afternoon, {{name}}",
    "Hey {{name}} — perfect time for a bite.",
    "Afternoon fuel, {{name}}?",
    "Taking a break, {{name}}? We’ve got you."
  ],
  evening: [
    "Good evening, {{name}} 🌙",
    "Dinner time, {{name}} 🍽️",
    "Evening, {{name}} — the kitchen’s ready.",
    "Wind down with something delicious, {{name}}."
  ],
  late: [
    "Still up, {{name}}? 🌙",
    "Late cravings, {{name}}? We got you.",
    "Midnight munchies, {{name}}?",
    "Hungry, {{name}}? Let’s fix that."
  ]
};

const SUBS_WITH_VENUE: readonly string[] = [
  "Fresh meals are waiting for you at **{{venue}}**. Skip the wait and order in seconds.",
  "Your favorites at **{{venue}}** are just a tap away — made fresh, served fast.",
  "The kitchen at **{{venue}}** is ready. What are you craving?",
  "Skip the line. Order straight from **{{venue}}** in a few taps."
];

const SUBS_GENERIC: readonly string[] = [
  "Fresh meals ready in minutes. Pick a venue in Account, then order in seconds.",
  "Made fresh. Served fast. Choose your go-to spot and start browsing.",
  "Your table, your pace — order directly when you’re ready.",
  "The kitchen’s ready when you are. Set your venue below to dive in."
];

/** Strip markdown-style ** used only for subtle emphasis in UI (we render plain text). */
export function plainSub(text: string): string {
  return text.replace(/\*\*/g, "");
}

export function buildCustomerHomeHeader(args: HeaderArgs): { greeting: string; sub: string } {
  if (args.cartCount > 0) {
    return {
      greeting: `You're almost done, ${args.firstName}`,
      sub: args.restaurantName
        ? `Finish your order at ${args.restaurantName} — your cart is waiting.`
        : `Your cart's ready — checkout takes just a moment.`
    };
  }

  const bucket = getTimeBucket();
  const dayKey = new Date().toISOString().slice(0, 10);
  const seedBase = `${dayKey}|${bucket}|${args.firstName}`;

  const greetOpts = GREETINGS[bucket];
  const greeting = greetOpts[pickIndex(`greet|${seedBase}`, greetOpts.length)].replace(/\{\{name\}\}/g, args.firstName);

  if (!args.hasVenue) {
    const experience = args.userRoleExperience?.trim() || "ServeOS";
    const subRaw = NO_VENUE_SUBS[pickIndex(`novenue|${seedBase}`, NO_VENUE_SUBS.length)]
      .replace(/\{\{name\}\}/g, args.firstName)
      .replace(/\{\{experience\}\}/g, experience);
    return { greeting, sub: subRaw };
  }

  if (args.hasBrowsableMenu === false) {
    const venue = args.restaurantName?.trim() || "This venue";
    const subRaw = NO_MENU_SUBS[pickIndex(`nomenu|${seedBase}`, NO_MENU_SUBS.length)]
      .replace(/\{\{name\}\}/g, args.firstName)
      .replace(/\{\{venue\}\}/g, venue);
    return { greeting, sub: plainSub(subRaw) };
  }

  let sub: string;
  if (args.restaurantName?.trim()) {
    const list = SUBS_WITH_VENUE;
    sub = plainSub(list[pickIndex(`subv|${seedBase}`, list.length)].replace(/\{\{venue\}\}/g, args.restaurantName.trim()));
  } else {
    const list = SUBS_GENERIC;
    sub = plainSub(list[pickIndex(`subg|${seedBase}`, list.length)]);
  }

  return { greeting, sub };
}
