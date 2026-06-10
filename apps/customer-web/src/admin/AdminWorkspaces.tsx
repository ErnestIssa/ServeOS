import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AdminPanel, AdminSectionHeader, subPanelCls } from "./AdminUi";
import { AdminWorkspaceInnerTransition } from "./AdminWorkspaceInnerTransition";
import {
  resolveWorkspacePreset,
  syncAdminNavHash,
  WORKSPACE_META,
  WORKSPACE_PRESETS,
  type WorkspaceId,
  type WorkspacePreset
} from "./adminWorkspaceRouting";

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="admin-stat-card admin-ws-stat rounded-xl border p-4 shadow-sm">
      <p className="admin-stat-label text-[10px] font-bold uppercase tracking-[0.14em]">{label}</p>
      <p className="admin-stat-value mt-2 font-display text-2xl font-bold">{value}</p>
      {hint ? <p className="admin-stat-hint mt-1 text-xs">{hint}</p> : null}
    </div>
  );
}

function ViewModeChips({ preset }: { preset: WorkspacePreset }) {
  const chips = [preset.tab, preset.filter, preset.layout].filter((v): v is string => Boolean(v));
  if (!chips.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {chips.map((chip) => (
        <span key={chip} className="admin-page-chip admin-page-chip--violet capitalize">
          {chip.replace(/-/g, " ")}
        </span>
      ))}
    </div>
  );
}

function WorkspaceTabs({
  workspaceId,
  activePresetId,
  onSelectTab
}: {
  workspaceId: WorkspaceId;
  activePresetId: string;
  onSelectTab: (tab: string) => void;
}) {
  const presets = WORKSPACE_PRESETS[workspaceId];
  const activePreset = resolveWorkspacePreset(workspaceId, activePresetId);
  const tabs = [...new Set(presets.map((p) => p.tab))];

  return (
    <div className="admin-ws-tabs flex flex-wrap gap-2" role="tablist" aria-label="Workspace views">
      {tabs.map((tab) => {
        const active = activePreset.tab === tab;
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={active}
            className={`admin-page-tab capitalize ${active ? "admin-page-tab--active" : ""}`}
            onClick={() => onSelectTab(tab)}
          >
            {tab.replace(/-/g, " ")}
          </button>
        );
      })}
    </div>
  );
}

function WorkspaceShell({
  workspaceId,
  activePresetId,
  onSelectTab,
  children
}: {
  workspaceId: WorkspaceId;
  activePresetId: string;
  onSelectTab: (tab: string) => void;
  children: ReactNode;
}) {
  const meta = WORKSPACE_META[workspaceId];
  const preset = resolveWorkspacePreset(workspaceId, activePresetId);

  return (
    <AdminPanel id={`ws-${workspaceId}`} className="admin-top-page admin-panel--edge admin-ws-page">
      <div className="min-w-0">
        <AdminSectionHeader
          eyebrowText={meta.eyebrow}
          title={preset.label}
          description={preset.description ?? meta.description}
        />
        <ViewModeChips preset={preset} />
      </div>

      <div className="mt-6">
        <WorkspaceTabs workspaceId={workspaceId} activePresetId={activePresetId} onSelectTab={onSelectTab} />
      </div>

      <div className="mt-6">
        <AdminWorkspaceInnerTransition presetKey={activePresetId}>{children}</AdminWorkspaceInnerTransition>
      </div>
    </AdminPanel>
  );
}

function PlaceholderGrid({ tiles }: { tiles: Array<{ label: string; value?: string; hint?: string }> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {tiles.map((tile) => (
        <StatTile key={tile.label} label={tile.label} value={tile.value ?? "—"} hint={tile.hint} />
      ))}
    </div>
  );
}

function PanelBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={`${subPanelCls} admin-top-page-card admin-ws-panel mt-5`}>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

type WorkspaceBodyProps = {
  workspaceId: WorkspaceId;
  activePresetId: string;
  onSelectTab: (tab: string) => void;
};

function LiveOpsBody({ workspaceId, activePresetId, onSelectTab }: WorkspaceBodyProps) {
  const preset = resolveWorkspacePreset(workspaceId, activePresetId);
  return (
    <WorkspaceShell workspaceId={workspaceId} activePresetId={activePresetId} onSelectTab={onSelectTab}>
      <PlaceholderGrid
        tiles={[
          { label: "Live orders", hint: preset.tab === "orders" ? "Active filter on" : "Overview mode" },
          { label: "Tables active", hint: preset.tab === "tables" ? "Floor focus" : "—" },
          { label: "Reservations", hint: preset.tab === "reservations" ? "Tonight" : "—" },
          { label: "Alerts", hint: preset.tab === "alerts" ? "Panel open" : "—" }
        ]}
      />
      <PanelBlock title={`${preset.label} view`}>
        <p className="text-sm leading-relaxed text-slate-600">
          LiveOps perspective <strong>{preset.label}</strong> — tab {preset.tab}
          {preset.filter ? `, filter ${preset.filter}` : ""}
          {preset.layout ? `, layout ${preset.layout}` : ""}.
        </p>
      </PanelBlock>
    </WorkspaceShell>
  );
}

