export const EMAIL_PREFERENCE_ITEMS = [
  {
    key: "marketing",
    label: "Marketing emails",
    hint: "Product updates, promotions, and announcements from ServeOS."
  },
  {
    key: "newsletter",
    label: "Newsletter",
    hint: "Weekly insights, restaurant trends, and operational tips."
  },
  {
    key: "productUpdates",
    label: "Product updates",
    hint: "New features, UI changes, improvements, and beta invites."
  },
  {
    key: "events",
    label: "Event invitations",
    hint: "Demos, training sessions, and live onboarding webinars."
  },
  {
    key: "partner",
    label: "Partner communications",
    hint: "Integrations, ecosystem tools, and marketplace announcements."
  }
] as const;

export const IN_APP_PREFERENCE_ITEMS = [
  {
    key: "featureTips",
    label: "Feature tips",
    hint: "Short in-app tips to help you get more from ServeOS."
  },
  {
    key: "productSuggestions",
    label: "Product suggestions",
    hint: "Ideas based on how your workspace is set up."
  },
  {
    key: "usageInsights",
    label: "Usage insights",
    hint: "Occasional summaries of activity and opportunities."
  },
  {
    key: "promotions",
    label: "Promotions",
    hint: "Optional upsell or plan-related prompts inside the app."
  }
] as const;

export const TRANSACTIONAL_ALWAYS_ON = [
  "Security alerts",
  "Password resets and login alerts",
  "Billing invoices and payment receipts",
  "Legal and compliance notices",
  "Staff invitations and account verification"
] as const;

export type EmailPreferenceKey = (typeof EMAIL_PREFERENCE_ITEMS)[number]["key"];
export type InAppPreferenceKey = (typeof IN_APP_PREFERENCE_ITEMS)[number]["key"];

export type CommunicationPreferencesState = {
  email: Record<EmailPreferenceKey, boolean>;
  inApp: Record<InAppPreferenceKey, boolean>;
};
