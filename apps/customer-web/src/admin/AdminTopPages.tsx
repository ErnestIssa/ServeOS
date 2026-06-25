import { useState, type ReactNode } from "react";
import {
  AdminBtnPrimary,
  AdminBtnSecondary,
  AdminEmptyState,
  AdminPanel,
  AdminSectionHeader,
  subPanelCls
} from "./AdminUi";
import { ADMIN_TOP_HASHES } from "./adminTopHashes";
import { AdminProfilePage } from "./profile/AdminProfilePage";
import { AdminStaffManagementPage } from "./AdminStaffManagementPage";

type PageShellProps = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
};

function AdminPageShell({ id, eyebrow, title, description, action, children }: PageShellProps) {
  return (
    <AdminPanel id={id} className="admin-top-page admin-panel--edge">
      <AdminSectionHeader eyebrowText={eyebrow} title={title} description={description} action={action} />
      <div className="mt-8">{children}</div>
    </AdminPanel>
  );
}

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="admin-stat-card rounded-xl border p-4 shadow-sm">
      <p className="admin-stat-label text-[10px] font-bold uppercase tracking-[0.14em]">{label}</p>
      <p className="admin-stat-value mt-2 font-display text-2xl font-bold">{value}</p>
      {hint ? <p className="admin-stat-hint mt-1 text-xs">{hint}</p> : null}
    </div>
  );
}

function Chip({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "success" | "warning" | "violet" }) {
  return <span className={`admin-page-chip admin-page-chip--${tone}`}>{children}</span>;
}

const HELP_CATEGORIES = [
  { title: "Getting started", desc: "Workspace setup, venues, and first menu.", articles: 12 },
  { title: "Orders & kitchen", desc: "KDS flow, statuses, and order chats.", articles: 18 },
  { title: "Reservations", desc: "Tables, walk-ins, and venue timeline.", articles: 9 },
  { title: "Staff & roles", desc: "Invites, permissions, and shift tools.", articles: 11 },
  { title: "Billing & plans", desc: "Subscriptions, invoices, and payouts.", articles: 7 }
] as const;

const FAQ_ITEMS = [
  {
    q: "How do I add another venue?",
    a: "Open Configuration → Locations, or use the venue switcher in the top bar and choose Add."
  },
  {
    q: "Can staff use ServeOS without owner access?",
    a: "Yes. Invite staff with role-based permissions — they sign in to scoped tools without full admin access."
  },
  {
    q: "Where do I change payment methods?",
    a: "Billing in the top bar covers subscription charges; venue payout accounts live under Business settings."
  }
] as const;

export function AdminBillingPage() {
  return (
    <AdminPageShell
      id={ADMIN_TOP_HASHES.billing.slice(1)}
      eyebrow="Business"
      title="Billing & subscription"
      description="Manage your ServeOS plan, payment methods, invoices, and payout preferences."
      action={<AdminBtnSecondary>Download statements</AdminBtnSecondary>}
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Current plan" value="—" hint="Connect billing to view" />
        <StatTile label="Next invoice" value="—" hint="No upcoming invoice" />
        <StatTile label="Trial status" value="—" hint="—" />
        <StatTile label="Venues on plan" value="—" hint="—" />
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-5">
        <div className={`${subPanelCls} admin-top-page-card lg:col-span-3`}>
          <AdminEmptyState>No active subscription on file yet.</AdminEmptyState>
        </div>

        <div className={`${subPanelCls} admin-top-page-card lg:col-span-2`}>
          <AdminEmptyState>No payment method on file yet.</AdminEmptyState>
        </div>
      </div>

      <div className={`${subPanelCls} admin-top-page-card mt-5`}>
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Invoice history</p>
        <div className="mt-4">
          <AdminEmptyState>No invoices yet.</AdminEmptyState>
        </div>
      </div>
    </AdminPageShell>
  );
}

