import type { LegalSlug } from "./types";

export type { LegalSlug };

export const LEGAL_SLUGS: LegalSlug[] = [
  "center",
  "privacy",
  "cookies",
  "terms",
  "dpa",
  "security",
  "subprocessors",
  "data-retention",
  "acceptable-use",
  "responsible-disclosure",
  "billing",
  "gdpr-request"
];

export function isLegalSlug(value: string): value is LegalSlug {
  return (LEGAL_SLUGS as string[]).includes(value);
}

export function pathForLegalSlug(slug: LegalSlug): string {
  return slug === "center" ? "/legal" : `/legal/${slug}`;
}

const LEGACY_LEGAL_PATHS: Record<string, LegalSlug> = {
  "/privacy": "privacy",
  "/terms": "terms"
};

export function legalSlugFromPath(pathname: string): LegalSlug {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path in LEGACY_LEGAL_PATHS) return LEGACY_LEGAL_PATHS[path];
  if (path === "/legal") return "center";
  const match = path.match(/^\/legal\/([a-z-]+)$/);
  if (match && isLegalSlug(match[1])) return match[1];
  return "center";
}

export const LEGAL_FOOTER_LINKS: Array<{ label: string; slug: LegalSlug }> = [
  { label: "Privacy Policy", slug: "privacy" },
  { label: "Cookie Policy", slug: "cookies" },
  { label: "Terms of Service", slug: "terms" },
  { label: "Data Processing Agreement (DPA)", slug: "dpa" },
  { label: "Security & Compliance", slug: "security" },
  { label: "Legal Center", slug: "center" }
];

export const LEGAL_PATHS = {
  privacy: "/legal/privacy",
  cookies: "/legal/cookies",
  terms: "/legal/terms",
  dpa: "/legal/dpa",
  security: "/legal/security",
  center: "/legal"
} as const;
