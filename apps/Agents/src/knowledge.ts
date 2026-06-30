/** Built-in ServeOS support knowledge — local only, no API keys. */

export const SERVEOS_SUPPORT_GREETING = "How can I help you with ServeOS?";

export type ServeosSupportEntry = {
  id: string;
  /** Single words or short terms to match */
  keywords: string[];
  /** Multi-word phrases — weighted higher when matched */
  phrases?: string[];
  reply: string;
};

/** Product areas covered in fallback and overview replies */
export const SERVEOS_PRODUCT_AREAS = [
  "QR menus & online ordering",
  "live orders & kitchen workflow",
  "reservations & walk-ins",
  "menu, modifiers & categories",
  "staff, roles & permissions",
  "Stripe, Swish & checkout",
  "analytics & sales reports",
  "multi-location workspaces",
  "owner mobile app & web admin"
] as const;

export const SERVEOS_PLATFORM_OVERVIEW_REPLY = `ServeOS is an all-in-one restaurant platform:
1. Customers scan a QR code to browse your menu, customize items, pay, and track orders.
2. Your team manages live orders, reservations, and walk-ins from mobile or web admin.
3. Owners set up menus, staff, payments, opening hours, and reports in the admin dashboard.
Ask about any area — setup, orders, reservations, payments, staff, or trials.`;

