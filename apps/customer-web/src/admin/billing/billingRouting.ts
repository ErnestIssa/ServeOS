import { ADMIN_BILLING_HASHES } from "../adminTopHashes";

export type BillingLayout =
  | "subscription"
  | "invoices"
  | "payment-method"
  | "usage"
  | "history"
  | "features"
  | "security";

export type BillingCategory = {
  id: string;
  label: string;
  href: string;
  layout: BillingLayout;
  accent: "violet" | "emerald" | "sky" | "amber" | "rose" | "slate" | "indigo";
  tagline: string;
};

export const ADMIN_BILLING_CATEGORIES: BillingCategory[] = [
  {
    id: "subscription",
    label: "Subscription",
    href: ADMIN_BILLING_HASHES.subscription,
    layout: "subscription",
    accent: "violet",
    tagline: "How ServeOS earns from your workspace — plan, cycle, and renewal."
  },
  {
    id: "invoices",
    label: "Invoices",
    href: ADMIN_BILLING_HASHES.invoices,
    layout: "invoices",
    accent: "indigo",
    tagline: "SaaS invoices — not guest or order payments."
  },
  {
    id: "payment-method",
    label: "Payment Method",
    href: ADMIN_BILLING_HASHES.paymentMethod,
    layout: "payment-method",
    accent: "emerald",
    tagline: "Card on file for your ServeOS subscription only."
  },
  {
    id: "usage-limits",
    label: "Usage & Limits",
    href: ADMIN_BILLING_HASHES.usageLimits,
    layout: "usage",
    accent: "sky",
    tagline: "Locations, staff, orders, and plan quotas."
  },
  {
    id: "billing-history",
    label: "Billing History",
    href: ADMIN_BILLING_HASHES.billingHistory,
    layout: "history",
    accent: "amber",
    tagline: "Audit trail of every billing event."
  },
  {
    id: "plan-features",
    label: "Plan Features",
    href: ADMIN_BILLING_HASHES.planFeatures,
    layout: "features",
    accent: "rose",
    tagline: "What your plan unlocks — and what upgrades add."
  },
  {
    id: "security",
    label: "Security",
    href: ADMIN_BILLING_HASHES.security,
    layout: "security",
    accent: "slate",
    tagline: "Stripe health, sync, tax details, and billing protection."
  }
];

export function isBillingCategoryHash(hash: string): boolean {
  return ADMIN_BILLING_CATEGORIES.some((c) => c.href === hash);
}

export function resolveBillingCategory(hash: string): BillingCategory | null {
  return ADMIN_BILLING_CATEGORIES.find((c) => c.href === hash) ?? null;
}

export function isBillingNavActive(hash: string): boolean {
  return isBillingCategoryHash(hash);
}
