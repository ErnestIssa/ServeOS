import type { ReactNode } from "react";
import { AdminBtnPrimary, AdminBtnSecondary, AdminPanel, AdminSectionHeader, subPanelCls } from "./AdminUi";
import { buildNavHref } from "./adminWorkspaceRouting";
import { ADMIN_VENUE_CONTROL_HASH } from "./adminTopHashes";

function StatTile({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "default" | "live" }) {
  return (
    <div className={`admin-stat-card admin-venue-stat rounded-xl border p-4 shadow-sm ${tone === "live" ? "admin-venue-stat--live" : ""}`}>
      <p className="admin-stat-label text-[10px] font-bold uppercase tracking-[0.14em]">{label}</p>
      <p className="admin-stat-value mt-2 font-display text-2xl font-bold">{value}</p>
      {hint ? <p className="admin-stat-hint mt-1 text-xs">{hint}</p> : null}
    </div>
  );
}

function SectionBlock({ title, description, children, action }: { title: string; description?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className={`${subPanelCls} admin-top-page-card admin-venue-block`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</p>
          {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

type Props = {
  venueName: string;
  venueId: string;
};

export function AdminVenueControlCentrePage({ venueName, venueId }: Props) {
  const displayName = venueName || "Your venue";

  return (
    <AdminPanel id={ADMIN_VENUE_CONTROL_HASH.slice(1)} className="admin-top-page admin-venue-control-centre">
      <div className="admin-venue-hero rounded-2xl border p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-violet-600/90">Venue control centre</p>
            <h1 className="font-display mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">{displayName}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
              Live command surface for this location — floor, kitchen, reservations, devices, and staff in one place.
              Metrics connect when venue APIs are live.
            </p>
            <p className="mt-2 font-mono text-[11px] text-slate-500">ID: {venueId || "—"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <AdminBtnPrimary>Open floor map</AdminBtnPrimary>
            <AdminBtnSecondary>Kitchen view</AdminBtnSecondary>
            <AdminBtnSecondary>Pause orders</AdminBtnSecondary>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
        <StatTile label="Live orders" value="—" hint="Active in kitchen" tone="live" />
        <StatTile label="Covers on floor" value="—" hint="Tables seated now" />
        <StatTile label="Reservations tonight" value="—" hint="Confirmed + pending" />
        <StatTile label="Queue waiting" value="—" hint="Walk-in list" />
        <StatTile label="Staff on shift" value="—" hint="Clocked in" />
        <StatTile label="Revenue today" value="—" hint="Gross, all channels" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-12">
        <div className="xl:col-span-12">
        <SectionBlock
          title="Floor overview"
          description="Table map, turns, and server sections — visual floor plan ships next."
          action={<AdminBtnSecondary>Full screen</AdminBtnSecondary>}
        >
          <div className="admin-venue-floor-grid grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i} className="admin-venue-table-tile rounded-xl border p-3 text-center">
                <p className="text-xs font-bold text-slate-500">T{i + 1}</p>
                <p className="mt-2 font-display text-lg font-bold">—</p>
                <p className="admin-stat-hint mt-1 text-[10px]">Available</p>
              </div>
            ))}
          </div>
        </SectionBlock>
        </div>

        <div className="grid gap-5 xl:col-span-5">
          <SectionBlock title="Kitchen pulse" description="Stations, queue depth, and delay risk.">
            <ul className="space-y-2 text-sm">
              {["Grill", "Cold prep", "Bar", "Dessert"].map((station) => (
                <li key={station} className="admin-venue-queue-row flex items-center justify-between rounded-xl border px-3 py-2.5">
                  <span className="font-semibold">{station}</span>
                  <span className="text-xs text-slate-500">0 tickets · — min avg</span>
                </li>
              ))}
            </ul>
          </SectionBlock>

          <SectionBlock title="Devices & printers" description="Connected hardware health for this venue.">
            <ul className="grid gap-2 sm:grid-cols-2">
              {["KDS — Main", "KDS — Bar", "POS — Front", "Printer — Kitchen"].map((device) => (
                <li key={device} className="admin-venue-device-row rounded-xl border px-3 py-2.5 text-sm">
                  <span className="font-semibold">{device}</span>
                  <span className="mt-0.5 block text-xs text-emerald-600">Online</span>
                </li>
              ))}
            </ul>
          </SectionBlock>
        </div>

        <div className="grid gap-5 xl:col-span-7">
          <SectionBlock
            title="Venue timeline"
            description="Reservations, walk-ins, and events across the service window."
            action={<AdminBtnSecondary>Export day sheet</AdminBtnSecondary>}
          >
            <div className="admin-venue-timeline space-y-3">
              {[
                { time: "17:30", label: "Reservation — Party of 4", meta: "Table 12 · Confirmed" },
                { time: "18:00", label: "Walk-in queue", meta: "2 parties waiting" },
                { time: "18:45", label: "Private dining hold", meta: "Room B · Deposit paid" },
                { time: "20:00", label: "Peak service window", meta: "Forecast — high load" }
              ].map((row) => (
                <div key={row.time + row.label} className="admin-venue-timeline-row flex gap-4 rounded-xl border p-3">
                  <span className="w-12 shrink-0 text-xs font-bold text-violet-600">{row.time}</span>
                  <div>
                    <p className="text-sm font-semibold">{row.label}</p>
                    <p className="text-xs text-slate-500">{row.meta}</p>
                  </div>
                </div>
              ))}
            </div>
          </SectionBlock>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <SectionBlock title="Staff on shift" description="Who is clocked in and their stations.">
          <p className="text-sm text-slate-500">No shift data yet — staff roster connects from Configuration → Staff.</p>
        </SectionBlock>
        <SectionBlock title="Live alerts" description="Operational signals for this venue only.">
          <ul className="space-y-2 text-sm text-slate-600">
            <li className="rounded-xl border px-3 py-2">All systems nominal — alerts appear when integrations are live.</li>
          </ul>
        </SectionBlock>
      </div>

      <div className="mt-5">
        <AdminSectionHeader
          eyebrowText="Shortcuts"
          title="Jump to venue tools"
          description="Deep links into configuration and operations for this location."
        />
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          {[
            { label: "Menu builder", href: buildNavHref("config", "menu-builder") },
            { label: "Reservations", href: buildNavHref("venue", "reservations") },
            { label: "Live orders", href: buildNavHref("live-ops", "live-orders") },
            { label: "Tables", href: buildNavHref("venue", "tables") },
            { label: "Staff list", href: buildNavHref("config", "staff-list") },
            { label: "Restaurant profile", href: buildNavHref("config", "restaurant-profile") }
          ].map((link) => (
            <a key={link.href} href={link.href} className="admin-venue-shortcut rounded-xl border px-3 py-3 text-center text-sm font-semibold transition">
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </AdminPanel>
  );
}