export const SERVEOS_SUPPORT_TOPICS: ServeosSupportEntry[] = [
  {
    id: "overview",
    keywords: ["serveos", "platform", "product", "what is", "about", "ecosystem", "suite"],
    phrases: ["what is serveos", "what does serveos do", "how does serveos work", "tell me about serveos"],
    reply: SERVEOS_PLATFORM_OVERVIEW_REPLY
  },
  {
    id: "getting-started",
    keywords: ["start", "started", "setup", "set up", "onboard", "onboarding", "new restaurant", "first time"],
    phrases: ["get started", "how do i start", "set up my restaurant", "new to serveos"],
    reply:
      "Getting started:\n1. Sign up and create your workspace (14-day free trial).\n2. Add your restaurant profile and opening hours.\n3. Build your menu — categories, items, modifiers.\n4. Connect Stripe/Swish in Payment settings.\n5. Share your QR menu link and accept your first order."
  },
  {
    id: "trial-pricing",
    keywords: ["trial", "free", "pricing", "price", "cost", "plan", "subscription", "billing", "upgrade", "credit card"],
    phrases: ["free trial", "how much", "how does pricing work", "do i need a credit card"],
    reply:
      "Start with core menu and orders free for 14 days — no credit card required to explore. Upgrade when you're ready. Subscription and billing are managed in admin under Settings → Subscription."
  },
  {
    id: "migration",
    keywords: ["migrate", "migration", "pos", "switch", "move", "import", "existing system", "cutover"],
    phrases: ["migrate from", "switch from", "move from our pos"],
    reply:
      "Yes — phased migration is supported. Typical order: menu and staff first, then orders and reservations. That avoids a risky single-night cutover. Tell your onboarding contact which system you use today."
  },
  {
    id: "hardware",
    keywords: ["hardware", "tablet", "ipad", "printer", "monitor", "kds", "device", "equipment", "kitchen display"],
    phrases: ["new hardware", "need new devices", "kitchen display system"],
    reply:
      "No new hardware required. ServeOS runs on existing tablets, phones, monitors, kitchen displays, Stripe/Swish terminals, and many printers and POS setups."
  },
  {
    id: "multi-location",
    keywords: ["location", "locations", "multi", "venue", "venues", "franchise", "chain", "branch"],
    phrases: ["multiple locations", "multi venue", "more than one restaurant"],
    reply:
      "Growth and Enterprise plans support multiple venues: location-scoped staff permissions, shared reporting, and per-venue menus and settings."
  },
  {
    id: "menu-admin",
    keywords: ["menu", "category", "categories", "item", "items", "modifier", "modifiers", "addon", "add-on", "publish"],
    phrases: ["edit menu", "add menu item", "create category", "modifier group", "menu management"],
    reply:
      "Menu setup (web admin):\n1. Open Menu → Categories → add or reorder categories.\n2. Add items with price, description, and availability.\n3. Attach modifier groups (sizes, extras, required choices).\n4. Publish — changes sync to QR menus and customer ordering."
  },
  {
    id: "customer-ordering",
    keywords: ["qr", "scan", "customer", "guest", "dine", "order online", "ordering", "browse"],
    phrases: ["qr code", "qr menu", "customer orders", "how do customers order", "online ordering"],
    reply:
      "Customers scan your venue QR code (or open your ordering link), browse categories, pick modifiers, add to cart, pay at checkout, and track order status in real time."
  },
  {
    id: "cart-checkout",
    keywords: ["cart", "checkout", "basket", "pay", "payment", "apple pay", "google pay"],
    phrases: ["add to cart", "place order", "checkout flow", "pay for order"],
    reply:
      "Cart & checkout: customers add items with modifiers, review the cart, then pay via Stripe, Swish, or Apple/Google Pay where enabled. They see confirmation and live order status after payment."
  },
  {
    id: "order-tracking",
    keywords: ["track", "tracking", "status", "where is my order", "ready", "preparing", "completed"],
    phrases: ["order status", "track my order", "order progress", "when will my order be ready"],
    reply:
      "After placing an order, customers see live status updates (e.g. received, preparing, ready). Staff update status from the live orders feed — changes sync instantly to the customer view."
  },
  {
    id: "live-orders",
    keywords: ["live", "feed", "accept", "reject", "incoming", "new order", "order list"],
    phrases: ["live orders", "accept orders", "order feed", "manage orders"],
    reply:
      "Live orders appear in the admin dashboard and mobile app. Accept or reject new orders, update status step by step, and open order details for items, notes, and customer info."
  },
  {
    id: "order-details",
    keywords: ["order detail", "line items", "notes", "special request", "kitchen ticket"],
    phrases: ["view order details", "order notes", "what's in the order"],
    reply:
      "Open any order from the live feed or Orders list to see line items, modifiers, customer notes, totals, payment status, and status history. Update status from that screen."
  },
  {
    id: "reservations",
    keywords: ["reservation", "reservations", "booking", "book", "table", "party", "guests", "seats"],
    phrases: ["make a reservation", "book a table", "reservation list", "manage bookings"],
    reply:
      "Reservations: view and manage bookings in admin or mobile. Create reservations with date, time, party size, and notes. Staff can update status as guests arrive or are seated."
  },
  {
    id: "walk-ins",
    keywords: ["walk-in", "walk in", "walkin", "no reservation", "queue", "waitlist"],
    phrases: ["walk in guest", "without reservation"],
    reply:
      "Walk-ins are managed alongside reservations. Add walk-in parties, assign tables when ready, and keep floor status updated from the mobile app or admin."
  },
  {
    id: "staff",
    keywords: ["staff", "employee", "team", "invite", "hiring", "member"],
    phrases: ["add staff", "invite staff", "staff account", "team member"],
    reply:
      "Staff management:\n1. Admin → Staff → invite by email.\n2. Assign role (owner, manager, staff, etc.).\n3. Set venue permissions so access matches their job.\nStaff sign in via the mobile app or web admin."
  },
  {
    id: "roles-permissions",
    keywords: ["role", "roles", "permission", "permissions", "access", "manager", "owner"],
    phrases: ["role based", "who can access", "staff permissions", "venue permissions"],
    reply:
      "Roles control what each person can do (menus, orders, payments, staff, settings). Permissions can be scoped per venue on multi-location plans. Adjust these in Staff management."
  },
  {
    id: "payments-setup",
    keywords: ["stripe", "swish", "connect", "payout", "transaction", "refund"],
    phrases: ["connect stripe", "set up swish", "payment settings", "transaction history"],
    reply:
      "Payments: connect Stripe and Swish in admin → Configuration → Payments. Customers pay at checkout; you review transactions and payment status in admin. Payouts follow your Stripe/Swish account rules."
  },
  {
    id: "analytics",
    keywords: ["analytics", "report", "reports", "revenue", "sales", "kpi", "dashboard", "chart", "today"],
    phrases: ["sales report", "how much revenue", "analytics dashboard", "today's orders"],
    reply:
      "The main dashboard shows KPIs: today's revenue, order counts, and alerts. Deeper sales reports are in Analytics. Mobile gives a quick today overview for owners on the go."
  },
  {
    id: "kds",
    keywords: ["kitchen", "kds", "display", "cook", "prep", "ticket", "expo"],
    phrases: ["kitchen display", "kitchen screen", "kds system"],
    reply:
      "Kitchen workflow: live orders appear on kitchen displays or tablets. Staff bump order status as items are prepared. ServeOS also integrates with external KDS setups where configured."
  },
  {
    id: "notifications",
    keywords: ["notification", "notifications", "alert", "alerts", "push", "email", "sms"],
    phrases: ["push notification", "order alert", "not getting notifications"],
    reply:
      "ServeOS sends order and system alerts via push (mobile), email, and in-app notifications. Check notification settings on your device and in Profile → notifications if alerts seem missing."
  },
  {
    id: "profile-settings",
    keywords: ["profile", "settings", "account", "preferences", "theme", "dark mode"],
    phrases: ["my profile", "account settings", "change settings"],
    reply:
      "Profile & settings: update your name, contact info, and preferences in Profile. Restaurant-level settings (hours, payments, staff) live in admin Configuration and Venue profile."
  },
  {
    id: "venue-profile",
    keywords: ["restaurant profile", "venue", "opening hours", "hours", "address", "name", "logo"],
    phrases: ["opening hours", "restaurant details", "venue profile", "update address"],
    reply:
      "Venue profile: set restaurant name, address, contact, logo, and opening hours in admin → Configuration or Venue profile. Hours affect when customers can order and book."
  },
  {
    id: "mobile-app",
    keywords: ["mobile", "app", "iphone", "android", "expo", "phone"],
    phrases: ["mobile app", "download app", "use on phone", "owner app"],
    reply:
      "The ServeOS mobile app is for owners, staff, and customers. Owners/staff get live orders, reservations, walk-ins, quick menu view, payments status, and notifications. Customers order via QR web or app flows."
  },
  {
    id: "web-admin",
    keywords: ["admin", "dashboard", "desktop", "web", "control panel", "back office"],
    phrases: ["web admin", "admin dashboard", "desktop admin", "management panel"],
    reply:
      "Web admin is the control center: menus, orders, reservations, staff, payments, analytics, and configuration. Desktop is best for setup; day-to-day ops also work on mobile."
  },
  {
    id: "realtime",
    keywords: ["realtime", "real-time", "real time", "sync", "instant", "live update", "websocket"],
    phrases: ["real time updates", "orders not updating", "sync delay"],
    reply:
      "Orders, chat, and status changes use real-time sync. If updates lag, refresh the page or app and check your connection. Persistent issues — note the screen and time so support can investigate."
  },
  {
    id: "auth-login",
    keywords: ["login", "log in", "signin", "sign in", "signup", "sign up", "register", "password", "reset", "otp", "2fa", "two factor"],
    phrases: ["forgot password", "can't log in", "create account", "reset password"],
    reply:
      "Sign in with email and password. Owners start a free trial from the website. Staff join via invite link. Use Forgot password on the login screen to reset. Roles determine mobile vs admin access."
  },
  {
    id: "chat-support",
    keywords: ["human", "person", "agent", "team", "contact", "email", "demo", "sales"],
    phrases: ["talk to someone", "human support", "contact support", "book a demo"],
    reply:
      "I'm ServeOS AI for quick answers. For onboarding, sales, or complex issues, use Send us a message in this support panel or email the team — a person can take over."
  },
  {
    id: "integrations",
    keywords: ["integration", "integrate", "checkout screen", "quick checkout", "external", "api"],
    phrases: ["integrate with", "existing checkout", "payment integration"],
    reply:
      "ServeOS integrates with Stripe, Swish, kitchen displays, and existing checkout flows where configured. Small venues can use ServeOS checkout screens end-to-end. Tell us what you already use during onboarding."
  },
  {
    id: "bugs",
    keywords: ["bug", "broken", "error", "crash", "glitch", "not working", "issue", "problem", "stuck", "freeze"],
    phrases: ["something is wrong", "doesn't work", "keeps failing"],
    reply:
      "Sorry that blocked you. Share: what you were doing, which screen (admin, mobile, or customer QR), and what you expected vs what happened. Try a refresh or sign-out/in first. The team can dig deeper if it persists."
  },
  {
    id: "customer-account",
    keywords: ["loyalty", "rewards", "order history", "customer account", "guest checkout"],
    phrases: ["order history", "customer login", "save my orders"],
    reply:
      "Customers can order via QR without an account. Order history and loyalty are on the roadmap — today, focus is on fast menu browse, cart, pay, and live tracking."
  }
];

