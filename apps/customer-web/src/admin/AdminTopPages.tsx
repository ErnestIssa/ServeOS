import { useState, type ReactNode } from "react";
import {
  AdminBtnPrimary,
  AdminBtnSecondary,
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

const MOCK_INVOICES = [
  { id: "INV-2026-0412", date: "Apr 12, 2026", amount: "2 490 kr", status: "Paid" },
  { id: "INV-2026-0312", date: "Mar 12, 2026", amount: "2 490 kr", status: "Paid" },
  { id: "INV-2026-0212", date: "Feb 12, 2026", amount: "2 490 kr", status: "Paid" }
] as const;

const MOCK_NOTIFICATIONS = [
  {
    id: "n1",
    title: "Kitchen delay threshold reached",
    body: "Order #4821 has been in PREPARING for 18 minutes at Main Dining.",
    time: "4 min ago",
    category: "Orders",
    unread: true
  },
  {
    id: "n2",
    title: "New staff invite accepted",
    body: "Sara Lindström joined as Floor Manager for your Stockholm venue.",
    time: "1 hr ago",
    category: "Staff",
    unread: true
  },
  {
    id: "n3",
    title: "Trial reminder",
    body: "Your workspace trial ends in 9 days. Review billing before auto-renewal.",
    time: "Yesterday",
    category: "System",
    unread: false
  },
  {
    id: "n4",
    title: "Printer offline",
    body: "Bar printer stopped responding. Last successful job 22 minutes ago.",
    time: "Yesterday",
    category: "System",
    unread: false
  }
] as const;

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
      description="Manage your ServeOS plan, payment methods, invoices, and payout preferences. Data will sync from your account once billing APIs are connected."
      action={<AdminBtnSecondary>Download statements</AdminBtnSecondary>}
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Current plan" value="Growth" hint="Billed monthly" />
        <StatTile label="Next invoice" value="Jun 12" hint="2 490 kr / month" />
        <StatTile label="Trial status" value="Active" hint="9 days remaining" />
        <StatTile label="Venues on plan" value="2 / 3" hint="Add-on slots available" />
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-5">
        <div className={`${subPanelCls} admin-top-page-card lg:col-span-3`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Subscription</p>
              <p className="mt-1 font-display text-lg font-bold text-slate-900">Growth — multi-venue</p>
            </div>
            <Chip tone="success">Active</Chip>
          </div>
          <ul className="admin-page-feature-list mt-5 space-y-2 text-sm">
            <li>Live orders, KDS, and floor operations</li>
            <li>Reservations, queue, and venue timeline</li>
            <li>Staff roles, automations, and insights</li>
          </ul>
          <div className="mt-6 flex flex-wrap gap-2">
            <AdminBtnPrimary>Change plan</AdminBtnPrimary>
            <AdminBtnSecondary>Compare plans</AdminBtnSecondary>
          </div>
        </div>

        <div className={`${subPanelCls} admin-top-page-card lg:col-span-2`}>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Payment method</p>
          <div className="admin-payment-card mt-4 rounded-xl border p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Visa •••• 4242</p>
                <p className="mt-0.5 text-xs text-slate-500">Expires 08/28 · Default</p>
              </div>
              <Chip tone="violet">Primary</Chip>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <AdminBtnSecondary>Update card</AdminBtnSecondary>
            <AdminBtnSecondary>Add method</AdminBtnSecondary>
          </div>
        </div>
      </div>

      <div className={`${subPanelCls} admin-top-page-card mt-5`}>
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Invoice history</p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200/80">
          <table className="admin-page-table w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {MOCK_INVOICES.map((row) => (
                <tr key={row.id}>
                  <td className="font-mono text-xs">{row.id}</td>
                  <td>{row.date}</td>
                  <td className="font-semibold">{row.amount}</td>
                  <td>
                    <Chip tone="success">{row.status}</Chip>
                  </td>
                  <td className="text-right">
                    <button type="button" className="admin-page-link-btn text-xs font-semibold">
                      PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminPageShell>
  );
}

export function AdminNotificationsPage() {
  const [filter, setFilter] = useState<"All" | "Orders" | "Staff" | "System">("All");
  const filtered =
    filter === "All" ? MOCK_NOTIFICATIONS : MOCK_NOTIFICATIONS.filter((n) => n.category === filter);
  const unreadCount = MOCK_NOTIFICATIONS.filter((n) => n.unread).length;

  return (
    <AdminPageShell
      id={ADMIN_TOP_HASHES.notifications.slice(1)}
      eyebrow="Alerts"
      title="Notifications"
      description="System alerts, venue updates, and operational signals across your workspace. Live delivery connects when notification APIs are enabled."
      action={
        <div className="flex flex-wrap gap-2">
          <AdminBtnSecondary>Mark all read</AdminBtnSecondary>
          <AdminBtnPrimary>Alert settings</AdminBtnPrimary>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Unread" value={String(unreadCount)} hint="Across all venues" />
        <StatTile label="Today" value="6" hint="Last 24 hours" />
        <StatTile label="Critical" value="1" hint="Needs attention" />
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

      <ul className="mt-5 space-y-3">
        {filtered.map((item) => (
          <li
            key={item.id}
            className={`admin-notification-row rounded-xl border p-4 transition ${item.unread ? "admin-notification-row--unread" : ""}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-slate-900">{item.title}</p>
                  <Chip>{item.category}</Chip>
                  {item.unread ? <span className="admin-top-tool-badge static" aria-label="Unread" /> : null}
                </div>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{item.body}</p>
              </div>
              <span className="shrink-0 text-xs text-slate-500">{item.time}</span>
            </div>
          </li>
        ))}
      </ul>
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
