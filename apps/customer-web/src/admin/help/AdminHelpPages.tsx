import { useState, type CSSProperties, type ReactNode } from "react";
import { isAdminHelpPageHash } from "../adminTopHashes";
import { resolveHelpCategory, type HelpCategory, type HelpLayout } from "./helpRouting";

const TIPS_ARTICLES = [
  { title: "Getting started guide", desc: "Create your workspace, add a venue, and invite your first team member." },
  { title: "Platform overview", desc: "How Control, Orders, Configuration, and Devices fit together." },
  { title: "Role explanations", desc: "Owner vs admin vs staff — who can change menus, billing, and payouts." },
  { title: "Order system guide", desc: "Live orders, kitchen view, statuses, and problem tickets." },
  { title: "Menu setup guide", desc: "Categories, items, modifiers, and publishing to guest channels." },
  { title: "Payments setup guide", desc: "Venue payment methods vs ServeOS subscription billing." },
  { title: "Device / KDS setup guide", desc: "Connect kitchen screens, printers, and monitor device health." }
] as const;

const FAQ_ITEMS = [
  {
    q: "How billing works",
    a: "ServeOS bills your workspace for the SaaS subscription — plans, invoices, and payment methods live under Billing in the top bar. Guest order payments are separate and configured under Configuration → Payments."
  },
  {
    q: "How to add staff",
    a: "Open Staff management from the top bar, send an invite by email, and assign a role. Managers approve access; owners can create additional venues."
  },
  {
    q: "How to create a menu",
    a: "Go to Configuration → Menu. Add categories, then items, then modifier groups and options. Changes apply to the active venue."
  },
  {
    q: "Why orders are delayed",
    a: "Check kitchen view for backlog, device connectivity under Devices, and auto-accept rules under Automations. Problem orders surface delays and refunds."
  },
  {
    q: "How refunds work",
    a: "Refunds for guest orders are handled in the order workflow and venue payment settings. ServeOS subscription refunds are managed through Billing → Invoices."
  },
  {
    q: "Troubleshooting login issues",
    a: "Confirm the invite was accepted, clear browser cache, and verify the correct email. Owners can resend invites from Staff management; staff should use the same sign-in method they registered with."
  }
] as const;

const PRODUCT_GUIDES = [
  {
    title: "Set up your first restaurant",
    steps: ["Create owner account", "Add venue name and location", "Select active venue in top bar", "Verify venue profile details"]
  },
  {
    title: "Create your first menu",
    steps: ["Open Configuration → Menu", "Add categories (e.g. Mains, Drinks)", "Add items with prices", "Add modifiers if needed", "Preview when publishing is enabled"]
  },
  {
    title: "Connect payment provider",
    steps: ["Open Configuration → Payments", "Connect Stripe or your provider", "Enable accepted methods", "Run a test order in staging", "Confirm payouts in Business settings"]
  },
  {
    title: "Set up KDS screen",
    steps: ["Register device under Devices", "Assign kitchen station", "Open Kitchen view in Orders", "Verify tickets appear in real time", "Check printer fallback if used"]
  }
] as const;

const TROUBLESHOOTING_ISSUES = [
  {
    title: "Orders not appearing",
    checks: [
      "Confirm the correct venue is selected in the top bar",
      "Refresh the Orders workspace or kitchen view",
      "Check Devices → KDS status is online",
      "Review Automations for auto-accept or routing rules blocking tickets"
    ]
  },
  {
    title: "Payments not syncing",
    checks: [
      "Verify payment provider connection under Configuration → Payments",
      "Check Billing → Security for webhook health (platform billing vs guest payments)",
      "Confirm order reached a paid status in order detail",
      "Allow a few minutes for provider webhooks to reconcile"
    ]
  },
  {
    title: "Device offline issues",
    checks: [
      "Open Devices → Hardware and network health",
      "Restart the KDS or printer on site",
      "Confirm venue Wi‑Fi or ethernet is stable",
      "Re-register the device if it stays offline beyond 5 minutes"
    ]
  },
  {
    title: "Login & access issues",
    checks: [
      "Use the email that received the invite",
      "Ask an owner to resend or approve pending access",
      "Try a private browser window to rule out cached sessions",
      "Reset password from the sign-in screen if needed"
    ]
  }
] as const;

