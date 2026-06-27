import { type ReactNode } from "react";
import { AdminBtnPrimary, AdminBtnSecondary } from "../AdminUi";
import { isAdminBillingPageHash } from "../adminTopHashes";
import { resolveBillingCategory, type BillingCategory, type BillingLayout } from "./billingRouting";

function BillHero({ category }: { category: BillingCategory }) {
  return (
    <header className={`admin-bill-hero admin-bill-hero--${category.accent}`}>
      <div className="admin-bill-hero-glow" aria-hidden />
      <div className="admin-bill-hero-inner">
        <p className="admin-bill-hero-eyebrow">ServeOS platform billing</p>
        <h1 className="admin-bill-hero-title">{category.label}</h1>
        <p className="admin-bill-hero-desc">{category.tagline}</p>
      </div>
    </header>
  );
}

function BillBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="admin-bill-block">
      <h2 className="admin-bill-block-title">{title}</h2>
      <div className="admin-bill-block-body">{children}</div>
    </section>
  );
}

function BillRow({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "success" | "warning" | "danger" | "muted" }) {
  return (
    <div className="admin-bill-row">
      <span className="admin-bill-row-label">{label}</span>
      <span className={`admin-bill-row-value admin-bill-row-value--${tone}`}>{value}</span>
    </div>
  );
}

function BillChip({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "success" | "warning" | "muted" | "violet" }) {
  return <span className={`admin-bill-chip admin-bill-chip--${tone}`}>{children}</span>;
}

function SubscriptionLayout() {
  return (
    <div className="admin-bill-layout admin-bill-layout--subscription">
      <div className="admin-bill-plan-card">
        <div className="admin-bill-plan-card-top">
          <BillChip tone="muted">Current plan</BillChip>
          <p className="admin-bill-plan-name">—</p>
          <p className="admin-bill-plan-tier">Free / Pro / Enterprise</p>
        </div>
        <div className="admin-bill-plan-meta">
          <BillRow label="Plan status" value="Not connected" tone="muted" />
          <BillRow label="Billing cycle" value="—" />
          <BillRow label="Renewal date" value="—" />
        </div>
        <div className="admin-bill-plan-actions">
          <AdminBtnPrimary disabled>Upgrade plan</AdminBtnPrimary>
          <AdminBtnSecondary disabled>Downgrade plan</AdminBtnSecondary>
          <AdminBtnSecondary disabled>Cancel subscription</AdminBtnSecondary>
        </div>
      </div>
      <BillBlock title="Billing status & risk">
        <div className="admin-bill-risk-grid">
          <div className="admin-bill-risk-card admin-bill-risk-card--ok">
            <p className="admin-bill-risk-label">Payment warnings</p>
            <p className="admin-bill-risk-value">None</p>
          </div>
          <div className="admin-bill-risk-card">
            <p className="admin-bill-risk-label">Grace period</p>
            <p className="admin-bill-risk-value">—</p>
          </div>
          <div className="admin-bill-risk-card">
            <p className="admin-bill-risk-label">Service status</p>
            <p className="admin-bill-risk-value">Active</p>
          </div>
          <div className="admin-bill-risk-card">
            <p className="admin-bill-risk-label">Auto-retry attempts</p>
            <p className="admin-bill-risk-value">—</p>
          </div>
        </div>
      </BillBlock>
      <BillBlock title="Plan changes">
        <div className="admin-bill-split-list">
          <BillRow label="Upgrade history" value="No changes yet" tone="muted" />
          <BillRow label="Downgrade history" value="No changes yet" tone="muted" />
          <BillRow label="Proration" value="Available when billing connects" tone="muted" />
          <BillRow label="Change timing" value="Immediate vs next cycle — TBD" tone="muted" />
        </div>
      </BillBlock>
    </div>
  );
}

function InvoicesLayout() {
  return (
    <div className="admin-bill-layout admin-bill-layout--invoices">
      <BillBlock title="Upcoming invoice preview">
        <div className="admin-bill-upcoming">
          <p className="admin-bill-upcoming-amount">—</p>
          <p className="admin-bill-upcoming-hint">Next SaaS invoice when subscription is active</p>
        </div>
      </BillBlock>
      <BillBlock title="Invoice list">
        <div className="admin-bill-invoice-stack">
          {["Draft preview", "Placeholder row", "Placeholder row"].map((row) => (
            <div key={row} className="admin-bill-invoice-row admin-bill-invoice-row--ghost">
              <div>
                <p className="admin-bill-invoice-id">INV-—</p>
                <p className="admin-bill-invoice-date">No invoices yet</p>
              </div>
              <BillChip tone="muted">Unpaid</BillChip>
              <AdminBtnSecondary disabled>Download PDF</AdminBtnSecondary>
            </div>
          ))}
        </div>
      </BillBlock>
      <BillBlock title="Invoice details & history">
        <p className="admin-bill-muted-copy">Paid, unpaid, and failed platform invoices will appear here with line-item detail.</p>
      </BillBlock>
    </div>
  );
}

function PaymentMethodLayout() {
  return (
    <div className="admin-bill-layout admin-bill-layout--payment">
      <div className="admin-bill-card-vault">
        <div className="admin-bill-card-visual">
          <p className="admin-bill-card-brand">ServeOS billing</p>
          <p className="admin-bill-card-number">•••• •••• •••• —</p>
          <p className="admin-bill-card-exp">— / —</p>
        </div>
        <BillChip tone="muted">Default method</BillChip>
      </div>
      <BillBlock title="Payment method controls">
        <div className="admin-bill-action-grid">
          <AdminBtnPrimary disabled>Add card (Stripe)</AdminBtnPrimary>
          <AdminBtnSecondary disabled>Update card</AdminBtnSecondary>
          <AdminBtnSecondary disabled>Remove payment method</AdminBtnSecondary>
          <AdminBtnSecondary disabled>Retry failed payment</AdminBtnSecondary>
        </div>
        <p className="admin-bill-muted-copy mt-4">For your ServeOS subscription only — not guest checkout or venue payouts.</p>
      </BillBlock>
    </div>
  );
}