export function AdminNotificationsPage() {
  const [filter, setFilter] = useState<"All" | "Orders" | "Staff" | "System">("All");

  return (
    <AdminPageShell
      id={ADMIN_TOP_HASHES.notifications.slice(1)}
      eyebrow="Alerts"
      title="Notifications"
      description="System alerts, venue updates, and operational signals across your workspace."
      action={
        <div className="flex flex-wrap gap-2">
          <AdminBtnSecondary>Mark all read</AdminBtnSecondary>
          <AdminBtnPrimary>Alert settings</AdminBtnPrimary>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Unread" value="0" hint="Across all venues" />
        <StatTile label="Today" value="0" hint="Last 24 hours" />
        <StatTile label="Critical" value="0" hint="Needs attention" />
      </div>

      <div className="admin-page-tabs mt-8 flex flex-wrap gap-2">
        {(["All", "Orders", "Staff", "System"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            className={`admin-page-tab ${filter === tab ? "admin-page-tab--active" : ""}`}
            onClick={() => setFilter(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className={`${subPanelCls} mt-5 p-6`}>
        <AdminEmptyState>No notifications yet.</AdminEmptyState>
      </div>
    </AdminPageShell>
  );
}

export function AdminAddStaffPage({
  token,
  restaurantId,
  venueName
}: {
  token: string;
  restaurantId: string;
  venueName: string;
}) {
  return <AdminStaffManagementPage token={token} restaurantId={restaurantId} venueName={venueName} />;
}

export function AdminPlatformHelpPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <AdminPageShell
      id={ADMIN_TOP_HASHES.platformHelp.slice(1)}
      eyebrow="Support"
      title="Platform help"
      description="Guides, FAQs, and self-serve answers for running your venue on ServeOS. Live chat stays available from the support button."
      action={<AdminBtnPrimary>Contact support</AdminBtnPrimary>}
    >
      <label className="admin-global-search group relative block w-full">
        <span className="sr-only">Search help articles</span>
        <img
          src="/icons/magnifying-glass.png"
          alt=""
          className="admin-search-icon pointer-events-none absolute left-3.5 top-1/2 z-[1] -translate-y-1/2"
          aria-hidden
        />
        <input
          type="search"
          placeholder="Search guides, FAQs, and troubleshooting…"
          className="admin-search-input relative z-[2] w-full rounded-2xl py-2.5 pl-10 pr-4 text-sm outline-none transition"
        />
      </label>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {HELP_CATEGORIES.map((cat) => (
          <button key={cat.title} type="button" className={`${subPanelCls} admin-help-card text-left transition`}>
            <p className="font-display text-base font-bold text-slate-900">{cat.title}</p>
            <p className="mt-1 text-sm text-slate-600">{cat.desc}</p>
            <p className="admin-stat-hint mt-3 text-xs">{cat.articles} articles</p>
          </button>
        ))}
      </div>

      <div className={`${subPanelCls} admin-top-page-card mt-8`}>
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Frequently asked</p>
        <div className="mt-4 space-y-2">
          {FAQ_ITEMS.map((item, index) => {
            const open = openFaq === index;
            return (
              <div key={item.q} className="admin-faq-item rounded-xl border">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold"
                  aria-expanded={open}
                  onClick={() => setOpenFaq(open ? null : index)}
                >
                  {item.q}
                  <span className={`admin-faq-chevron ${open ? "admin-faq-chevron--open" : ""}`} aria-hidden>
                    ▾
                  </span>
                </button>
                {open ? <p className="border-t px-4 py-3 text-sm leading-relaxed text-slate-600">{item.a}</p> : null}
              </div>
            );
          })}
        </div>
      </div>
    </AdminPageShell>
  );
}

export function AdminTopPageView({
  hash,
  token,
  displayName,
  email,
  restaurantId,
  venueName,
  onSignOut,
  onEmailChanged
}: {
  hash: string;
  token: string;
  displayName: string;
  email?: string | null;
  restaurantId: string;
  venueName: string;
  onSignOut?: () => void;
  onEmailChanged?: (email: string) => void;
}) {
  switch (hash) {
    case ADMIN_TOP_HASHES.billing:
      return <AdminBillingPage />;
    case ADMIN_TOP_HASHES.notifications:
      return <AdminNotificationsPage />;
    case ADMIN_TOP_HASHES.addStaff:
      return (
        <AdminStaffManagementPage token={token} restaurantId={restaurantId} venueName={venueName} />
      );
    case ADMIN_TOP_HASHES.platformHelp:
      return <AdminPlatformHelpPage />;
    case ADMIN_TOP_HASHES.profile:
      return (
        <AdminProfilePage
          token={token}
          displayName={displayName}
          email={email}
          onSignOut={onSignOut}
          onEmailChanged={onEmailChanged}
        />
      );
    default:
      return null;
  }
}