function HelpHero({ category }: { category: HelpCategory }) {
  return (
    <header className={`admin-help-hero admin-help-hero--${category.accent}`}>
      <div className="admin-help-hero-glow" aria-hidden />
      <div className="admin-help-hero-inner">
        <p className="admin-help-hero-eyebrow">Platform help</p>
        <h1 className="admin-help-hero-title">{category.label}</h1>
        <p className="admin-help-hero-desc">{category.tagline}</p>
      </div>
    </header>
  );
}

function TipsLayout() {
  return (
    <div className="admin-help-layout admin-help-layout--tips">
      <p className="admin-help-section-label">Knowledge base</p>
      <div className="admin-help-library-grid">
        {TIPS_ARTICLES.map((article, i) => (
          <article key={article.title} className="admin-help-library-card" style={{ "--help-card-i": i } as CSSProperties}>
            <span className="admin-help-library-spine" aria-hidden />
            <h2 className="admin-help-library-title">{article.title}</h2>
            <p className="admin-help-library-desc">{article.desc}</p>
            <span className="admin-help-library-meta">Guide · ServeOS admin</span>
          </article>
        ))}
      </div>
    </div>
  );
}

function FaqsLayout() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  return (
    <div className="admin-help-layout admin-help-layout--faqs">
      <div className="admin-help-faq-stack">
        {FAQ_ITEMS.map((item, index) => {
          const open = openIndex === index;
          return (
            <div key={item.q} className={`admin-help-faq-item${open ? " admin-help-faq-item--open" : ""}`}>
              <button
                type="button"
                className="admin-help-faq-trigger"
                aria-expanded={open}
                onClick={() => setOpenIndex(open ? null : index)}
              >
                <span>{item.q}</span>
                <span className="admin-help-faq-chevron" aria-hidden>
                  ▾
                </span>
              </button>
              {open ? <p className="admin-help-faq-answer">{item.a}</p> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GuidesLayout() {
  return (
    <div className="admin-help-layout admin-help-layout--guides">
      <div className="admin-help-guide-grid">
        {PRODUCT_GUIDES.map((guide, gi) => (
          <article key={guide.title} className="admin-help-guide-card">
            <p className="admin-help-guide-index">Flow {gi + 1}</p>
            <h2 className="admin-help-guide-title">{guide.title}</h2>
            <ol className="admin-help-guide-steps">
              {guide.steps.map((step, si) => (
                <li key={step}>
                  <span className="admin-help-step-num">{si + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </article>
        ))}
      </div>
    </div>
  );
}

function TroubleshootingLayout() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  return (
    <div className="admin-help-layout admin-help-layout--troubleshooting">
      <div className="admin-help-fix-grid">
        {TROUBLESHOOTING_ISSUES.map((issue, index) => {
          const open = openIndex === index;
          return (
            <article key={issue.title} className={`admin-help-fix-card${open ? " admin-help-fix-card--open" : ""}`}>
              <button
                type="button"
                className="admin-help-fix-trigger"
                aria-expanded={open}
                onClick={() => setOpenIndex(open ? null : index)}
              >
                <span className="admin-help-fix-icon" aria-hidden>
                  ⚡
                </span>
                <span className="admin-help-fix-title">{issue.title}</span>
              </button>
              {open ? (
                <ul className="admin-help-fix-checks">
                  {issue.checks.map((check) => (
                    <li key={check}>{check}</li>
                  ))}
                </ul>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}

const LAYOUTS: Record<HelpLayout, () => ReactNode> = {
  tips: TipsLayout,
  faqs: FaqsLayout,
  guides: GuidesLayout,
  troubleshooting: TroubleshootingLayout
};

export function AdminHelpCategoryPage({ hash }: { hash: string }) {
  const category = resolveHelpCategory(hash);
  if (!category) return null;
  const Layout = LAYOUTS[category.layout];
  const pageId = hash.slice(1);

  return (
    <div id={pageId} className={`admin-help-page admin-help-page--${category.layout} admin-help-page--${category.accent}`}>
      <HelpHero category={category} />
      <div className="admin-help-stage">
        <Layout />
      </div>
    </div>
  );
}

export function AdminHelpPageRouter({ hash }: { hash: string }) {
  if (!isAdminHelpPageHash(hash)) return null;
  return <AdminHelpCategoryPage hash={hash} />;
}
