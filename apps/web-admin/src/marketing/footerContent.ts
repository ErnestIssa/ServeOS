import type { NavAction } from "./navContent";
import { iconPath } from "./assetPaths";
import { linkHoverShift } from "./styles";

export const FOOTER_SUPPORT_EMAIL = "support@serveos.com";
export const FOOTER_PHONE_DISPLAY = "+46 8-120 524 10";
export const FOOTER_ADDRESS_LINES = ["Jyllandsgatan 112", "164 47 Kista"] as const;
export const FOOTER_HOURS = "Monday–Friday: 10:00 – 16:00";

export type FooterLinkItem = {
  label: string;
  action: NavAction;
};

export type FooterLinkGroup = {
  id: string;
  title: string;
  items: FooterLinkItem[];
};

const scroll = (targetId: string): NavAction => ({ type: "scroll", targetId });

export const FOOTER_COMPANY: FooterLinkGroup = {
  id: "company",
  title: "Company",
  items: [
    { label: "About ServeOS", action: scroll("final-cta") },
    { label: "News & updates", action: scroll("faq") },
    { label: "Partners", action: scroll("faq") }
  ]
};

export const FOOTER_SUPPORT: FooterLinkGroup = {
  id: "support",
  title: "Support",
  items: [
    { label: "Help center", action: scroll("faq") },
    { label: "Product guides", action: { type: "how-it-works" } },
    { label: "Subscription management", action: scroll("pricing") },
    {
      label: "Contact support",
      action: { type: "external", url: `mailto:${FOOTER_SUPPORT_EMAIL}` }
    },
    { label: "Training resources", action: scroll("faq") },
    {
      label: "Migration assistance",
      action: { type: "external", url: `mailto:${FOOTER_SUPPORT_EMAIL}?subject=ServeOS%20migration` }
    }
  ]
};

export const FOOTER_SOLUTIONS: FooterLinkGroup = {
  id: "solutions",
  title: "Restaurant solutions",
  items: [
    { label: "Restaurants", action: scroll("solutions") },
    { label: "Cafés", action: scroll("solutions") },
    { label: "Bars", action: scroll("solutions") },
    { label: "Food trucks", action: scroll("solutions") },
    { label: "Hotels", action: scroll("solutions") },
    { label: "Multi-location operations", action: scroll("solutions") },
    { label: "Enterprise solutions", action: scroll("pricing") }
  ]
};

export const FOOTER_LEGAL: FooterLinkItem[] = [
  { label: "Privacy policy", action: scroll("faq") },
  { label: "Cookie policy", action: scroll("faq") },
  { label: "Terms of service", action: scroll("faq") },
  { label: "Data processing agreement", action: scroll("faq") },
  { label: "Security & compliance", action: scroll("faq") }
];

export const FOOTER_APP_STORES = [
  {
    label: "Download on the App Store",
    shortLabel: "App Store",
    href: "https://apps.apple.com/us/iphone/search?term=serveos",
    iconSrc: iconPath("apple-173-svgrepo-com.svg"),
    iconClass: "h-5 w-5 shrink-0 brightness-0 invert"
  },
  {
    label: "Get it on Google Play",
    shortLabel: "Google Play",
    href: "https://play.google.com/store/search?q=serveos&c=apps",
    iconSrc: iconPath("google-play-svgrepo-com.svg"),
    iconClass: "h-5 w-5 shrink-0"
  }
] as const;

export const FOOTER_SOCIAL = [
  { label: "LinkedIn", href: "https://www.linkedin.com/", iconSrc: iconPath("linkedin.png") },
  { label: "Instagram", href: "https://www.instagram.com/", iconSrc: iconPath("instagram.png") },
  { label: "TikTok", href: "https://www.tiktok.com/", iconSrc: iconPath("social-media.png") }
] as const;

export const FOOTER_SECTION_TITLE =
  "text-sm font-extrabold uppercase tracking-[0.1em] text-violet-400 sm:text-base";

export const FOOTER_LINK_HOVER = linkHoverShift;

export const FOOTER_LINK_COLUMNS = [FOOTER_COMPANY, FOOTER_SUPPORT, FOOTER_SOLUTIONS];
