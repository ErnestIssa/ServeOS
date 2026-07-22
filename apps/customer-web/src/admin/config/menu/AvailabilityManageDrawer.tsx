import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  manageAvailability,
  type AvailabilityCardPayload,
  type AvailabilityChannel,
  type AvailabilityManageAction,
  type AvailabilityVisibility,
  type MenuAvailabilityWindow,
  type MenuSurfaceRow
} from "../../../api";
import { AdminInput, AdminLabel, inputBase } from "../../AdminUi";
import { useAdminToast } from "../../AdminToast";
import { useModalScrollLock } from "../../../lib/modalScrollLock";
import {
  MENU_PAGE_DRAWER_BACKDROP_CLASS,
  MENU_PAGE_DRAWER_SHELL_CLASS,
  MenuPageModalShell,
  ProfileModalAlert,
  ProfileModalFooter
} from "./menuPageModalShell";
import { MenuSurfacePagination } from "./MenuSurfacePagination";
import { useMenuListPagination } from "./useMenuListPagination";
import { isUiOnlyListId } from "./menuListUiMocks";
import { CHANNEL_LABELS, STATUS_LABELS } from "./availabilityHelpers";

const SCOPE_PAGE_SIZE = 8;
const ALL_CHANNELS: AvailabilityChannel[] = ["DINE_IN", "TAKEAWAY", "DELIVERY", "QR", "KIOSK", "STAFF"];

type Props = {
  open: boolean;
  cards: AvailabilityCardPayload[];
  selectedKeys: Set<string>;
  menus: MenuSurfaceRow[];
  locations: Array<{ id: string; name: string }>;
  token: string;
  restaurantId: string;
  venueName: string;
  onClose: () => void;
  onRefresh: () => void;
  onClearSelection: () => void;
  onEditWindow: (card: AvailabilityCardPayload) => void;
  onPreviewWindow: (card: AvailabilityCardPayload) => void;
};

type Panel =
  | null
  | "channels"
  | "locations"
  | "visibility"
  | "business"
  | "temporary"
  | "seasonal"
  | "apply_menus"
  | "history"
  | "import"
  | "danger_remove"
  | "danger_reset";

function cardRefKey(card: AvailabilityCardPayload) {
  return `${card.menuId}:${card.key}`;
}

function ScopeChip({ card }: { card: AvailabilityCardPayload }) {
  const tone = card.evaluation.orderable ? "live" : "draft";
  return (
    <li>
      <span
        className={`admin-menu-manage-scope-chip admin-menu-manage-scope-chip--${tone}`}
        title={`${card.window.label} — ${card.menuName} · ${STATUS_LABELS[card.evaluation.status]}`}
      >
        {card.window.label}
      </span>
    </li>
  );
}

function ActionBtn({
  label,
  desc,
  onClick,
  disabled,
  future
}: {
  label: string;
  desc: string;
  onClick?: () => void;
  disabled?: boolean;
  future?: boolean;
}) {
  return (
    <button
      type="button"
      className="admin-menu-manage-action"
      disabled={disabled || future}
      onClick={onClick}
    >
      <span className="admin-menu-manage-action-label">
        {label}
        {future ? <span className="admin-avail-future-tag">Future</span> : null}
      </span>
      <span className="admin-menu-manage-action-desc">{desc}</span>
    </button>
  );
}

