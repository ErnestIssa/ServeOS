import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatMoneyCents } from "@serveos/core-shared/currency";
import {
  archiveQrCode,
  createQrCode,
  deactivateQrCode,
  duplicateQrCode,
  getQrCodeStats,
  listRestaurantMenus,
  listQrCodes,
  pauseQrOrdering,
  reactivateQrCode,
  resumeQrOrdering,
  type CreateQrCodeBody,
  type MenuSurfaceRow,
  type QrCodeRow,
  type QrCodeType,
  type QrDashboardStats,
  type QrExperience,
  type QrPaymentMode
} from "../../../api";
import {
  AdminBtnPrimary,
  AdminBtnSecondary,
  AdminEmptyState,
  AdminInput,
  AdminLabel,
  AdminPanel,
  AdminRefreshButton,
  AdminSectionHeader
} from "../../AdminUi";
import { AdminSkeletonStatGrid, AdminSkeletonTable, AdminStaleContent } from "../../AdminSkeleton";
import { useAdminToast } from "../../AdminToast";
import { useMenuCapabilities } from "../useMenuCapabilities";
import { CONFIG_PRESET_DESCRIPTIONS } from "../configRouting";
import { MenuListSearchField, MenuToolbarButton } from "../menu/MenuPageUi";
import { MenuEntityActionsMenu } from "../menu/MenuEntityActionsMenu";
import { MenuPageModalShell, ProfileModalAlert } from "../menu/menuPageModalShell";
import { MENU_LIST_PAGE_SIZE, useMenuListPagination } from "../menu/useMenuListPagination";
import { MenuSurfacePagination } from "../menu/MenuSurfacePagination";
import { applyQrListFilters, applyQrListSort, matchesQrSearch, QR_LIST_QUERY } from "./qrListQuery";
import { isUiOnlyQrId, UI_MOCK_QR_CODES } from "./qrListUiMocks";
import { buildQrCardActions, type QrCardActionId } from "./qrCardActions";
import { QrManageDrawer, type QrManageInitialFocus } from "./QrManageDrawer";
import { QrDetailsModal } from "./QrDetailsModal";

type Props = {
  token: string | null;
  restaurantId: string | null;
  venueName?: string;
};

const TYPE_LABEL: Record<QrCodeType, string> = {
  TABLE: "Table",
  MENU: "Menu",
  TAKEAWAY: "Takeaway",
  STAFF: "Staff",
  MARKETING: "Marketing",
  FEEDBACK: "Feedback"
};

function qrStatusLabel(row: QrCodeRow) {
  if (row.status === "ACTIVE") return "Active";
  if (row.status === "INACTIVE") return "Inactive";
  if (row.status === "ARCHIVED") return "Archived";
  return "Rotated";
}

function qrStatusClass(row: QrCodeRow) {
  if (row.status === "ACTIVE") return "admin-menu-surface-status--live";
  if (row.status === "INACTIVE") return "admin-menu-surface-status--archived";
  if (row.status === "ARCHIVED") return "admin-menu-surface-status--retired";
  return "admin-menu-surface-status--retired";
}

function qrCardDescription(row: QrCodeRow) {
  const bits = [row.areaLabel, row.tableLabel, row.locationLabel].filter(Boolean);
  if (bits.length) return bits.join(" · ");
  return `${TYPE_LABEL[row.type]} QR identity`;
}