function OrdersBody({ workspaceId, activePresetId, onSelectTab }: WorkspaceBodyProps) {
  const preset = resolveWorkspacePreset(workspaceId, activePresetId);
  const isKds = preset.tab === "kds";
  return (
    <WorkspaceShell workspaceId={workspaceId} activePresetId={activePresetId} onSelectTab={onSelectTab}>
      <PlaceholderGrid
        tiles={[
          { label: "Open tickets", value: "—" },
          { label: "Avg prep time", value: "—" },
          { label: "Delayed", value: "—" },
          { label: "Completed today", value: "—" }
        ]}
      />
      <PanelBlock title={isKds ? "Kitchen display" : "Order board"}>
        <div className={`admin-ws-kds-grid grid gap-2 ${isKds ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          {Array.from({ length: isKds ? 6 : 4 }, (_, i) => (
            <div key={i} className="admin-venue-table-tile rounded-xl border p-4">
              <p className="text-xs font-bold text-slate-500">Order slot {i + 1}</p>
              <p className="mt-2 font-display text-lg font-bold">—</p>
            </div>
          ))}
        </div>
      </PanelBlock>
    </WorkspaceShell>
  );
}

function VenueBody({ workspaceId, activePresetId, onSelectTab }: WorkspaceBodyProps) {
  const preset = resolveWorkspacePreset(workspaceId, activePresetId);
  return (
    <WorkspaceShell workspaceId={workspaceId} activePresetId={activePresetId} onSelectTab={onSelectTab}>
      <PlaceholderGrid
        tiles={[
          { label: "Covers", value: "—" },
          { label: "Waiting", value: "—" },
          { label: "Turn time", value: "—" },
          { label: "Bookings", value: "—" }
        ]}
      />
      <PanelBlock title={`${preset.label} view`}>
        <p className="text-sm text-slate-600">
          Venue module <strong>{preset.label}</strong> — shared floor and reservations engine.
        </p>
      </PanelBlock>
    </WorkspaceShell>
  );
}

function DevicesBody({ workspaceId, activePresetId, onSelectTab }: WorkspaceBodyProps) {
  const preset = resolveWorkspacePreset(workspaceId, activePresetId);
  return (
    <WorkspaceShell workspaceId={workspaceId} activePresetId={activePresetId} onSelectTab={onSelectTab}>
      <PanelBlock title={`${preset.label} monitor`}>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {["KDS Main", "POS Front", "Bar printer", "Guest display", "Network AP"].map((d) => (
            <li key={d} className="admin-venue-device-row rounded-xl border px-3 py-3 text-sm">
              <span className="font-semibold">{d}</span>
              <span className="mt-1 block text-xs text-emerald-600">Online</span>
            </li>
          ))}
        </ul>
      </PanelBlock>
    </WorkspaceShell>
  );
}

function CommsBody({ workspaceId, activePresetId, onSelectTab }: WorkspaceBodyProps) {
  const preset = resolveWorkspacePreset(workspaceId, activePresetId);
  return (
    <WorkspaceShell workspaceId={workspaceId} activePresetId={activePresetId} onSelectTab={onSelectTab}>
      <PanelBlock title={`${preset.label} inbox`}>
        <ul className="space-y-2">
          {["Thread preview A", "Thread preview B", "Thread preview C"].map((t) => (
            <li key={t} className="admin-notification-row rounded-xl border p-3 text-sm">
              <span className="font-semibold">{t}</span>
              <span className="mt-1 block text-xs text-slate-500">Scope: {preset.filter ?? "all"}</span>
            </li>
          ))}
        </ul>
      </PanelBlock>
    </WorkspaceShell>
  );
}

function AutomationsBody({ workspaceId, activePresetId, onSelectTab }: WorkspaceBodyProps) {
  const preset = resolveWorkspacePreset(workspaceId, activePresetId);
  return (
    <WorkspaceShell workspaceId={workspaceId} activePresetId={activePresetId} onSelectTab={onSelectTab}>
      <PanelBlock title={preset.label}>
        <p className="text-sm text-slate-600">
          Rule family <strong>{preset.filter}</strong> in the shared automations engine.
        </p>
      </PanelBlock>
    </WorkspaceShell>
  );
}

function ConfigBody({ workspaceId, activePresetId, onSelectTab }: WorkspaceBodyProps) {
  const preset = resolveWorkspacePreset(workspaceId, activePresetId);
  return (
    <WorkspaceShell workspaceId={workspaceId} activePresetId={activePresetId} onSelectTab={onSelectTab}>
      <PanelBlock title={preset.label}>
        <p className="text-sm text-slate-600">
          Configuration section <strong>{preset.label}</strong>
          {preset.filter ? ` — focus: ${preset.filter}` : ""}.
        </p>
      </PanelBlock>
    </WorkspaceShell>
  );
}

function BusinessBody({ workspaceId, activePresetId, onSelectTab }: WorkspaceBodyProps) {
  const preset = resolveWorkspacePreset(workspaceId, activePresetId);
  return (
    <WorkspaceShell workspaceId={workspaceId} activePresetId={activePresetId} onSelectTab={onSelectTab}>
      <PlaceholderGrid
        tiles={[
          { label: "Plan", value: "Growth" },
          { label: "Invoices", value: "—" },
          { label: "Entities", value: "—" },
          { label: "Exports", value: "—" }
        ]}
      />
      <PanelBlock title={preset.label}>
        <p className="text-sm text-slate-600">Business view: {preset.label}</p>
      </PanelBlock>
    </WorkspaceShell>
  );
}

function AnalyticsBody({ workspaceId, activePresetId, onSelectTab }: WorkspaceBodyProps) {
  const preset = resolveWorkspacePreset(workspaceId, activePresetId);
  return (
    <WorkspaceShell workspaceId={workspaceId} activePresetId={activePresetId} onSelectTab={onSelectTab}>
      <PlaceholderGrid
        tiles={[
          { label: "Revenue", value: "—" },
          { label: "Orders", value: "—" },
          { label: "Avg ticket", value: "—" },
          { label: "Covers", value: "—" }
        ]}
      />
      <PanelBlock title={preset.label}>
        <div className="admin-ws-chart-placeholder flex h-48 items-center justify-center rounded-xl border text-sm text-slate-500">
          {preset.label} charts
        </div>
      </PanelBlock>
    </WorkspaceShell>
  );
}

function WorkspaceBody({ workspaceId, activePresetId, onSelectTab }: WorkspaceBodyProps) {
  switch (workspaceId) {
    case "live-ops":
      return <LiveOpsBody workspaceId={workspaceId} activePresetId={activePresetId} onSelectTab={onSelectTab} />;
    case "orders":
      return <OrdersBody workspaceId={workspaceId} activePresetId={activePresetId} onSelectTab={onSelectTab} />;
    case "venue":
      return <VenueBody workspaceId={workspaceId} activePresetId={activePresetId} onSelectTab={onSelectTab} />;
    case "devices":
      return <DevicesBody workspaceId={workspaceId} activePresetId={activePresetId} onSelectTab={onSelectTab} />;
    case "comms":
      return <CommsBody workspaceId={workspaceId} activePresetId={activePresetId} onSelectTab={onSelectTab} />;
    case "automations":
      return <AutomationsBody workspaceId={workspaceId} activePresetId={activePresetId} onSelectTab={onSelectTab} />;
    case "config":
      return <ConfigBody workspaceId={workspaceId} activePresetId={activePresetId} onSelectTab={onSelectTab} />;
    case "business":
      return <BusinessBody workspaceId={workspaceId} activePresetId={activePresetId} onSelectTab={onSelectTab} />;
    case "analytics":
      return <AnalyticsBody workspaceId={workspaceId} activePresetId={activePresetId} onSelectTab={onSelectTab} />;
    default:
      return <LiveOpsBody workspaceId="live-ops" activePresetId="live-overview" onSelectTab={onSelectTab} />;
  }
}

type Props = {
  workspaceId: WorkspaceId;
  presetId: string;
};

export function AdminWorkspaceView({ workspaceId, presetId: routePresetId }: Props) {
  const [activePresetId, setActivePresetId] = useState(routePresetId);
  const lastByTabRef = useRef<Record<string, string>>({});

  useEffect(() => {
    setActivePresetId(routePresetId);
    const preset = resolveWorkspacePreset(workspaceId, routePresetId);
    lastByTabRef.current[preset.tab] = routePresetId;
  }, [workspaceId, routePresetId]);

  const selectPreset = useCallback(
    (id: string) => {
      const preset = resolveWorkspacePreset(workspaceId, id);
      lastByTabRef.current[preset.tab] = id;
      setActivePresetId(id);
      syncAdminNavHash(`#ws-${workspaceId}/${id}`);
    },
    [workspaceId]
  );

  const onSelectTab = useCallback(
    (tab: string) => {
      const presets = WORKSPACE_PRESETS[workspaceId].filter((p) => p.tab === tab);
      const remembered = lastByTabRef.current[tab];
      const target = presets.find((p) => p.id === remembered) ?? presets[0];
      if (target) selectPreset(target.id);
    },
    [workspaceId, selectPreset]
  );

  return <WorkspaceBody workspaceId={workspaceId} activePresetId={activePresetId} onSelectTab={onSelectTab} />;
}