export function AvailabilityManageDrawer({
  open,
  cards,
  selectedKeys,
  menus,
  locations,
  token,
  restaurantId,
  venueName,
  onClose,
  onRefresh,
  onClearSelection,
  onEditWindow,
  onPreviewWindow
}: Props) {
  const { pushToast } = useAdminToast();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [error, setError] = useState<string | null>(null);

  const [channelDraft, setChannelDraft] = useState<AvailabilityChannel[]>([...ALL_CHANNELS]);
  const [locationMode, setLocationMode] = useState<"ALL" | "SELECTED">("ALL");
  const [locationIds, setLocationIds] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<AvailabilityVisibility>("CUSTOMERS");
  const [requiresManager, setRequiresManager] = useState(false);
  const [ageRestricted, setAgeRestricted] = useState(false);
  const [minAge, setMinAge] = useState("18");
  const [tempStart, setTempStart] = useState("");
  const [tempEnd, setTempEnd] = useState("");
  const [seasonStart, setSeasonStart] = useState("06-01");
  const [seasonEnd, setSeasonEnd] = useState("08-31");
  const [applyMenuIds, setApplyMenuIds] = useState<string[]>([]);
  const [importJson, setImportJson] = useState("");
  const [confirmName, setConfirmName] = useState("");

  const realCards = useMemo(
    () => cards.filter((c) => !isUiOnlyListId(c.menuId) && !c.key.startsWith("ui-mock-")),
    [cards]
  );

  const targets = useMemo(() => {
    if (selectedKeys.size === 0) return realCards;
    return realCards.filter((c) => selectedKeys.has(cardRefKey(c)));
  }, [realCards, selectedKeys]);

  const scopePager = useMenuListPagination(targets, {
    pageSize: SCOPE_PAGE_SIZE,
    resetKey: `${open ? "open" : "closed"}:${targets.map(cardRefKey).join(",")}`
  });

  const selectionLabel =
    selectedKeys.size > 0 ? `${selectedKeys.size} selected` : `${targets.length} in list`;

  const showManageShell = mounted && panel == null;

  useEffect(() => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (open) {
      setMounted(true);
      const frame = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setVisible(true));
      });
      return () => window.cancelAnimationFrame(frame);
    }
    setVisible(false);
    closeTimerRef.current = window.setTimeout(() => {
      setMounted(false);
      closeTimerRef.current = null;
    }, 520);
    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setPanel(null);
      setError(null);
      setBusy(false);
      setConfirmName("");
    }
  }, [open]);

  useModalScrollLock(mounted || panel != null);

  useEffect(() => {
    if (!visible || panel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, panel, onClose]);

  const refs = () => targets.map((c) => ({ menuId: c.menuId, key: c.key }));

  const runAction = async (
    action: AvailabilityManageAction,
    extra?: {
      patch?: Partial<MenuAvailabilityWindow>;
      targetMenuIds?: string[];
      importWindows?: Record<string, MenuAvailabilityWindow>;
    }
  ) => {
    if (targets.length === 0 && action !== "import_schedule") {
      pushToast("Select availability windows to manage.", "error");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await manageAvailability(token, restaurantId, {
      action,
      refs: refs(),
      ...extra
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.message ?? "Could not update availability.");
      pushToast(res.message ?? "Could not update availability.", "error");
      return false;
    }
    if (action === "export_rules" && res.exported) {
      const blob = new Blob([JSON.stringify(res.exported, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `serveos-availability-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      pushToast("Rules exported.", "success");
    } else {
      pushToast(
        res.affected ? `Updated ${res.affected} window${res.affected === 1 ? "" : "s"}.` : "Availability updated.",
        "success"
      );
    }
    onRefresh();
    if (action === "remove_rules") onClearSelection();
    setPanel(null);
    return true;
  };

  const openSingle = (mode: "edit" | "preview") => {
    if (targets.length === 0) {
      pushToast("Select a window first.", "error");
      return;
    }
    const card = targets[0];
    onClose();
    if (mode === "edit") onEditWindow(card);
    else onPreviewWindow(card);
  };

  const historyEntries = targets[0]?.window.history ?? [];

  if (!mounted && !panel) return null;

  return createPortal(
    <>
      {showManageShell ? (
        <div
          className={`admin-staff-profile-shell ${MENU_PAGE_DRAWER_SHELL_CLASS} ${visible ? "admin-staff-profile-shell--open" : ""}`}
          role="presentation"
          aria-hidden={!visible}
        >
          <button
            type="button"
            className={`${MENU_PAGE_DRAWER_BACKDROP_CLASS}${visible ? " is-active" : ""}`}
            aria-label="Close manage availability"
            tabIndex={visible ? 0 : -1}
            onClick={onClose}
          />
          <div
            role="dialog"
            aria-modal="true"
            tabIndex={visible ? 0 : -1}
            aria-label="Manage availability"
            className={`admin-staff-profile-panel admin-menu-item-profile-panel ${visible ? "admin-staff-profile-panel--open" : ""}`}
          >
            <header className="admin-staff-profile-header">
              <div className="min-w-0 flex-1">
                <h3 className="admin-staff-profile-title">Manage availability</h3>
                <p className="admin-staff-profile-sub">
                  {selectionLabel} · rule-based SSOT at {venueName}
                </p>
              </div>
              <button type="button" className="admin-staff-profile-close" onClick={onClose} aria-label="Close">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </header>

            <div className="admin-staff-profile-body admin-menu-item-profile-body admin-menu-manage-body">
              {targets.length === 0 ? (
                <p className="admin-staff-drawer-hint">
                  Select availability windows from the grid to manage rules — or create a window first.
                </p>
              ) : (
                <>
                  <section className="admin-staff-drawer-section">
                    <h4 className="admin-staff-drawer-section-title">In scope</h4>
                    <ul className={`admin-menu-manage-scope-list ${scopePager.pageClassName}`} key={scopePager.pageKey}>
                      {scopePager.pagedItems.map((c) => (
                        <ScopeChip key={cardRefKey(c)} card={c} />
                      ))}
                    </ul>
                    {scopePager.showPagination ? (
                      <MenuSurfacePagination
                        page={scopePager.page}
                        totalPages={scopePager.totalPages}
                        totalItems={scopePager.totalItems}
                        pageSize={scopePager.pageSize}
                        onPageChange={scopePager.goToPage}
                        label="In-scope availability pagination"
                        size="compact"
                      />
                    ) : null}
                    {targets[0] ? (
                      <div className="admin-avail-reason-panel">
                        <p className="admin-avail-reason-panel__title">
                          {targets[0].evaluation.orderable ? "Orderable because" : "Blocked because"}
                        </p>
                        <ul className="admin-avail-reason-list">
                          {targets[0].evaluation.reasons.map((r) => (
                            <li key={`${r.code}-${r.label}`} className={r.ok ? "is-ok" : "is-blocked"}>
                              <span aria-hidden>{r.ok ? "✓" : "✗"}</span> {r.label}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </section>

                  <section className="admin-staff-drawer-section">
                    <h4 className="admin-staff-drawer-section-title">Primary</h4>
                    <div className="admin-menu-manage-actions">
                      <ActionBtn
                        label={targets.length === 1 ? "Edit availability" : "Edit a window"}
                        desc="Update label, hours, days, and card color."
                        onClick={() => openSingle("edit")}
                      />
                      <ActionBtn
                        label="Make available now"
                        desc="Enable window and clear pause — guests can order when other rules pass."
                        disabled={busy}
                        onClick={() => void runAction("make_available")}
                      />
                      <ActionBtn
                        label="Make unavailable now"
                        desc="Intentionally hide this window (different from out of stock)."
                        disabled={busy}
                        onClick={() => void runAction("make_unavailable")}
                      />
                    </div>
                  </section>

                  <section className="admin-staff-drawer-section">
                    <h4 className="admin-staff-drawer-section-title">Scheduling</h4>
                    <div className="admin-menu-manage-actions">
                      <ActionBtn
                        label="Set recurring schedule"
                        desc="Every weekday, weekends, lunch hours — weekly rhythm."
                        disabled={busy}
                        onClick={() => void runAction("set_recurring")}
                      />
                      <ActionBtn
                        label="Set temporary availability"
                        desc="Date-bounded window (pop-up, event, soft launch)."
                        onClick={() => {
                          const w = targets[0]?.window;
                          setTempStart(w?.temporaryStartAt?.slice(0, 16) ?? "");
                          setTempEnd(w?.temporaryEndAt?.slice(0, 16) ?? "");
                          setPanel("temporary");
                        }}
                      />
                      <ActionBtn
                        label="Set seasonal availability"
                        desc="Christmas menu, summer menu — month/day seasons."
                        onClick={() => {
                          const w = targets[0]?.window;
                          setSeasonStart(w?.seasonalStartMd ?? "06-01");
                          setSeasonEnd(w?.seasonalEndMd ?? "08-31");
                          setPanel("seasonal");
                        }}
                      />
                    </div>
                  </section>

                  <section className="admin-staff-drawer-section">
                    <h4 className="admin-staff-drawer-section-title">Inventory</h4>
                    <p className="admin-staff-drawer-hint admin-avail-inline-hint">
                      Out of stock ≠ unavailable. Unavailable hides intentionally; out of stock means it should sell when inventory returns.
                    </p>
                    <div className="admin-menu-manage-actions">
                      <ActionBtn
                        label="Mark out of stock"
                        desc="Keep the window enabled but block ordering."
                        disabled={busy}
                        onClick={() => void runAction("mark_out_of_stock")}
                      />
                      <ActionBtn
                        label="Restock"
                        desc="Clear out-of-stock and resume when schedule allows."
                        disabled={busy}
                        onClick={() => void runAction("restock")}
                      />
                      <ActionBtn label="Set stock quantity" desc="Track exact units remaining." future />
                      <ActionBtn label="Notify when back in stock" desc="Alert waitlisted guests." future />
                    </div>
                  </section>

                  <section className="admin-staff-drawer-section">
                    <h4 className="admin-staff-drawer-section-title">Restaurant operations</h4>
                    <div className="admin-menu-manage-actions">
                      <ActionBtn
                        label="Restrict channels"
                        desc="Dine-in, takeaway, delivery, QR, kiosk, staff."
                        onClick={() => {
                          setChannelDraft(targets[0]?.window.channels?.length ? [...targets[0].window.channels!] : [...ALL_CHANNELS]);
                          setPanel("channels");
                        }}
                      />
                    </div>
                  </section>

                  <section className="admin-staff-drawer-section">
                    <h4 className="admin-staff-drawer-section-title">Location</h4>
                    <div className="admin-menu-manage-actions">
                      <ActionBtn
                        label="Available at all locations"
                        desc="Share this rule across every venue."
                        disabled={busy}
                        onClick={() => void runAction("set_locations_all")}
                      />
                      <ActionBtn
                        label="Edit location availability"
                        desc="Limit to selected venues in your company."
                        onClick={() => {
                          const w = targets[0]?.window;
                          setLocationMode(w?.locationMode === "SELECTED" ? "SELECTED" : "ALL");
                          setLocationIds(w?.locationIds ?? []);
                          setPanel("locations");
                        }}
                      />
                      <ActionBtn
                        label="Copy availability to locations"
                        desc="Apply this window onto other menus (per venue surfaces)."
                        onClick={() => {
                          setApplyMenuIds([]);
                          setPanel("apply_menus");
                        }}
                      />
                    </div>
                  </section>

                  <section className="admin-staff-drawer-section">
                    <h4 className="admin-staff-drawer-section-title">Customer visibility</h4>
                    <div className="admin-menu-manage-actions">
                      <ActionBtn
                        label="Visibility & audience"
                        desc="Show to customers, hide, staff only, or internal testing."
                        onClick={() => {
                          setVisibility(targets[0]?.window.visibility ?? "CUSTOMERS");
                          setPanel("visibility");
                        }}
                      />
                    </div>
                  </section>

                  <section className="admin-staff-drawer-section">
                    <h4 className="admin-staff-drawer-section-title">Business rules</h4>
                    <div className="admin-menu-manage-actions">
                      <ActionBtn
                        label="Business rules"
                        desc="Manager approval, age restriction. Member / invite — future."
                        onClick={() => {
                          const w = targets[0]?.window;
                          setRequiresManager(Boolean(w?.requiresManagerApproval));
                          setAgeRestricted(Boolean(w?.ageRestricted));
                          setMinAge(String(w?.minAge ?? 18));
                          setPanel("business");
                        }}
                      />
                      <ActionBtn label="Member only" desc="Loyalty members can order." future />
                      <ActionBtn label="Invite only" desc="Private guest lists." future />
                    </div>
                  </section>

                  <section className="admin-staff-drawer-section">
                    <h4 className="admin-staff-drawer-section-title">Copy & bulk</h4>
                    <div className="admin-menu-manage-actions">
                      <ActionBtn
                        label="Copy schedule"
                        desc="Clone hours/days as a new window on the same menu."
                        disabled={busy}
                        onClick={() => void runAction("copy_schedule")}
                      />
                      <ActionBtn
                        label="Clone schedule"
                        desc="Copy the full availability rule set."
                        disabled={busy}
                        onClick={() => void runAction("copy_availability")}
                      />
                      <ActionBtn
                        label="Apply to other menus"
                        desc="Push rules onto selected menu surfaces."
                        onClick={() => {
                          setApplyMenuIds([]);
                          setPanel("apply_menus");
                        }}
                      />
                      <ActionBtn
                        label="Apply to category / child items"
                        desc="Propagate item-level stock & visibility from windows."
                        future
                      />
                      <ActionBtn label="Reset inherited availability" desc="Clear override chains." future />
                    </div>
                  </section>

                  <section className="admin-staff-drawer-section">
                    <h4 className="admin-staff-drawer-section-title">Advanced</h4>
                    <div className="admin-menu-manage-actions">
                      <ActionBtn
                        label="Export rules"
                        desc="Download JSON of selected windows."
                        disabled={busy}
                        onClick={() => void runAction("export_rules")}
                      />
                      <ActionBtn label="Import schedule" desc="Merge a JSON schedule into a menu." onClick={() => setPanel("import")} />
                      <ActionBtn label="View rule history" desc="Recent mutations for the first scoped window." onClick={() => setPanel("history")} />
                      <ActionBtn label="View audit log" desc="Same history trail — backend SSOT." onClick={() => setPanel("history")} />
                      <ActionBtn label="Preview availability" desc="Open guest-facing explanation for one window." onClick={() => openSingle("preview")} />
                    </div>
                  </section>

                  <section className="admin-staff-drawer-section admin-menu-manage-danger-zone">
                    <h4 className="admin-staff-drawer-section-title admin-menu-manage-danger-title">Danger</h4>
                    <div className="admin-menu-manage-danger-row" role="group" aria-label="Dangerous availability actions">
                      <button type="button" className="admin-menu-manage-danger-btn" onClick={() => setPanel("danger_reset")}>
                        <span className="admin-menu-manage-danger-btn-label">Reset to default</span>
                        <span className="admin-menu-manage-danger-btn-desc">Weekdays 09:00–17:00, all channels, customers.</span>
                      </button>
                      <button type="button" className="admin-menu-manage-danger-btn" onClick={() => setPanel("danger_remove")}>
                        <span className="admin-menu-manage-danger-btn-label">Remove availability rules</span>
                        <span className="admin-menu-manage-danger-btn-desc">Delete selected windows permanently.</span>
                      </button>
                    </div>
                  </section>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {panel === "channels" ? (
        <MenuPageModalShell open onClose={() => setPanel(null)} title="Restrict channels" titleId="avail-manage-panel" stackLevel="overlay" maxWidthClass="max-w-md">
          <p className="admin-staff-drawer-hint mb-3">Only checked channels can order under this window.</p>
          <div className="admin-avail-check-grid">
            {ALL_CHANNELS.map((ch) => {
              const on = channelDraft.includes(ch);
              return (
                <label key={ch} className={`admin-avail-check${on ? " is-on" : ""}`}>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() =>
                      setChannelDraft((prev) => (on ? prev.filter((c) => c !== ch) : [...prev, ch]))
                    }
                  />
                  <span>{CHANNEL_LABELS[ch]}</span>
                </label>
              );
            })}
          </div>
          {error ? <ProfileModalAlert tone="error">{error}</ProfileModalAlert> : null}
          <ProfileModalFooter
            cancelLabel="Back"
            onCancel={() => setPanel(null)}
            confirmLabel="Save channels"
            confirmDisabled={busy || channelDraft.length === 0}
            onConfirm={() => void runAction("set_channels", { patch: { channels: channelDraft } })}
          />
        </MenuPageModalShell>
      ) : null}

      {panel === "locations" ? (
        <MenuPageModalShell open onClose={() => setPanel(null)} title="Location availability" titleId="avail-manage-panel" stackLevel="overlay" maxWidthClass="max-w-md">
          <div className="admin-avail-check-grid mb-3">
            <label className={`admin-avail-check${locationMode === "ALL" ? " is-on" : ""}`}>
              <input type="radio" checked={locationMode === "ALL"} onChange={() => setLocationMode("ALL")} />
              <span>All locations</span>
            </label>
            <label className={`admin-avail-check${locationMode === "SELECTED" ? " is-on" : ""}`}>
              <input type="radio" checked={locationMode === "SELECTED"} onChange={() => setLocationMode("SELECTED")} />
              <span>Selected locations</span>
            </label>
          </div>
          {locationMode === "SELECTED" ? (
            <div className="admin-avail-check-grid">
              {locations.map((loc) => {
                const on = locationIds.includes(loc.id);
                return (
                  <label key={loc.id} className={`admin-avail-check${on ? " is-on" : ""}`}>
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() =>
                        setLocationIds((prev) => (on ? prev.filter((id) => id !== loc.id) : [...prev, loc.id]))
                      }
                    />
                    <span>{loc.name}</span>
                  </label>
                );
              })}
            </div>
          ) : null}
          {error ? <ProfileModalAlert tone="error">{error}</ProfileModalAlert> : null}
          <ProfileModalFooter
            cancelLabel="Back"
            onCancel={() => setPanel(null)}
            confirmLabel="Save locations"
            confirmDisabled={busy || (locationMode === "SELECTED" && locationIds.length === 0)}
            onConfirm={() =>
              void runAction(locationMode === "ALL" ? "set_locations_all" : "set_locations", {
                patch: { locationMode, locationIds }
              })
            }
          />
        </MenuPageModalShell>
      ) : null}

      {panel === "visibility" ? (
        <MenuPageModalShell open onClose={() => setPanel(null)} title="Customer visibility" titleId="avail-manage-panel" stackLevel="overlay" maxWidthClass="max-w-md">
          <div className="admin-avail-check-grid">
            {(
              [
                ["CUSTOMERS", "Show to customers"],
                ["HIDDEN", "Hide from customers"],
                ["STAFF_ONLY", "Staff only"],
                ["TESTING", "Internal testing"]
              ] as const
            ).map(([value, label]) => (
              <label key={value} className={`admin-avail-check${visibility === value ? " is-on" : ""}`}>
                <input type="radio" checked={visibility === value} onChange={() => setVisibility(value)} />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <ProfileModalFooter
            cancelLabel="Back"
            onCancel={() => setPanel(null)}
            confirmLabel="Save visibility"
            confirmDisabled={busy}
            onConfirm={() => void runAction("set_visibility", { patch: { visibility } })}
          />
        </MenuPageModalShell>
      ) : null}

      {panel === "business" ? (
        <MenuPageModalShell open onClose={() => setPanel(null)} title="Business rules" titleId="avail-manage-panel" stackLevel="overlay" maxWidthClass="max-w-md">
          <label className="admin-avail-check mb-2">
            <input type="checkbox" checked={requiresManager} onChange={(e) => setRequiresManager(e.target.checked)} />
            <span>Requires manager approval</span>
          </label>
          <label className="admin-avail-check mb-2">
            <input type="checkbox" checked={ageRestricted} onChange={(e) => setAgeRestricted(e.target.checked)} />
            <span>Age restricted</span>
          </label>
          {ageRestricted ? (
            <AdminLabel>
              Minimum age
              <AdminInput className={inputBase} value={minAge} onChange={(e) => setMinAge(e.target.value)} />
            </AdminLabel>
          ) : null}
          <ProfileModalFooter
            cancelLabel="Back"
            onCancel={() => setPanel(null)}
            confirmLabel="Save rules"
            confirmDisabled={busy}
            onConfirm={() =>
              void runAction("set_business_rules", {
                patch: {
                  requiresManagerApproval: requiresManager,
                  ageRestricted,
                  minAge: ageRestricted ? Number(minAge) || 18 : null
                }
              })
            }
          />
        </MenuPageModalShell>
      ) : null}

      {panel === "temporary" ? (
        <MenuPageModalShell open onClose={() => setPanel(null)} title="Temporary availability" titleId="avail-manage-panel" stackLevel="overlay" maxWidthClass="max-w-md">
          <AdminLabel>
            Starts
            <AdminInput
              className={inputBase}
              type="datetime-local"
              value={tempStart}
              onChange={(e) => setTempStart(e.target.value)}
            />
          </AdminLabel>
          <AdminLabel>
            Ends
            <AdminInput
              className={inputBase}
              type="datetime-local"
              value={tempEnd}
              onChange={(e) => setTempEnd(e.target.value)}
            />
          </AdminLabel>
          <ProfileModalFooter
            cancelLabel="Back"
            onCancel={() => setPanel(null)}
            confirmLabel="Save temporary"
            confirmDisabled={busy}
            onConfirm={() =>
              void runAction("set_temporary", {
                patch: {
                  temporaryStartAt: tempStart ? new Date(tempStart).toISOString() : null,
                  temporaryEndAt: tempEnd ? new Date(tempEnd).toISOString() : null
                }
              })
            }
          />
        </MenuPageModalShell>
      ) : null}

      {panel === "seasonal" ? (
        <MenuPageModalShell open onClose={() => setPanel(null)} title="Seasonal availability" titleId="avail-manage-panel" stackLevel="overlay" maxWidthClass="max-w-md">
          <p className="admin-staff-drawer-hint mb-2">Use MM-DD (e.g. 12-24 → 01-05 for Christmas).</p>
          <AdminLabel>
            Season start (MM-DD)
            <AdminInput className={inputBase} value={seasonStart} onChange={(e) => setSeasonStart(e.target.value)} />
          </AdminLabel>
          <AdminLabel>
            Season end (MM-DD)
            <AdminInput className={inputBase} value={seasonEnd} onChange={(e) => setSeasonEnd(e.target.value)} />
          </AdminLabel>
          <div className="admin-avail-preset-row">
            {(
              [
                ["Weekdays lunch", () => void runAction("set_recurring", { patch: { days: [1, 2, 3, 4, 5], start: "11:00", end: "15:00", label: targets[0]?.window.label } })],
                ["Weekends only", () => void runAction("set_recurring", { patch: { days: [0, 6], start: "10:00", end: "22:00" } })],
                ["Christmas", () => { setSeasonStart("12-20"); setSeasonEnd("01-05"); }]
              ] as const
            ).map(([label, fn]) => (
              <button key={label} type="button" className="admin-avail-preset" onClick={fn}>
                {label}
              </button>
            ))}
          </div>
          <ProfileModalFooter
            cancelLabel="Back"
            onCancel={() => setPanel(null)}
            confirmLabel="Save seasonal"
            confirmDisabled={busy}
            onConfirm={() =>
              void runAction("set_seasonal", {
                patch: { seasonalStartMd: seasonStart, seasonalEndMd: seasonEnd }
              })
            }
          />
        </MenuPageModalShell>
      ) : null}

      {panel === "apply_menus" ? (
        <MenuPageModalShell open onClose={() => setPanel(null)} title="Apply to other menus" titleId="avail-manage-panel" stackLevel="overlay" maxWidthClass="max-w-md">
          <div className="admin-avail-check-grid">
            {menus
              .filter((m) => m.status !== "ARCHIVED" && !targets.every((t) => t.menuId === m.id))
              .map((m) => {
                const on = applyMenuIds.includes(m.id);
                return (
                  <label key={m.id} className={`admin-avail-check${on ? " is-on" : ""}`}>
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() =>
                        setApplyMenuIds((prev) => (on ? prev.filter((id) => id !== m.id) : [...prev, m.id]))
                      }
                    />
                    <span>{m.name}</span>
                  </label>
                );
              })}
          </div>
          <ProfileModalFooter
            cancelLabel="Back"
            onCancel={() => setPanel(null)}
            confirmLabel="Apply"
            confirmDisabled={busy || applyMenuIds.length === 0}
            onConfirm={() => void runAction("apply_to_menus", { targetMenuIds: applyMenuIds })}
          />
        </MenuPageModalShell>
      ) : null}

      {panel === "history" ? (
        <MenuPageModalShell open onClose={() => setPanel(null)} title="Rule history / audit" titleId="avail-manage-panel" stackLevel="overlay" maxWidthClass="max-w-md">
          {historyEntries.length === 0 ? (
            <p className="admin-staff-drawer-hint">No history yet for this window.</p>
          ) : (
            <ul className="admin-avail-history-list">
              {[...historyEntries].reverse().map((h) => (
                <li key={`${h.at}-${h.action}`}>
                  <strong>{h.action}</strong>
                  <span>{new Date(h.at).toLocaleString()}</span>
                  {h.detail ? <em>{h.detail}</em> : null}
                </li>
              ))}
            </ul>
          )}
          <ProfileModalFooter
            cancelLabel="Close"
            onCancel={() => setPanel(null)}
            confirmLabel="Done"
            onConfirm={() => setPanel(null)}
          />
        </MenuPageModalShell>
      ) : null}

      {panel === "import" ? (
        <MenuPageModalShell open onClose={() => setPanel(null)} title="Import schedule" titleId="avail-manage-panel" stackLevel="overlay" maxWidthClass="max-w-md">
          <AdminLabel>
            Target menu
            <select
              className={inputBase}
              value={applyMenuIds[0] ?? menus[0]?.id ?? ""}
              onChange={(e) => setApplyMenuIds([e.target.value])}
            >
              {menus.filter((m) => m.status !== "ARCHIVED").map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </AdminLabel>
          <AdminLabel>
            JSON rules
            <textarea
              className={`${inputBase} min-h-[8rem] font-mono text-xs`}
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              placeholder='{"lunch":{"enabled":true,"start":"11:00","end":"15:00","days":[1,2,3,4,5],"label":"Lunch","color":"#059669"}}'
            />
          </AdminLabel>
          <ProfileModalFooter
            cancelLabel="Back"
            onCancel={() => setPanel(null)}
            confirmLabel="Import"
            confirmDisabled={busy}
            onConfirm={() => {
              try {
                const parsed = JSON.parse(importJson) as Record<string, MenuAvailabilityWindow>;
                void runAction("import_schedule", {
                  targetMenuIds: [applyMenuIds[0] ?? menus[0]?.id].filter(Boolean) as string[],
                  importWindows: parsed
                });
              } catch {
                pushToast("Invalid JSON.", "error");
              }
            }}
          />
        </MenuPageModalShell>
      ) : null}

      {panel === "danger_reset" || panel === "danger_remove" ? (
        <MenuPageModalShell
          open
          onClose={() => setPanel(null)}
          title={panel === "danger_reset" ? "Reset to default?" : "Remove availability rules?"}
          titleId="avail-manage-panel" stackLevel="overlay" maxWidthClass="max-w-md"
        >
          <p className="admin-staff-drawer-hint mb-3">
            {panel === "danger_reset"
              ? `Reset ${targets.length} window${targets.length === 1 ? "" : "s"} to weekday defaults.`
              : `Permanently delete ${targets.length} window${targets.length === 1 ? "" : "s"}.`}
          </p>
          <AdminLabel>
            Type RESET to confirm
            <AdminInput className={inputBase} value={confirmName} onChange={(e) => setConfirmName(e.target.value)} />
          </AdminLabel>
          {error ? <ProfileModalAlert tone="error">{error}</ProfileModalAlert> : null}
          <ProfileModalFooter
            cancelLabel="Back"
            onCancel={() => setPanel(null)}
            confirmLabel={panel === "danger_reset" ? "Reset" : "Remove"}
            danger
            confirmDisabled={busy || confirmName.trim().toUpperCase() !== "RESET"}
            onConfirm={() => void runAction(panel === "danger_reset" ? "reset_to_default" : "remove_rules")}
          />
        </MenuPageModalShell>
      ) : null}
    </>,
    document.body
  );
}
