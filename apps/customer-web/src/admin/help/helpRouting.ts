import { ADMIN_HELP_HASHES } from "../adminTopHashes";

export type HelpLayout = "tips" | "faqs" | "guides" | "troubleshooting";

export type HelpCategory = {
  id: string;
  label: string;
  href: string;
  layout: HelpLayout;
  accent: "violet" | "sky" | "emerald" | "amber";
  tagline: string;
};

export const ADMIN_HELP_CATEGORIES: HelpCategory[] = [
  {
    id: "tips-info",
    label: "Tips & Info",
    href: ADMIN_HELP_HASHES.tipsInfo,
    layout: "tips",
    accent: "violet",
    tagline: "Knowledge base — platform overview, roles, and setup guides."
  },
  {
    id: "faqs",
    label: "FAQs",
    href: ADMIN_HELP_HASHES.faqs,
    layout: "faqs",
    accent: "sky",
    tagline: "Quick answers to the most common ServeOS questions."
  },
  {
    id: "product-guides",
    label: "Product Guides",
    href: ADMIN_HELP_HASHES.productGuides,
    layout: "guides",
    accent: "emerald",
    tagline: "Step-by-step flows to get your venue live on ServeOS."
  },
  {
    id: "troubleshooting",
    label: "Basic Troubleshooting",
    href: ADMIN_HELP_HASHES.troubleshooting,
    layout: "troubleshooting",
    accent: "amber",
    tagline: "Fix common issues — orders, payments, devices, and login."
  }
];

export function isHelpCategoryHash(hash: string): boolean {
  return ADMIN_HELP_CATEGORIES.some((c) => c.href === hash);
}

export function resolveHelpCategory(hash: string): HelpCategory | null {
  return ADMIN_HELP_CATEGORIES.find((c) => c.href === hash) ?? null;
}

export function isHelpNavActive(hash: string): boolean {
  return isHelpCategoryHash(hash);
}