function UsageLayout() {
  const meters = [
    { label: "Active locations", used: "—", limit: "—" },
    { label: "Active staff", used: "—", limit: "—" },
    { label: "Monthly order volume", used: "—", limit: "—" },
    { label: "Menu size", used: "—", limit: "—" },
    { label: "Devices / KDS", used: "—", limit: "—" },
    { label: "Storage (images)", used: "—", limit: "—" },
    { label: "API usage", used: "Future", limit: "—" }
  ];
  return (
    <div className="admin-bill-layout admin-bill-layout--usage">
      <div className="admin-bill-meter-grid">
        {meters.map((m) => (
          <div key={m.label} className="admin-bill-meter">
            <div className="admin-bill-meter-head">
              <span className="admin-bill-meter-label">{m.label}</span>
              <span className="admin-bill-meter-value">
                {m.used} / {m.limit}
              </span>
            </div>
            <div className="admin-bill-meter-track">
              <span className="admin-bill-meter-fill" style={{ width: "0%" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HistoryLayout() {
  const events = [
    "Subscription started",
    "Payment succeeded",
    "Payment failed",
    "Plan changed",
    "Account suspended",
    "Account reactivated"
  ];
  return (
    <div className="admin-bill-layout admin-bill-layout--history">
      <div className="admin-bill-audit-stream">
        {events.map((event, i) => (
          <article key={event} className="admin-bill-audit-item">
            <div className="admin-bill-audit-rail">
              <span className="admin-bill-audit-dot" />
              {i < events.length - 1 ? <span className="admin-bill-audit-line" /> : null}
            </div>
            <div className="admin-bill-audit-body">
              <p className="admin-bill-audit-event">{event}</p>
              <p className="admin-bill-audit-meta">Waiting for billing connection</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function FeaturesLayout() {
  const features = [
    { name: "Multi-location", enabled: false },
    { name: "Advanced analytics", enabled: false },
    { name: "Priority support", enabled: false },
    { name: "Custom roles", enabled: false },
    { name: "API access", enabled: false }
  ];
  return (
    <div className="admin-bill-layout admin-bill-layout--features">
      <div className="admin-bill-feature-matrix">
        {features.map((f) => (
          <div key={f.name} className={`admin-bill-feature-row${f.enabled ? " admin-bill-feature-row--on" : ""}`}>
            <span className="admin-bill-feature-name">{f.name}</span>
            <BillChip tone={f.enabled ? "success" : "muted"}>{f.enabled ? "Enabled" : "Locked"}</BillChip>
          </div>
        ))}
      </div>
      <BillBlock title="Upgrade prompts">
        <p className="admin-bill-muted-copy">Locked features will show upgrade prompts in the product when billing is connected.</p>
        <AdminBtnPrimary disabled className="mt-3">
          View plan comparison
        </AdminBtnPrimary>
      </BillBlock>
    </div>
  );
}

function SecurityLayout() {
  return (
    <div className="admin-bill-layout admin-bill-layout--security">
      <div className="admin-bill-status-grid">
        <div className="admin-bill-status-tile">
          <p className="admin-bill-status-label">Stripe connection</p>
          <BillChip tone="warning">Disconnected</BillChip>
        </div>
        <div className="admin-bill-status-tile">
          <p className="admin-bill-status-label">Webhook health</p>
          <BillChip tone="muted">—</BillChip>
        </div>
        <div className="admin-bill-status-tile">
          <p className="admin-bill-status-label">Billing sync</p>
          <BillChip tone="muted">—</BillChip>
        </div>
        <div className="admin-bill-status-tile">
          <p className="admin-bill-status-label">Abnormal billing</p>
          <BillChip tone="success">None detected</BillChip>
        </div>
      </div>
      <BillBlock title="Tax & legal (light)">
        <div className="admin-bill-split-list">
          <BillRow label="VAT handling" value="Per region when configured" tone="muted" />
          <BillRow label="Billing address" value="—" />
          <BillRow label="Company on invoice" value="—" />
          <BillRow label="Tax ID" value="—" />
        </div>
      </BillBlock>
    </div>
  );
}

const LAYOUTS: Record<BillingLayout, () => ReactNode> = {
  subscription: SubscriptionLayout,
  invoices: InvoicesLayout,
  "payment-method": PaymentMethodLayout,
  usage: UsageLayout,
  history: HistoryLayout,
  features: FeaturesLayout,
  security: SecurityLayout
};

export function AdminBillingCategoryPage({ hash }: { hash: string }) {
  const category = resolveBillingCategory(hash);
  if (!category) return null;
  const Layout = LAYOUTS[category.layout];
  const pageId = hash.slice(1);

  return (
    <div id={pageId} className={`admin-bill-page admin-bill-page--${category.layout} admin-bill-page--${category.accent}`}>
      <BillHero category={category} />
      <div className="admin-bill-stage">
        <Layout />
      </div>
    </div>
  );
}

export function AdminBillingPageRouter({ hash }: { hash: string }) {
  if (!isAdminBillingPageHash(hash)) return null;
  return <AdminBillingCategoryPage hash={hash} />;
}
