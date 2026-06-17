export const EMAIL_COMMUNICATION_KEYS = [
  "marketing",
  "newsletter",
  "productUpdates",
  "events",
  "partner"
] as const;

export const IN_APP_COMMUNICATION_KEYS = [
  "featureTips",
  "productSuggestions",
  "usageInsights",
  "promotions"
] as const;

export type EmailCommunicationKey = (typeof EMAIL_COMMUNICATION_KEYS)[number];
export type InAppCommunicationKey = (typeof IN_APP_COMMUNICATION_KEYS)[number];

export type EmailCommunicationPrefs = Record<EmailCommunicationKey, boolean>;
export type InAppCommunicationPrefs = Record<InAppCommunicationKey, boolean>;

export type CommunicationPrefsSnapshot = {
  email: EmailCommunicationPrefs;
  inApp: InAppCommunicationPrefs;
};

export const DEFAULT_EMAIL_COMMUNICATION_PREFS: EmailCommunicationPrefs = {
  marketing: true,
  newsletter: true,
  productUpdates: true,
  events: true,
  partner: false
};

export const DEFAULT_IN_APP_COMMUNICATION_PREFS: InAppCommunicationPrefs = {
  featureTips: true,
  productSuggestions: true,
  usageInsights: true,
  promotions: false
};

export const DEFAULT_COMMUNICATION_PREFS: CommunicationPrefsSnapshot = {
  email: DEFAULT_EMAIL_COMMUNICATION_PREFS,
  inApp: DEFAULT_IN_APP_COMMUNICATION_PREFS
};

/** URL `type` query aliases from email footers → preference keys. */
export const COMMUNICATION_TYPE_ALIASES: Record<string, EmailCommunicationKey | InAppCommunicationKey> = {
  marketing: "marketing",
  newsletter: "newsletter",
  product: "productUpdates",
  product_updates: "productUpdates",
  productupdates: "productUpdates",
  events: "events",
  event: "events",
  partner: "partner",
  feature_tips: "featureTips",
  featuretips: "featureTips",
  tips: "featureTips",
  suggestions: "productSuggestions",
  insights: "usageInsights",
  promotions: "promotions"
};

export const TRANSACTIONAL_ALWAYS_ON = [
  "Security alerts",
  "Password resets and login alerts",
  "Billing invoices and payment receipts",
  "Legal and compliance notices",
  "Staff invitations and account verification"
] as const;