/** Natural-language Q&A pairs — strong match for full-sentence prompts */
export const SERVEOS_SUPPORT_FAQS: ServeosSupportEntry[] = [
  {
    id: "faq-what-is",
    keywords: ["what is serveos", "explain serveos", "describe serveos"],
    reply: SERVEOS_PLATFORM_OVERVIEW_REPLY
  },
  {
    id: "faq-owner-vs-staff",
    keywords: ["owner", "staff", "difference", "customer role"],
    phrases: ["difference between owner and staff", "who uses what"],
    reply:
      "Owners set up the venue, menus, payments, and staff. Staff run day-to-day ops: orders, reservations, walk-ins. Customers order via QR — no admin access."
  },
  {
    id: "faq-qr-setup",
    keywords: ["qr code", "generate", "print", "link"],
    phrases: ["how do i get a qr code", "share menu link"],
    reply:
      "After your menu is published, your venue ordering link/QR is available from admin (venue or deployment settings). Print it for tables or share digitally — customers open it to order."
  },
  {
    id: "faq-modifiers",
    keywords: ["modifier", "extra", "topping", "size", "option"],
    phrases: ["how do modifiers work", "add extras to items"],
    reply:
      "On each menu item, add a modifier group (e.g. Size, Toppings). Set min/max selections and options with optional price deltas. Customers choose them on the product screen before adding to cart."
  },
  {
    id: "faq-cancel-order",
    keywords: ["cancel", "refund", "void"],
    phrases: ["cancel an order", "refund customer"],
    reply:
      "Update order status from the orders list or live feed. Full refund/cancel flows depend on payment method and policy — check order details and payment settings, or contact support for edge cases."
  },
  {
    id: "faq-hours",
    keywords: ["closed", "open", "hours", "after hours"],
    phrases: ["order when closed", "outside opening hours"],
    reply:
      "Opening hours in venue profile control when ordering and booking are available. Update hours in admin → Configuration or Venue profile if customers can't order when you expect."
  },
  {
    id: "faq-swish-stripe",
    keywords: ["swish", "stripe", "both", "which payment"],
    phrases: ["swish or stripe", "payment methods"],
    reply:
      "You can enable Stripe (cards, Apple/Google Pay) and Swish. Configure both in Payment settings so customers see what's available at checkout."
  },
  {
    id: "faq-data-safe",
    keywords: ["secure", "security", "safe", "gdpr", "data", "privacy"],
    phrases: ["is my data safe", "security"],
    reply:
      "ServeOS uses encrypted auth, role-based access, and secure payment providers (Stripe/Swish). Only permitted staff see venue data. See our privacy policy on the website for details."
  }
];

export const SERVEOS_SUPPORT_FALLBACK = `I can help across ServeOS: ${SERVEOS_PRODUCT_AREAS.join(", ")}.
Ask in your own words — e.g. "How do I set up Swish?" or "How do reservations work?"`;
