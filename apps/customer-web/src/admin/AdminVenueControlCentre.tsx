import type { ReactNode } from "react";
import { AdminEmptyState, AdminPanel, AdminSectionHeader, subPanelCls } from "./AdminUi";
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
            </p>
            <p className="mt-2 font-mono text-[11px] text-slate-500">ID: {venueId || "—"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={buildNavHref("orders", "kitchen-view")} className="admin-profile-modal-btn admin-profile-modal-btn--primary inline-flex items-center px-4 py-2 text-xs font-bold">
              Kitchen view
            </a>
            <a href={buildNavHref("venue", "floor-map")} className="admin-profile-modal-btn admin-profile-modal-btn--ghost inline-flex items-center px-4 py-2 text-xs font-bold">
              Floor map
            </a>
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
          <SectionBlock title="Floor overview" description="Table map, turns, and server sections.">
            <AdminEmptyState>No floor data yet for this venue.</AdminEmptyState>
          </SectionBlock>
        </div>

        <div className="grid gap-5 xl:col-span-5">
          <SectionBlock title="Kitchen pulse" description="Stations, queue depth, and delay risk.">
            <AdminEmptyState>No kitchen station data yet.</AdminEmptyState>
          </SectionBlock>

          <SectionBlock title="Devices & printers" description="Connected hardware health for this venue.">
            <AdminEmptyState>No devices registered yet.</AdminEmptyState>
          </SectionBlock>
        </div>

        <div className="grid gap-5 xl:col-span-7">
          <SectionBlock title="Venue timeline" description="Reservations, walk-ins, and events across the service window.">
            <AdminEmptyState>No timeline events yet.</AdminEmptyState>
          </SectionBlock>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <SectionBlock title="Staff on shift" description="Who is clocked in and their stations.">
          <AdminEmptyState>No shift data yet — manage staff under Configuration → Staff.</AdminEmptyState>
        </SectionBlock>
        <SectionBlock title="Live alerts" description="Operational signals for this venue only.">
          <AdminEmptyState>No alerts right now.</AdminEmptyState>
        </SectionBlock>
      </div>

      <div className="mt-5">
        <AdminSectionHeader
          eyebrowText="Shortcuts"
          title="Jump to workspace tools"
          description="Open the modules you use most during service."
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <a href={buildNavHref("orders", "active-orders")} className="admin-profile-modal-btn admin-profile-modal-btn--ghost inline-flex items-center px-4 py-2 text-xs font-bold">
            Active orders
          </a>
          <a href={buildNavHref("venue", "reservations")} className="admin-profile-modal-btn admin-profile-modal-btn--ghost inline-flex items-center px-4 py-2 text-xs font-bold">
            Reservations
          </a>
          <a href={buildNavHref("config", "staff")} className="admin-profile-modal-btn admin-profile-modal-btn--ghost inline-flex items-center px-4 py-2 text-xs font-bold">
            Staff
          </a>
        </div>
      </div>
    </AdminPanel>
  );
}
