export type LegalSlug =
  | "center"
  | "privacy"
  | "cookies"
  | "terms"
  | "dpa"
  | "security"
  | "subprocessors"
  | "data-retention"
  | "acceptable-use"
  | "responsible-disclosure"
  | "billing"
  | "gdpr-request";

export type LegalBlock =
  | { kind: "p"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "sub"; title: string; blocks: LegalBlock[] }
  | { kind: "callout"; title: string; text: string }
  | { kind: "link"; label: string; slug: LegalSlug };

export type LegalSection = {
  id: string;
  title: string;
  blocks: LegalBlock[];
};

export type LegalRelatedLink = {
  label: string;
  slug: LegalSlug;
};

export type LegalPageDef = {
  slug: LegalSlug;
  title: string;
  eyebrow: string;
  summary: string;
  lastUpdated: string;
  sections: LegalSection[];
  relatedLinks?: LegalRelatedLink[];
};