function qrCardMeta(row: QrCodeRow) {
  const orderingHint = row.orderingPaused
    ? "Ordering paused"
    : row.allowOrdering
      ? "Ordering on"
      : "Browse only";
  return [
    TYPE_LABEL[row.type],
    row.menuName ? row.menuName : row.experience === "ORDERING" ? "Auto menu" : row.experience.replace(/_/g, " "),
    `${row.scanCount} scans`,
    `${row.orderCount} orders`,
    orderingHint
  ].join(" · ");
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

export function AdminConfigQrCodesPage({ token, restaurantId, venueName = "" }: Props) {
  const { pushToast } = useAdminToast();
  const caps = useMenuCapabilities(token, restaurantId);
  const canView = caps.can("menu", "view");
  const canManage = caps.can("menu", "publish");
  const selectAllRef = useRef<HTMLInputElement>(null);

  const [apiItems, setApiItems] = useState<QrCodeRow[]>([]);
  const [stats, setStats] = useState<QrDashboardStats | null>(null);
  const [menus, setMenus] = useState<MenuSurfaceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [activeSort, setActiveSort] = useState(QR_LIST_QUERY.defaultSort);
  const [createOpen, setCreateOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [detailsQr, setDetailsQr] = useState<QrCodeRow | null>(null);
  const [manageFocus, setManageFocus] = useState<QrManageInitialFocus>(null);
  const [selectedQrIds, setSelectedQrIds] = useState<Set<string>>(() => new Set());
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!token || !restaurantId) return;
    setLoading(true);
    setError(null);
    const [listRes, statsRes, menusRes] = await Promise.all([
      listQrCodes(token, restaurantId),
      getQrCodeStats(token, restaurantId),
      listRestaurantMenus(token, restaurantId, "PUBLISHED")
    ]);
    setLoading(false);
    if (!listRes.ok) {
      setError(listRes.message ?? listRes.error ?? "Could not load QR codes");
      return;
    }
    const nextItems = listRes.items ?? [];
    setApiItems(nextItems);
    if (statsRes.ok && statsRes.stats) setStats(statsRes.stats);
    if (menusRes.ok) setMenus(menusRes.menus ?? []);
    setSelectedQrIds((prev) => {
      const next = new Set<string>();
      for (const id of prev) {
        if (nextItems.some((i) => i.id === id)) next.add(id);
      }
      return next;
    });
  }, [token, restaurantId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const items = useMemo(() => [...apiItems, ...UI_MOCK_QR_CODES], [apiItems]);
  const realItems = useMemo(() => items.filter((r) => !isUiOnlyQrId(r.id)), [items]);

  const filteredItems = useMemo(() => {
    const searched = items.filter((r) => matchesQrSearch(r, searchQuery));
    const filtered = applyQrListFilters(searched, activeFilters);
    return applyQrListSort(filtered, activeSort);
  }, [items, searchQuery, activeFilters, activeSort]);

  const pager = useMenuListPagination(filteredItems, {
    pageSize: MENU_LIST_PAGE_SIZE,
    resetKey: `${searchQuery.trim().toLowerCase()}:${activeFilters.join(",")}:${activeSort}:${apiItems.length}`
  });
  const pagedItems = pager.pagedItems;
  const selectablePaged = useMemo(() => pagedItems.filter((r) => !isUiOnlyQrId(r.id)), [pagedItems]);

  const allPageSelected =
    selectablePaged.length > 0 && selectablePaged.every((r) => selectedQrIds.has(r.id));
  const somePageSelected = selectablePaged.some((r) => selectedQrIds.has(r.id));
  const hasSelection = selectedQrIds.size > 0;

  useEffect(() => {
    const el = selectAllRef.current;
    if (!el) return;
    el.indeterminate = somePageSelected && !allPageSelected;
  }, [somePageSelected, allPageSelected]);

  const toggleQrSelection = (qrId: string, nextChecked?: boolean) => {
    if (isUiOnlyQrId(qrId)) return;
    setSelectedQrIds((prev) => {
      const next = new Set(prev);
      const shouldCheck = nextChecked ?? !next.has(qrId);
      if (shouldCheck) next.add(qrId);
      else next.delete(qrId);
      return next;
    });
  };

  const toggleSelectAllPaged = (checked: boolean) => {
    setSelectedQrIds((prev) => {
      const next = new Set(prev);
      for (const row of selectablePaged) {
        if (checked) next.add(row.id);
        else next.delete(row.id);
      }
      return next;
    });
  };

  const openManage = (focus: QrManageInitialFocus = null, selectId?: string) => {
    if (selectId && !isUiOnlyQrId(selectId)) {
      setSelectedQrIds(new Set([selectId]));
    }
    setManageFocus(focus);
    setManageOpen(true);
  };

  const runCardAction = async (row: QrCodeRow, actionId: QrCardActionId) => {
    setOpenMenuId(null);

    if (actionId === "view_details") {
      setDetailsQr(row);
      return;
    }
    if (actionId === "preview_guest" || actionId === "open_destination" || actionId === "test_scan") {
      window.open(row.publicUrl, "_blank", "noopener,noreferrer");
      return;
    }
    if (actionId === "view_ordering_rules") {
      openManage("ordering", row.id);
      return;
    }
    if (actionId === "edit_qr") {
      openManage("general", row.id);
      return;
    }
    if (actionId === "download_png") {
      window.open(row.pngDownloadUrl, "_blank", "noopener,noreferrer");
      return;
    }
    if (actionId === "download_svg") {
      window.open(row.svgDownloadUrl, "_blank", "noopener,noreferrer");
      return;
    }
    if (actionId === "copy_link") {
      await navigator.clipboard.writeText(row.publicUrl);
      pushToast("Link copied.", "success");
      return;
    }
    if (actionId === "copy_public_code") {
      await navigator.clipboard.writeText(row.publicCode);
      pushToast("Public code copied.", "success");
      return;
    }
    if (actionId === "print_qr") {
      const win = window.open(row.pngDownloadUrl, "_blank", "noopener,noreferrer");
      try {
        win?.print?.();
      } catch {
        /* open alone is enough */
      }
      return;
    }
    if (actionId === "view_analytics" || actionId === "view_activity") {
      openManage("analytics", row.id);
      return;
    }
    if (actionId === "open_manager") {
      openManage(null, row.id);
      return;
    }

    const mutating: QrCardActionId[] = [
      "activate",
      "deactivate",
      "pause_ordering",
      "resume_ordering",
      "duplicate",
      "archive"
    ];
    if (mutating.includes(actionId)) {
      if (isUiOnlyQrId(row.id)) {
        pushToast("Preview-only QR — create a real one to use this action.", "error");
        return;
      }
      if (!token || !restaurantId || !canManage) return;

      let res: { ok: boolean; qr?: QrCodeRow; message?: string; error?: string };
      let okMsg = "Done.";
      if (actionId === "activate") {
        res = await reactivateQrCode(token, restaurantId, row.id);
        okMsg = "QR activated.";
      } else if (actionId === "deactivate") {
        res = await deactivateQrCode(token, restaurantId, row.id);
        okMsg = "QR deactivated.";
      } else if (actionId === "pause_ordering") {
        res = await pauseQrOrdering(token, restaurantId, row.id);
        okMsg = "Ordering paused.";
      } else if (actionId === "resume_ordering") {
        res = await resumeQrOrdering(token, restaurantId, row.id);
        okMsg = "Ordering resumed.";
      } else if (actionId === "duplicate") {
        res = await duplicateQrCode(token, restaurantId, row.id);
        okMsg = "QR duplicated.";
      } else if (actionId === "archive") {
        res = await archiveQrCode(token, restaurantId, row.id);
        okMsg = "QR archived.";
      } else {
        return;
      }
      if (!res.ok || !res.qr) {
        pushToast(res.message ?? res.error ?? "Action failed", "error");
        return;
      }
      pushToast(okMsg, "success");
      if (actionId === "duplicate") {
        setSelectedQrIds(new Set([res.qr.id]));
        setManageFocus(null);
        setManageOpen(true);
      }
      void reload();
    }
  };

  if (!token || !restaurantId) {
    return (
      <AdminPanel id="ws-config" className="admin-top-page admin-panel--edge admin-config-page">
        <AdminSectionHeader eyebrowText="Configuration" title="QR codes" description={CONFIG_PRESET_DESCRIPTIONS["qr-codes"]} />
        <AdminEmptyState>Select a venue to manage QR ordering identities.</AdminEmptyState>
      </AdminPanel>
    );
  }

  if (!canView) {
    return (
      <AdminPanel id="ws-config" className="admin-top-page admin-panel--edge admin-config-page">
        <AdminSectionHeader eyebrowText="Configuration" title="QR codes" description={CONFIG_PRESET_DESCRIPTIONS["qr-codes"]} />
        <AdminEmptyState>You need menu view permission to see QR codes.</AdminEmptyState>
      </AdminPanel>
    );
  }

  return (
    <AdminPanel id="ws-config" className="admin-top-page admin-panel--edge admin-config-page">
      <AdminSectionHeader
        eyebrowText="Configuration"
        title="QR codes"
        description={CONFIG_PRESET_DESCRIPTIONS["qr-codes"]}
        action={<AdminRefreshButton onRefresh={() => void reload()} refreshing={loading} />}
      />

      <AdminStaleContent refreshing={loading && apiItems.length > 0}>
        {loading && !stats ? (
          <AdminSkeletonStatGrid count={4} />
        ) : stats ? (
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Active" value={String(stats.activeCount)} hint={`${stats.tableCount} table QRs`} />
            <StatTile label="Scans today" value={String(stats.scansToday)} hint={`${stats.totalScans} all-time`} />
            <StatTile label="Orders today" value={String(stats.ordersToday)} hint={`${stats.totalOrders} from QR`} />
            <StatTile
              label="Revenue today"
              value={formatMoneyCents(stats.revenueTodayCents, { currency: "SEK" })}
              hint={venueName || "QR-attributed"}
            />
          </div>
        ) : null}

        {error ? <p className="mb-3 text-sm text-rose-600">{error}</p> : null}

        {loading && apiItems.length === 0 ? (
          <AdminSkeletonTable rows={6} columns={4} />
        ) : (
          <div className="admin-menu-surface-board">
            <div className="admin-menu-surface-board-head">
              <div className="min-w-0">
                <h3 className="admin-menu-surface-board-title">QR identities</h3>
                <p className="admin-menu-surface-board-desc">
                  Permanent digital locations. Guests scan → temporary ordering session. Print packs and abuse alerts come later.
                </p>
              </div>
              <div className="admin-menu-surface-board-actions">
                {realItems.length > 0 ? (
                  <MenuToolbarButton
                    onClick={() => {
                      setManageFocus(null);
                      setManageOpen(true);
                    }}
                  >
                    {hasSelection ? "Manage selected" : "Manage"}
                  </MenuToolbarButton>
                ) : null}
                {canManage ? (
                  <MenuToolbarButton primary onClick={() => setCreateOpen(true)}>
                    Create QR
                  </MenuToolbarButton>
                ) : null}
              </div>
            </div>

            {items.length > 0 ? (
              <MenuListSearchField
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search QR codes by name, table, type, or code…"
                aria-label="Search QR codes"
                filterGroups={QR_LIST_QUERY.filterGroups}
                sortOptions={QR_LIST_QUERY.sortOptions}
                defaultSort={QR_LIST_QUERY.defaultSort}
                activeFilters={activeFilters}
                activeSort={activeSort}
                totalCount={items.length}
                resultCount={filteredItems.length}
                onFiltersChange={setActiveFilters}
                onSortChange={setActiveSort}
                filterTitle="Filter QR codes"
                filterSubtitle="Narrow identities using type, status, and rules."
                sortTitle="Sort QR codes"
                sortSubtitle="Changes apply to the list instantly."
              />
            ) : null}

            {items.length === 0 ? (
              <p className="admin-config-text-muted py-2 text-sm">
                No QR codes yet. Create a permanent table or menu QR — the printed link stays valid; each scan starts a fresh session.
              </p>
            ) : filteredItems.length === 0 ? (
              <p className="admin-config-text-muted py-2 text-sm">No QR codes match your search or filters.</p>
            ) : (
              <>
                <label className="admin-menu-surface-select-all">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    className="admin-menu-surface-checkbox"
                    checked={allPageSelected}
                    aria-label="Select all QR codes on this page"
                    onChange={(e) => toggleSelectAllPaged(e.target.checked)}
                  />
                  <span className="admin-menu-surface-select-all-label">Select all on page</span>
                </label>

                <ul className={`admin-menu-surface-list ${pager.pageClassName}`} key={pager.pageKey}>
                  {pagedItems.map((row, index) => {
                    const uiOnly = isUiOnlyQrId(row.id);
                    const isSelected = selectedQrIds.has(row.id);
                    return (
                      <li
                        key={row.id}
                        className="admin-menu-surface-list-item"
                        style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
                      >
                        <div className={`admin-menu-surface-card${isSelected ? " is-selected" : ""}`}>
                          <label className="admin-menu-surface-checkbox-wrap">
                            <input
                              type="checkbox"
                              className="admin-menu-surface-checkbox"
                              checked={isSelected}
                              disabled={uiOnly}
                              aria-label={uiOnly ? `${row.name} (preview only)` : `Select ${row.name}`}
                              onChange={(e) => toggleQrSelection(row.id, e.target.checked)}
                            />
                          </label>

                          <span className={`admin-menu-surface-status ${qrStatusClass(row)}`}>
                            {qrStatusLabel(row)}
                          </span>

                          <div className="admin-menu-surface-main">
                            <span className="admin-menu-surface-name">{row.name}</span>
                            <span className="admin-menu-surface-sep" aria-hidden>
                              ·
                            </span>
                            <span className="admin-menu-surface-desc">{qrCardDescription(row)}</span>
                            <span className="admin-menu-surface-sep" aria-hidden>
                              ·
                            </span>
                            <span className="admin-menu-surface-meta">{qrCardMeta(row)}</span>
                          </div>

                          <div className="admin-menu-surface-actions">
                            <MenuEntityActionsMenu
                              entityName={row.name}
                              subtitle={TYPE_LABEL[row.type]}
                              hideHeader
                              open={openMenuId === row.id}
                              actions={buildQrCardActions(row, { canView, canManage })}
                              onToggle={() => setOpenMenuId((cur) => (cur === row.id ? null : row.id))}
                              onAction={(id) => void runCardAction(row, id as QrCardActionId)}
                            />
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>

                {pager.showPagination ? (
                  <MenuSurfacePagination
                    page={pager.page}
                    totalPages={pager.totalPages}
                    totalItems={pager.totalItems}
                    pageSize={pager.pageSize}
                    onPageChange={pager.goToPage}
                    label="QR codes pagination"
                  />
                ) : null}
              </>
            )}
          </div>
        )}
      </AdminStaleContent>

      <QrCreateWizardModal
        open={createOpen}
        token={token}
        restaurantId={restaurantId}
        menus={menus}
        onClose={() => setCreateOpen(false)}
        onCreated={(qr) => {
          setCreateOpen(false);
          setSelectedQrIds(new Set([qr.id]));
          setManageFocus(null);
          setManageOpen(true);
          pushToast("QR identity created.", "success");
          void reload();
        }}
      />

      <QrManageDrawer
        open={manageOpen}
        venueName={venueName}
        token={token}
        restaurantId={restaurantId}
        items={realItems}
        selectedQrIds={selectedQrIds}
        menus={menus}
        canManage={canManage}
        onClose={() => {
          setManageOpen(false);
          setManageFocus(null);
        }}
        onRefresh={() => void reload()}
        onClearSelection={() => setSelectedQrIds(new Set())}
        initialFocus={manageFocus}
      />

      <QrDetailsModal open={Boolean(detailsQr)} qr={detailsQr} onClose={() => setDetailsQr(null)} />
    </AdminPanel>
  );
}

function QrCreateWizardModal({
  open,
  token,
  restaurantId,
  menus,
  onClose,
  onCreated
}: {
  open: boolean;
  token: string;
  restaurantId: string;
  menus: MenuSurfaceRow[];
  onClose: () => void;
  onCreated: (qr: QrCodeRow) => void;
}) {
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<QrCodeType>("TABLE");
  const [name, setName] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [areaLabel, setAreaLabel] = useState("");
  const [tableLabel, setTableLabel] = useState("");
  const [experience, setExperience] = useState<QrExperience>("ORDERING");
  const [paymentMode, setPaymentMode] = useState<QrPaymentMode>("PAY_AT_VENUE");
  const [menuId, setMenuId] = useState("");
  const [allowOrdering, setAllowOrdering] = useState(true);
  const [headline, setHeadline] = useState("Scan to order");

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setError(null);
    setType("TABLE");
    setName("");
    setLocationLabel("");
    setAreaLabel("");
    setTableLabel("");
    setExperience("ORDERING");
    setPaymentMode("PAY_AT_VENUE");
    setMenuId("");
    setAllowOrdering(true);
    setHeadline("Scan to order");
  }, [open]);

  useEffect(() => {
    if (type === "TAKEAWAY") {
      setPaymentMode("PREPAY");
      setExperience("ORDERING");
      setAllowOrdering(true);
    } else if (type === "MENU") {
      setExperience("MENU_BROWSE");
      setAllowOrdering(false);
      setPaymentMode("PAY_AT_VENUE");
    } else if (type === "FEEDBACK") {
      setExperience("FEEDBACK");
      setAllowOrdering(false);
    } else if (type === "MARKETING") {
      setExperience("PROMOTION");
      setAllowOrdering(false);
    } else {
      setExperience("ORDERING");
      setAllowOrdering(true);
      setPaymentMode("PAY_AT_VENUE");
    }
  }, [type]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const body: CreateQrCodeBody = {
      name: name.trim() || tableLabel.trim() || TYPE_LABEL[type],
      type,
      experience,
      locationLabel: locationLabel.trim() || null,
      areaLabel: areaLabel.trim() || null,
      tableLabel: tableLabel.trim() || null,
      paymentMode,
      menuId: menuId || null,
      allowOrdering,
      headline: headline.trim() || "Scan to order"
    };
    const res = await createQrCode(token, restaurantId, body);
    setBusy(false);
    if (!res.ok || !res.qr) {
      setError(res.message ?? res.error ?? "Could not create QR");
      return;
    }
    onCreated(res.qr);
  };

  return (
    <MenuPageModalShell
      open={open}
      onClose={onClose}
      title="Create QR identity"
      description="Permanent digital location â€” guests get a fresh session on every scan."
      titleId="qr-create-title"
      stackLevel="overlay"
    >
      <div className="mb-4 flex gap-2 text-xs font-semibold uppercase tracking-wide admin-config-text-muted">
        {[1, 2, 3, 4].map((n) => (
          <span key={n} className={step === n ? "text-[var(--admin-accent,#0f766e)]" : ""}>
            {n}. {n === 1 ? "Where" : n === 2 ? "Experience" : n === 3 ? "Rules" : "Design"}
          </span>
        ))}
      </div>

      {step === 1 ? (
        <div className="space-y-3">
          <AdminLabel>
            <span className="text-xs admin-config-text-muted">Type</span>
            <select
              className="admin-input mt-1 w-full"
              value={type}
              onChange={(e) => setType(e.target.value as QrCodeType)}
            >
              {(Object.keys(TYPE_LABEL) as QrCodeType[]).map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </AdminLabel>
          <AdminLabel>
            <span className="text-xs admin-config-text-muted">Name</span>
            <AdminInput className="mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="Table 12" />
          </AdminLabel>
          <AdminLabel>
            <span className="text-xs admin-config-text-muted">Location</span>
            <AdminInput className="mt-1" value={locationLabel} onChange={(e) => setLocationLabel(e.target.value)} placeholder="Main restaurant" />
          </AdminLabel>
          <AdminLabel>
            <span className="text-xs admin-config-text-muted">Area</span>
            <AdminInput className="mt-1" value={areaLabel} onChange={(e) => setAreaLabel(e.target.value)} placeholder="Indoor" />
          </AdminLabel>
          {type === "TABLE" ? (
            <AdminLabel>
              <span className="text-xs admin-config-text-muted">Table label</span>
              <AdminInput className="mt-1" value={tableLabel} onChange={(e) => setTableLabel(e.target.value)} placeholder="Table 12" />
            </AdminLabel>
          ) : null}
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-3">
          <AdminLabel>
            <span className="text-xs admin-config-text-muted">Experience</span>
            <select
              className="admin-input mt-1 w-full"
              value={experience}
              onChange={(e) => setExperience(e.target.value as QrExperience)}
            >
              <option value="ORDERING">Ordering</option>
              <option value="MENU_BROWSE">Menu browsing</option>
              <option value="FEEDBACK">Feedback (soon)</option>
              <option value="PROMOTION">Promotion (soon)</option>
              <option value="RESERVATION">Reservation (soon)</option>
            </select>
          </AdminLabel>
          <p className="text-xs admin-config-text-subtle">
            Ordering and menu browse resolve to a guest session. Feedback / promo / reservation are creatable now and resolve later.
          </p>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={allowOrdering} onChange={(e) => setAllowOrdering(e.target.checked)} />
            Allow ordering
          </label>
          <AdminLabel>
            <span className="text-xs admin-config-text-muted">Payment</span>
            <select
              className="admin-input mt-1 w-full"
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value as QrPaymentMode)}
            >
              <option value="PAY_AT_VENUE">Pay at venue</option>
              <option value="PREPAY">Pay online</option>
              <option value="HYBRID">Both</option>
            </select>
          </AdminLabel>
          <AdminLabel>
            <span className="text-xs admin-config-text-muted">Menu destination</span>
            <select className="admin-input mt-1 w-full" value={menuId} onChange={(e) => setMenuId(e.target.value)}>
              <option value="">Auto (first published)</option>
              {menus.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </AdminLabel>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="space-y-3">
          <AdminLabel>
            <span className="text-xs admin-config-text-muted">Print headline</span>
            <AdminInput className="mt-1" value={headline} onChange={(e) => setHeadline(e.target.value)} />
          </AdminLabel>
          <p className="text-xs admin-config-text-subtle">
            After create you can download PNG. SVG/PDF print sheets and logo overlays are next.
          </p>
        </div>
      ) : null}

      {error ? <ProfileModalAlert tone="error">{error}</ProfileModalAlert> : null}

      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <AdminBtnSecondary type="button" onClick={onClose}>
          Cancel
        </AdminBtnSecondary>
        {step > 1 ? (
          <AdminBtnSecondary type="button" onClick={() => setStep((s) => s - 1)}>
            Back
          </AdminBtnSecondary>
        ) : null}
        {step < 4 ? (
          <AdminBtnPrimary type="button" onClick={() => setStep((s) => s + 1)}>
            Continue
          </AdminBtnPrimary>
        ) : (
          <AdminBtnPrimary type="button" disabled={busy} onClick={() => void submit()}>
            {busy ? "Creatingâ€¦" : "Create QR"}
          </AdminBtnPrimary>
        )}
      </div>
    </MenuPageModalShell>
  );
}
