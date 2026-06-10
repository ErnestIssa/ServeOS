import { useState, type ReactNode } from "react";
import {
  AdminBtnPrimary,
  AdminBtnSecondary,
  AdminEmptyState,
  AdminInput,
  AdminLabel,
  AdminPanel,
  AdminSectionHeader,
  AdminSelect,
  subPanelCls
} from "./AdminUi";
import { ADMIN_TOP_HASHES } from "./adminTopHashes";

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

export function AdminAddStaffPage() {
  return (
    <AdminPageShell
      id={ADMIN_TOP_HASHES.addStaff.slice(1)}
      eyebrow="Team"
      title="Add staff"
      description="Invite team members, assign roles, and scope access by venue. Invites and permissions will be saved through the staff API when connected."
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <div className={`${subPanelCls} admin-top-page-card`}>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Invite teammate</p>
          <div className="mt-4 grid gap-4">
            <AdminLabel>
              Email
              <AdminInput type="email" placeholder="name@restaurant.com" autoComplete="off" />
            </AdminLabel>
            <AdminLabel>
              Role
              <AdminSelect defaultValue="floor">
                <option value="floor">Floor staff</option>
                <option value="kitchen">Kitchen</option>
                <option value="manager">Venue manager</option>
                <option value="host">Host / reservations</option>
              </AdminSelect>
            </AdminLabel>
            <AdminLabel>
              Venue access
              <AdminSelect defaultValue="all">
                <option value="all">All venues</option>
                <option value="current">Active venue only</option>
              </AdminSelect>
            </AdminLabel>
            <AdminLabel>
              Personal message (optional)
              <AdminInput placeholder="Welcome to the team — here is your ServeOS access." />
            </AdminLabel>
            <div className="flex flex-wrap gap-2 pt-1">
              <AdminBtnPrimary>Send invite</AdminBtnPrimary>
              <AdminBtnSecondary>Copy invite link</AdminBtnSecondary>
            </div>
          </div>
        </div>

        <div className={`${subPanelCls} admin-top-page-card`}>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Role overview</p>
          <div className="mt-4 space-y-3">
            {[
              { role: "Venue manager", access: "Orders, floor, staff, menu (venue scope)" },
              { role: "Kitchen", access: "KDS, order status, kitchen chat" },
              { role: "Floor staff", access: "Tables, orders, guest messaging" },
              { role: "Host", access: "Reservations, queue, walk-ins" }
            ].map((row) => (
              <div key={row.role} className="admin-role-card rounded-xl border p-3">
                <p className="text-sm font-semibold">{row.role}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">{row.access}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={`${subPanelCls} admin-top-page-card mt-5`}>
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Pending invites</p>
        <div className="mt-4">
          <AdminEmptyState>No pending invites — send your first invite above.</AdminEmptyState>
        </div>
      </div>
    </AdminPageShell>
  );
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

type ProfilePageProps = {
  displayName: string;
  email?: string | null;
  onSignOut?: () => void;
};

export function AdminProfilePage({ displayName, email, onSignOut }: ProfilePageProps) {
  const initial = (displayName.charAt(0) || "O").toUpperCase();

  return (
    <AdminPageShell
      id={ADMIN_TOP_HASHES.profile.slice(1)}
      eyebrow="Account"
      title="Your profile"
      description="Personal details, security, sessions, and workspace preferences. Profile saves will route through the account API when enabled."
      action={
        onSignOut ? (
          <AdminBtnSecondary onClick={onSignOut}>
            Sign out
          </AdminBtnSecondary>
        ) : undefined
      }
    >
      <div className="grid gap-5 xl:grid-cols-12">
        <div className={`${subPanelCls} admin-top-page-card xl:col-span-4`}>
          <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left sm:gap-4">
            <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-blue-600 text-2xl font-bold text-white shadow-lg">
              {initial}
            </span>
            <div className="mt-4 min-w-0 sm:mt-1">
              <p className="font-display text-xl font-bold text-slate-900">{displayName}</p>
              <p className="mt-1 truncate text-sm text-slate-600">{email ?? "owner@venue.com"}</p>
              <Chip tone="violet">Owner</Chip>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-2 sm:justify-start">
            <AdminBtnSecondary>Upload photo</AdminBtnSecondary>
            <AdminBtnSecondary>Change email</AdminBtnSecondary>
          </div>
        </div>

        <div className={`${subPanelCls} admin-top-page-card xl:col-span-8`}>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Personal information</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <AdminLabel>
              Full name
              <AdminInput defaultValue={displayName} />
            </AdminLabel>
            <AdminLabel>
              Phone
              <AdminInput type="tel" placeholder="+46 70 000 00 00" />
            </AdminLabel>
            <AdminLabel className="sm:col-span-2">
              Job title
              <AdminInput placeholder="Owner / General manager" />
            </AdminLabel>
          </div>
          <div className="mt-4">
            <AdminBtnPrimary>Save profile</AdminBtnPrimary>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className={`${subPanelCls} admin-top-page-card`}>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Security</p>
          <div className="mt-4 grid gap-4">
            <AdminLabel>
              Current password
              <AdminInput type="password" autoComplete="current-password" />
            </AdminLabel>
            <AdminLabel>
              New password
              <AdminInput type="password" autoComplete="new-password" />
            </AdminLabel>
            <div className="flex flex-wrap gap-2">
              <AdminBtnPrimary>Update password</AdminBtnPrimary>
              <AdminBtnSecondary>Enable 2FA</AdminBtnSecondary>
            </div>
          </div>
        </div>

        <div className={`${subPanelCls} admin-top-page-card`}>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Sessions & devices</p>
          <ul className="mt-4 space-y-3">
            <li className="admin-session-row rounded-xl border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">This browser</p>
                  <p className="text-xs text-slate-500">Windows · Chrome · Active now</p>
                </div>
                <Chip tone="success">Current</Chip>
              </div>
            </li>
            <li className="admin-session-row rounded-xl border p-3 opacity-80">
              <p className="text-sm font-semibold">iPhone 15</p>
              <p className="text-xs text-slate-500">ServeOS mobile · Last active 2 days ago</p>
            </li>
          </ul>
          <div className="mt-4">
            <AdminBtnSecondary>Sign out other sessions</AdminBtnSecondary>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div className={`${subPanelCls} admin-top-page-card`}>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Notifications</p>
          <p className="mt-2 text-sm text-slate-600">Choose which alerts reach your email and push devices.</p>
          <a href={ADMIN_TOP_HASHES.notifications} className="admin-page-text-link mt-4 inline-block text-sm font-semibold">
            Open notification settings →
          </a>
        </div>
        <div className={`${subPanelCls} admin-top-page-card`}>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Billing</p>
          <p className="mt-2 text-sm text-slate-600">Subscription, invoices, and payment methods for your workspace.</p>
          <a href={ADMIN_TOP_HASHES.billing} className="admin-page-text-link mt-4 inline-block text-sm font-semibold">
            Open billing →
          </a>
        </div>
        <div className={`${subPanelCls} admin-top-page-card`}>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Venue access</p>
          <p className="mt-2 text-sm text-slate-600">You have owner access to all venues in this workspace.</p>
          <a href="#ws-config/locations" className="admin-page-text-link mt-4 inline-block text-sm font-semibold">
            Manage locations →
          </a>
        </div>
      </div>

      <div className={`${subPanelCls} admin-top-page-card admin-danger-zone mt-5`}>
        <p className="text-xs font-bold uppercase tracking-wide text-red-600/90">Danger zone</p>
        <p className="mt-2 max-w-xl text-sm text-slate-600">
          Transfer ownership or permanently close your workspace. These actions require verification and cannot be undone
          from the UI alone.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <AdminBtnSecondary>Transfer ownership</AdminBtnSecondary>
          <button type="button" className="admin-page-danger-btn rounded-full px-4 py-2 text-xs font-bold">
            Request account closure
          </button>
        </div>
      </div>
    </AdminPageShell>
  );
}

export function AdminTopPageView({
  hash,
  displayName,
  email,
  onSignOut
}: {
  hash: string;
  displayName: string;
  email?: string | null;
  onSignOut?: () => void;
}) {
  switch (hash) {
    case ADMIN_TOP_HASHES.billing:
      return <AdminBillingPage />;
    case ADMIN_TOP_HASHES.notifications:
      return <AdminNotificationsPage />;
    case ADMIN_TOP_HASHES.addStaff:
      return <AdminAddStaffPage />;
    case ADMIN_TOP_HASHES.platformHelp:
      return <AdminPlatformHelpPage />;
    case ADMIN_TOP_HASHES.profile:
      return <AdminProfilePage displayName={displayName} email={email} onSignOut={onSignOut} />;
    default:
      return null;
  }
}
