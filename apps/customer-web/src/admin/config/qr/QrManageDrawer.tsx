import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatMoneyCents } from "@serveos/core-shared/currency";
import {
  archiveQrCode,
  bulkUpdateQrCodes,
  deactivateQrCode,
  getQrAnalytics,
  getQrManageContext,
  pauseQrOrdering,
  reactivateQrCode,
  resumeQrOrdering,
  rotateQrCode,
  updateQrCode,
  type MenuSurfaceRow,
  type QrAnalyticsSummary,
  type QrCodeRow,
  type QrExperience,
  type QrManageActionDescriptor,
  type QrManageContextPayload,
  type QrPaymentMode
} from "../../../api";
import { useModalScrollLock } from "../../../lib/modalScrollLock";
import { AdminBtnPrimary, AdminBtnSecondary, AdminInput, AdminLabel, AdminSelect } from "../../AdminUi";
import { useAdminToast } from "../../AdminToast";
import {
  MENU_PAGE_DRAWER_BACKDROP_CLASS,
  MENU_PAGE_DRAWER_SHELL_CLASS
} from "../menu/menuPageModalShell";
import { MenuSurfacePagination } from "../menu/MenuSurfacePagination";
import { useMenuListPagination } from "../menu/useMenuListPagination";
import { isUiOnlyQrId } from "./qrListUiMocks";

const SCOPE_PAGE_SIZE = 8;

const EXPERIENCE_OPTIONS: { value: QrExperience; label: string }[] = [
  { value: "ORDERING", label: "Ordering" },
  { value: "MENU_BROWSE", label: "Menu browse" },
  { value: "FEEDBACK", label: "Feedback" },
  { value: "PROMOTION", label: "Promotion" },
  { value: "RESERVATION", label: "Reservation" }
];

const PAYMENT_OPTIONS: { value: QrPaymentMode; label: string }[] = [
  { value: "PAY_AT_VENUE", label: "Pay at venue" },
  { value: "PREPAY", label: "Pay online" },
  { value: "HYBRID", label: "Both" }
];

export type QrManageInitialFocus =
  | "general"
  | "destination"
  | "ordering"
  | "analytics"
  | "security"
  | null;

type Props = {
  open: boolean;
  venueName: string;
  token: string;
  restaurantId: string;
  items: QrCodeRow[];
  selectedQrIds: Set<string>;
  menus: MenuSurfaceRow[];
  canManage: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onClearSelection: () => void;
  initialFocus?: QrManageInitialFocus;
};

function scopeTone(status: QrCodeRow["status"]) {
  if (status === "ACTIVE") return "live";
  if (status === "INACTIVE") return "draft";
  return "retired";
}

function ScopeChip({ qr }: { qr: QrCodeRow }) {
  return (
    <li>
      <span
        className={`admin-menu-manage-scope-chip admin-menu-manage-scope-chip--${scopeTone(qr.status)}`}
        title={`${qr.name} — ${qr.status}`}
      >
        {qr.name}
      </span>
    </li>
  );
}

function buildLocalManageActions(targets: QrCodeRow[]): QrManageActionDescriptor[] {
  const actions: QrManageActionDescriptor[] = [];
  if (targets.length === 0) return actions;

  if (targets.length === 1) {
    const qr = targets[0]!;
    actions.push(
      { id: "edit-general", label: "Edit general", description: "Name, notes, location labels" },
      { id: "edit-destination", label: "Edit destination", description: "Experience, menu, payment" },
      { id: "edit-ordering", label: "Edit ordering", description: "Allow ordering, pause, session TTL" },
      { id: "download-png", label: "Download PNG" },
      { id: "download-svg", label: "Download SVG" },
      { id: "copy-link", label: "Copy link" },
      { id: "view-analytics", label: "View analytics" }
    );
    if (qr.status === "ACTIVE") actions.push({ id: "deactivate", label: "Deactivate" });
    else if (qr.status === "INACTIVE") actions.push({ id: "activate", label: "Activate" });
    if (qr.status !== "ROTATED" && qr.status !== "ARCHIVED") {
      if (qr.orderingPaused) actions.push({ id: "resume-ordering", label: "Resume ordering" });
      else actions.push({ id: "pause-ordering", label: "Pause ordering" });
      actions.push({ id: "rotate", label: "Rotate", description: "Invalidate printed URL", danger: true });
      actions.push({ id: "archive", label: "Archive", danger: true });
    }
    return actions;
  }

  const mutable = targets.filter((t) => t.status !== "ROTATED" && t.status !== "ARCHIVED");
  if (mutable.length === 0) return actions;
  if (mutable.some((t) => t.status === "INACTIVE")) actions.push({ id: "activate", label: "Activate" });
  if (mutable.some((t) => t.status === "ACTIVE")) actions.push({ id: "deactivate", label: "Deactivate" });
  if (mutable.some((t) => !t.orderingPaused)) actions.push({ id: "pause-ordering", label: "Pause ordering" });
  if (mutable.some((t) => t.orderingPaused)) actions.push({ id: "resume-ordering", label: "Resume ordering" });
  actions.push({ id: "assign-menu", label: "Assign menu", description: "Assign menu — set in panel" });
  actions.push({
    id: "assign-payment",
    label: "Assign payment",
    description: "Set payment mode for selected codes"
  });
  actions.push({ id: "archive", label: "Archive", danger: true });
  return actions;
}

function formatWhen(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function previewOnlyToast() {
  return "Preview only — mock QR codes aren't saved.";
}

export function QrManageDrawer({
  open,
  venueName,
  token,
  restaurantId,
  items,
  selectedQrIds,
  menus,
  canManage,
  onClose,
  onRefresh,
  onClearSelection,
  initialFocus = null
}: Props) {
  const { pushToast } = useAdminToast();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const sectionRefs = useRef<Partial<Record<NonNullable<QrManageInitialFocus>, HTMLElement | null>>>({});

  const [context, setContext] = useState<QrManageContextPayload | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [analytics, setAnalytics] = useState<QrAnalyticsSummary | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [areaLabel, setAreaLabel] = useState("");
  const [tableLabel, setTableLabel] = useState("");
  const [experience, setExperience] = useState<QrExperience>("ORDERING");
  const [menuId, setMenuId] = useState("");
  const [paymentMode, setPaymentMode] = useState<QrPaymentMode>("PAY_AT_VENUE");
  const [allowOrdering, setAllowOrdering] = useState(true);
  const [orderingPaused, setOrderingPaused] = useState(false);
  const [sessionTtlHours, setSessionTtlHours] = useState("");
  const [headline, setHeadline] = useState("");
  const [showRestaurantLogo, setShowRestaurantLogo] = useState(true);
  const [showServeosBranding, setShowServeosBranding] = useState(false);

  const [bulkPaymentMode, setBulkPaymentMode] = useState<QrPaymentMode>("PAY_AT_VENUE");
  const [bulkMenuId, setBulkMenuId] = useState("");

  const targets = context?.targets ?? [];
  const actions: QrManageActionDescriptor[] = context?.actions ?? [];
  const safeActions = useMemo(() => actions.filter((a) => !a.danger), [actions]);
  const dangerActions = useMemo(() => actions.filter((a) => a.danger), [actions]);
  const single = targets.length === 1 ? targets[0]! : null;
  const realTargets = useMemo(() => targets.filter((t) => !isUiOnlyQrId(t.id)), [targets]);
  const allUiOnly = targets.length > 0 && realTargets.length === 0;

  const selectedKey = useMemo(() => [...selectedQrIds].sort().join(","), [selectedQrIds]);

  const scopePager = useMenuListPagination(targets, {
    pageSize: SCOPE_PAGE_SIZE,
    resetKey: `${open ? "open" : "closed"}:${targets.map((q) => q.id).join(",")}`
  });

  const selectionLabel =
    selectedQrIds.size > 0 ? `${selectedQrIds.size} selected` : `${items.length} in list`;

  const scrollToSection = (key: NonNullable<QrManageInitialFocus>) => {
    const el = sectionRefs.current[key];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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
      setContext(null);
      setAnalytics(null);
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
    if (!open) return;
    setContextLoading(true);
    setAnalytics(null);

    const selectedIds = [...selectedQrIds];
    const realSelected = selectedIds.filter((id) => !isUiOnlyQrId(id));
    const mockSelected = selectedIds.filter((id) => isUiOnlyQrId(id));

    if (selectedIds.length > 0 && realSelected.length === 0) {
      const localTargets = items.filter((q) => mockSelected.includes(q.id));
      setContext({ targets: localTargets, actions: buildLocalManageActions(localTargets) });
      setContextLoading(false);
      return;
    }

    void getQrManageContext(
      token,
      restaurantId,
      realSelected.length > 0 ? realSelected : undefined
    ).then((res) => {
      setContextLoading(false);
      if (!res.ok || !res.context) {
        pushToast(res.message ?? res.error ?? "Could not load manage options.", "error");
        return;
      }
      setContext(res.context);
    });
  }, [open, token, restaurantId, selectedKey, items, selectedQrIds, pushToast]);

  useEffect(() => {
    if (!single) return;
    setName(single.name);
    setDescription(single.description ?? "");
    setLocationLabel(single.locationLabel ?? "");
    setAreaLabel(single.areaLabel ?? "");
    setTableLabel(single.tableLabel ?? "");
    setExperience(single.experience);
    setMenuId(single.menuId ?? "");
    setPaymentMode(single.paymentMode);
    setAllowOrdering(single.allowOrdering);
    setOrderingPaused(single.orderingPaused);
    setSessionTtlHours(single.sessionTtlHours != null ? String(single.sessionTtlHours) : "");
    setHeadline(single.headline ?? "");
    setShowRestaurantLogo(single.showRestaurantLogo);
    setShowServeosBranding(single.showServeosBranding);
  }, [single]);

  useEffect(() => {
    if (!open || !single || isUiOnlyQrId(single.id)) {
      setAnalytics(null);
      return;
    }
    setAnalyticsLoading(true);
    void getQrAnalytics(token, restaurantId, single.id).then((res) => {
      setAnalyticsLoading(false);
      if (!res.ok || !res.summary) {
        setAnalytics(null);
        return;
      }
      setAnalytics(res.summary);
    });
  }, [open, single, token, restaurantId]);

  useEffect(() => {
    if (!visible || !initialFocus || contextLoading) return;
    const t = window.setTimeout(() => scrollToSection(initialFocus), 80);
    return () => window.clearTimeout(t);
  }, [visible, initialFocus, contextLoading, single?.id, targets.length]);

  useModalScrollLock(mounted);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, onClose]);

  const doneOk = (msg: string) => {
    pushToast(msg, "success");
    onRefresh();
  };

  const guardUiOnly = (ids: string[]) => {
    if (ids.some(isUiOnlyQrId) || allUiOnly) {
      pushToast(previewOnlyToast(), "error");
      return true;
    }
    return false;
  };

  const runSingle = async (
    fn: () => Promise<{
      ok: boolean;
      qr?: QrCodeRow;
      previousId?: string;
      message?: string;
      error?: string;
    }>,
    okMsg: string
  ) => {
    if (!single) return;
    if (guardUiOnly([single.id])) return;
    const priorId = single.id;
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.ok || !res.qr) {
      pushToast(res.message ?? res.error ?? "Action failed.", "error");
      return;
    }
    const matchId = res.previousId ?? priorId;
    setContext((prev) => {
      if (!prev) return prev;
      const nextTargets = prev.targets.map((t) => (t.id === matchId || t.id === res.qr!.id ? res.qr! : t));
      return { targets: nextTargets, actions: buildLocalManageActions(nextTargets) };
    });
    doneOk(okMsg);
  };

  const runBulkStatus = async (
    patch: Parameters<typeof bulkUpdateQrCodes>[2]["patch"],
    okMsg: string
  ) => {
    const ids = realTargets.map((t) => t.id);
    if (ids.length === 0) {
      pushToast(previewOnlyToast(), "error");
      return;
    }
    if (guardUiOnly(ids)) return;
    setBusy(true);
    const res = await bulkUpdateQrCodes(token, restaurantId, { qrIds: ids, patch });
    setBusy(false);
    if (!res.ok) {
      pushToast(res.message ?? res.error ?? "Bulk update failed.", "error");
      return;
    }
    doneOk(okMsg);
    onClearSelection();
  };

  const runPerId = async (
    ids: string[],
    fn: (id: string) => Promise<{ ok: boolean; message?: string; error?: string }>,
    okLabel: string
  ) => {
    const realIds = ids.filter((id) => !isUiOnlyQrId(id));
    if (realIds.length === 0) {
      pushToast(previewOnlyToast(), "error");
      return;
    }
    setBusy(true);
    let ok = 0;
    let failed = 0;
    for (const id of realIds) {
      const res = await fn(id);
      if (res.ok) ok += 1;
      else failed += 1;
    }
    setBusy(false);
    if (ok > 0) {
      pushToast(ok === 1 ? `${okLabel} completed.` : `${ok} QR codes updated.`, "success");
      onRefresh();
      onClearSelection();
    }
    if (failed > 0) pushToast(`${failed} could not be updated.`, "error");
  };

  const downloadUrl = (url: string, filename: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.target = "_blank";
    a.rel = "noreferrer";
    a.click();
  };

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      pushToast("Link copied.", "success");
    } catch {
      pushToast("Could not copy link.", "error");
    }
  };

  const handleAction = (actionId: string) => {
    if (actionId === "edit-general") {
      scrollToSection("general");
      return;
    }
    if (actionId === "edit-destination") {
      scrollToSection("destination");
      return;
    }
    if (actionId === "edit-ordering") {
      scrollToSection("ordering");
      return;
    }
    if (actionId === "view-analytics") {
      scrollToSection("analytics");
      return;
    }
    if (actionId === "download-png" && single) {
      downloadUrl(single.pngDownloadUrl, `${single.name}-qr.png`);
      return;
    }
    if (actionId === "download-svg" && single) {
      downloadUrl(single.svgDownloadUrl, `${single.name}-qr.svg`);
      return;
    }
    if (actionId === "copy-link" && single) {
      void copyLink(single.publicUrl);
      return;
    }
    if (actionId === "assign-menu") {
      scrollToSection("destination");
      return;
    }
    if (actionId === "assign-payment") {
      scrollToSection("destination");
      return;
    }
    if (actionId === "activate") {
      if (single) {
        void runSingle(() => reactivateQrCode(token, restaurantId, single.id), "QR activated.");
      } else {
        void runBulkStatus({ status: "ACTIVE" }, "QR codes activated.");
      }
      return;
    }
    if (actionId === "deactivate") {
      if (single) {
        if (!window.confirm(`Deactivate “${single.name}”? New scans will be blocked.`)) return;
        void runSingle(() => deactivateQrCode(token, restaurantId, single.id), "QR deactivated.");
      } else {
        if (!window.confirm(`Deactivate ${targets.length} QR codes? New scans will be blocked.`)) return;
        void runBulkStatus({ status: "INACTIVE" }, "QR codes deactivated.");
      }
      return;
    }
    if (actionId === "pause-ordering") {
      if (single) {
        void runSingle(() => pauseQrOrdering(token, restaurantId, single.id), "Ordering paused.");
      } else {
        void runBulkStatus({ orderingPaused: true }, "Ordering paused.");
      }
      return;
    }
    if (actionId === "resume-ordering") {
      if (single) {
        void runSingle(() => resumeQrOrdering(token, restaurantId, single.id), "Ordering resumed.");
      } else {
        void runBulkStatus({ orderingPaused: false }, "Ordering resumed.");
      }
      return;
    }
    if (actionId === "rotate") {
      if (!single) return;
      if (!window.confirm(`Rotate “${single.name}”? Printed codes with the old URL will stop working.`)) return;
      void runSingle(() => rotateQrCode(token, restaurantId, single.id), "QR rotated — reprint the new code.");
      return;
    }
    if (actionId === "archive") {
      const ids = targets.map((t) => t.id);
      if (single) {
        if (!window.confirm(`Archive “${single.name}”?`)) return;
        void runSingle(() => archiveQrCode(token, restaurantId, single.id), "QR archived.");
        return;
      }
      if (!window.confirm(`Archive ${ids.length} QR codes?`)) return;
      void runPerId(ids, (id) => archiveQrCode(token, restaurantId, id), "Archive");
    }
  };

  const saveGeneral = () => {
    if (!single || !canManage) return;
    void runSingle(
      () =>
        updateQrCode(token, restaurantId, single.id, {
          name: name.trim(),
          description: description.trim() || null
        }),
      "General settings saved."
    );
  };

  const saveDestination = () => {
    if (!single || !canManage) return;
    void runSingle(
      () =>
        updateQrCode(token, restaurantId, single.id, {
          experience,
          menuId: menuId || null,
          paymentMode,
          locationLabel: locationLabel.trim() || null,
          areaLabel: areaLabel.trim() || null,
          tableLabel: tableLabel.trim() || null
        }),
      "Destination saved."
    );
  };

  const saveOrdering = () => {
    if (!single || !canManage) return;
    const ttl = sessionTtlHours.trim() === "" ? null : Number(sessionTtlHours);
    void runSingle(
      () =>
        updateQrCode(token, restaurantId, single.id, {
          allowOrdering,
          orderingPaused,
          sessionTtlHours: ttl != null && Number.isFinite(ttl) ? ttl : null
        }),
      "Ordering rules saved."
    );
  };

  const saveAppearance = () => {
    if (!single || !canManage) return;
    void runSingle(
      () =>
        updateQrCode(token, restaurantId, single.id, {
          headline: headline.trim() || null,
          showRestaurantLogo,
          showServeosBranding
        }),
      "Appearance saved."
    );
  };

  const applyBulkPayment = () => {
    void runBulkStatus({ paymentMode: bulkPaymentMode }, "Payment mode updated.");
  };

  const applyBulkMenu = () => {
    void runBulkStatus({ menuId: bulkMenuId || null }, "Menu assignment updated.");
  };

  if (!mounted) return null;

  return createPortal(
    <div
      className={`admin-staff-profile-shell ${MENU_PAGE_DRAWER_SHELL_CLASS} ${visible ? "admin-staff-profile-shell--open" : ""}`}
      role="presentation"
      aria-hidden={!visible}
    >
      <button
        type="button"
        className={`${MENU_PAGE_DRAWER_BACKDROP_CLASS}${visible ? " is-active" : ""}`}
        aria-label="Close manage QR codes"
        tabIndex={visible ? 0 : -1}
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Manage QR codes"
        className={`admin-staff-profile-panel admin-menu-item-profile-panel ${visible ? "admin-staff-profile-panel--open" : ""}`}
      >
        <header className="admin-staff-profile-header">
          <div className="min-w-0 flex-1">
            <h3 className="admin-staff-profile-title">Manage QR codes</h3>
            <p className="admin-staff-profile-sub">
              {selectionLabel} at {venueName}
            </p>
          </div>
          <button type="button" className="admin-staff-profile-close" onClick={onClose} aria-label="Close">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        <div className="admin-staff-profile-body admin-menu-item-profile-body admin-menu-manage-body">
          {contextLoading ? (
            <p className="admin-staff-drawer-hint">Loading manage options…</p>
          ) : targets.length === 0 ? (
            <p className="admin-staff-drawer-hint">Select QR codes from the list or use actions for the full list.</p>
          ) : (
            <>
              <section className="admin-staff-drawer-section">
                <h4 className="admin-staff-drawer-section-title">In scope</h4>
                <ul className={`admin-menu-manage-scope-list ${scopePager.pageClassName}`} key={scopePager.pageKey}>
                  {scopePager.pagedItems.map((q) => (
                    <ScopeChip key={q.id} qr={q} />
                  ))}
                </ul>
                {scopePager.showPagination ? (
                  <MenuSurfacePagination
                    page={scopePager.page}
                    totalPages={scopePager.totalPages}
                    totalItems={scopePager.totalItems}
                    pageSize={scopePager.pageSize}
                    onPageChange={scopePager.goToPage}
                    label="In-scope QR codes pagination"
                    size="compact"
                  />
                ) : null}
              </section>

              <section className="admin-staff-drawer-section">
                <h4 className="admin-staff-drawer-section-title">Actions</h4>
                <div className="admin-menu-manage-actions">
                  {safeActions.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      className="admin-menu-manage-action"
                      disabled={busy}
                      onClick={() => handleAction(action.id)}
                    >
                      <span className="admin-menu-manage-action-label">{action.label}</span>
                      {action.description ? (
                        <span className="admin-menu-manage-action-desc">{action.description}</span>
                      ) : null}
                    </button>
                  ))}
                </div>
              </section>

              {targets.length > 1 && canManage ? (
                <section
                  className="admin-staff-drawer-section"
                  ref={(el) => {
                    sectionRefs.current.destination = el;
                  }}
                >
                  <h4 className="admin-staff-drawer-section-title">Bulk updates</h4>
                  <div className="grid gap-3">
                    <div className="flex flex-wrap gap-2">
                      <AdminBtnSecondary disabled={busy} onClick={() => handleAction("activate")}>
                        Activate
                      </AdminBtnSecondary>
                      <AdminBtnSecondary disabled={busy} onClick={() => handleAction("deactivate")}>
                        Deactivate
                      </AdminBtnSecondary>
                      <AdminBtnSecondary disabled={busy} onClick={() => handleAction("pause-ordering")}>
                        Pause ordering
                      </AdminBtnSecondary>
                      <AdminBtnSecondary disabled={busy} onClick={() => handleAction("resume-ordering")}>
                        Resume ordering
                      </AdminBtnSecondary>
                    </div>
                    <AdminLabel>
                      Payment mode
                      <AdminSelect
                        className="mt-1"
                        value={bulkPaymentMode}
                        onChange={(e) => setBulkPaymentMode(e.target.value as QrPaymentMode)}
                        disabled={busy}
                      >
                        {PAYMENT_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </AdminSelect>
                    </AdminLabel>
                    <AdminBtnSecondary disabled={busy} onClick={applyBulkPayment}>
                      Assign payment mode
                    </AdminBtnSecondary>
                    <AdminLabel>
                      Menu
                      <AdminSelect
                        className="mt-1"
                        value={bulkMenuId}
                        onChange={(e) => setBulkMenuId(e.target.value)}
                        disabled={busy}
                      >
                        <option value="">Auto (first published)</option>
                        {menus.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </AdminSelect>
                    </AdminLabel>
                    <AdminBtnSecondary disabled={busy} onClick={applyBulkMenu}>
                      Assign menu
                    </AdminBtnSecondary>
                    <div className="flex flex-wrap gap-2">
                      <AdminBtnSecondary
                        disabled={busy}
                        onClick={() => {
                          for (const q of realTargets) {
                            downloadUrl(q.pngDownloadUrl, `${q.name}-qr.png`);
                          }
                          if (realTargets.length === 0) pushToast(previewOnlyToast(), "error");
                          else pushToast("PNG export started.", "success");
                        }}
                      >
                        Export PNG
                      </AdminBtnSecondary>
                      <AdminBtnSecondary
                        disabled={busy}
                        onClick={() => {
                          for (const q of realTargets) {
                            downloadUrl(q.svgDownloadUrl, `${q.name}-qr.svg`);
                          }
                          if (realTargets.length === 0) pushToast(previewOnlyToast(), "error");
                          else pushToast("SVG export started.", "success");
                        }}
                      >
                        Export SVG
                      </AdminBtnSecondary>
                    </div>
                  </div>
                </section>
              ) : null}

              {single && canManage ? (
                <>
                  <section
                    className="admin-staff-drawer-section"
                    ref={(el) => {
                      sectionRefs.current.general = el;
                    }}
                  >
                    <h4 className="admin-staff-drawer-section-title">General</h4>
                    <div className="grid gap-3">
                      <AdminLabel>
                        Name
                        <AdminInput className="mt-1" value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
                      </AdminLabel>
                      <AdminLabel>
                        Description / internal notes
                        <AdminInput
                          className="mt-1"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          disabled={busy}
                          placeholder="e.g. QR replaced after physical damage"
                        />
                      </AdminLabel>
                      <dl className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                        <div>
                          <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">QR type</dt>
                          <dd>{single.type}</dd>
                        </div>
                        <div>
                          <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Status</dt>
                          <dd>{single.status}</dd>
                        </div>
                        <div>
                          <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Public code</dt>
                          <dd className="break-all font-mono text-xs">{single.publicCode}</dd>
                        </div>
                        <div>
                          <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Created</dt>
                          <dd>{formatWhen(single.createdAt)}</dd>
                        </div>
                        <div>
                          <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Last scan</dt>
                          <dd>{formatWhen(single.lastUsedAt)}</dd>
                        </div>
                        <div>
                          <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Orders</dt>
                          <dd>{single.orderCount}</dd>
                        </div>
                        <div>
                          <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Scans</dt>
                          <dd>{single.scanCount}</dd>
                        </div>
                      </dl>
                      <AdminBtnPrimary disabled={busy || !name.trim()} onClick={saveGeneral}>
                        {busy ? "Saving…" : "Save general"}
                      </AdminBtnPrimary>
                    </div>
                  </section>

                  <section
                    className="admin-staff-drawer-section"
                    ref={(el) => {
                      sectionRefs.current.destination = el;
                    }}
                  >
                    <h4 className="admin-staff-drawer-section-title">Destination</h4>
                    <div className="grid gap-3">
                      <AdminLabel>
                        Destination type
                        <AdminSelect
                          className="mt-1"
                          value={experience}
                          onChange={(e) => setExperience(e.target.value as QrExperience)}
                          disabled={busy}
                        >
                          {EXPERIENCE_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </AdminSelect>
                      </AdminLabel>
                      <AdminLabel>
                        Default menu
                        <AdminSelect
                          className="mt-1"
                          value={menuId}
                          onChange={(e) => setMenuId(e.target.value)}
                          disabled={busy}
                        >
                          <option value="">Auto (first published)</option>
                          {menus.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </AdminSelect>
                      </AdminLabel>
                      <AdminLabel>
                        Location
                        <AdminInput
                          className="mt-1"
                          value={locationLabel}
                          onChange={(e) => setLocationLabel(e.target.value)}
                          disabled={busy}
                        />
                      </AdminLabel>
                      <AdminLabel>
                        Area
                        <AdminInput
                          className="mt-1"
                          value={areaLabel}
                          onChange={(e) => setAreaLabel(e.target.value)}
                          disabled={busy}
                        />
                      </AdminLabel>
                      <AdminLabel>
                        Table
                        <AdminInput
                          className="mt-1"
                          value={tableLabel}
                          onChange={(e) => setTableLabel(e.target.value)}
                          disabled={busy}
                        />
                      </AdminLabel>
                      <AdminLabel>
                        Payment mode
                        <AdminSelect
                          className="mt-1"
                          value={paymentMode}
                          onChange={(e) => setPaymentMode(e.target.value as QrPaymentMode)}
                          disabled={busy}
                        >
                          {PAYMENT_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </AdminSelect>
                      </AdminLabel>
                      <AdminBtnPrimary disabled={busy} onClick={saveDestination}>
                        {busy ? "Saving…" : "Save destination"}
                      </AdminBtnPrimary>
                    </div>
                  </section>

                  <section
                    className="admin-staff-drawer-section"
                    ref={(el) => {
                      sectionRefs.current.ordering = el;
                    }}
                  >
                    <h4 className="admin-staff-drawer-section-title">Ordering rules</h4>
                    <div className="grid gap-3">
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={allowOrdering}
                          onChange={(e) => setAllowOrdering(e.target.checked)}
                          disabled={busy}
                        />
                        Allow ordering
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={orderingPaused}
                          onChange={(e) => setOrderingPaused(e.target.checked)}
                          disabled={busy}
                        />
                        Ordering paused
                      </label>
                      <AdminLabel>
                        Session TTL (hours)
                        <AdminInput
                          className="mt-1"
                          type="number"
                          min={1}
                          step={1}
                          value={sessionTtlHours}
                          onChange={(e) => setSessionTtlHours(e.target.value)}
                          disabled={busy}
                          placeholder="Default"
                        />
                      </AdminLabel>
                      <AdminBtnPrimary disabled={busy} onClick={saveOrdering}>
                        {busy ? "Saving…" : "Save ordering"}
                      </AdminBtnPrimary>
                    </div>
                  </section>

                  <section className="admin-staff-drawer-section">
                    <h4 className="admin-staff-drawer-section-title">Availability</h4>
                    <dl className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                      <div>
                        <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Active now</dt>
                        <dd>{single.status === "ACTIVE" && !single.orderingPaused ? "Yes" : "No"}</dd>
                      </div>
                      <div>
                        <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Status</dt>
                        <dd>{single.status}</dd>
                      </div>
                      <div>
                        <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Ordering</dt>
                        <dd>
                          {!single.allowOrdering
                            ? "Disabled"
                            : single.orderingPaused
                              ? "Paused (browse only)"
                              : "Enabled"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Deactivated</dt>
                        <dd>{formatWhen(single.deactivatedAt ?? null)}</dd>
                      </div>
                    </dl>
                    <p className="admin-staff-drawer-hint mt-2">
                      Scheduled activation, channel and geo restrictions ship with Locations / scheduling.
                    </p>
                  </section>

                  <section className="admin-staff-drawer-section">
                    <h4 className="admin-staff-drawer-section-title">Appearance</h4>
                    <div className="grid gap-3">
                      <AdminLabel>
                        Headline
                        <AdminInput
                          className="mt-1"
                          value={headline}
                          onChange={(e) => setHeadline(e.target.value)}
                          disabled={busy}
                        />
                      </AdminLabel>
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={showRestaurantLogo}
                          onChange={(e) => setShowRestaurantLogo(e.target.checked)}
                          disabled={busy}
                        />
                        Show restaurant logo
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={showServeosBranding}
                          onChange={(e) => setShowServeosBranding(e.target.checked)}
                          disabled={busy}
                        />
                        Show ServeOS branding
                      </label>
                      <AdminBtnPrimary disabled={busy} onClick={saveAppearance}>
                        {busy ? "Saving…" : "Save appearance"}
                      </AdminBtnPrimary>
                    </div>
                  </section>

                  <section className="admin-staff-drawer-section">
                    <h4 className="admin-staff-drawer-section-title">Printing</h4>
                    <div className="flex flex-wrap gap-2">
                      <a
                        className="admin-btn-secondary inline-flex"
                        href={single.pngDownloadUrl}
                        download={`${single.name}-qr.png`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Download PNG
                      </a>
                      <a
                        className="admin-btn-secondary inline-flex"
                        href={single.svgDownloadUrl}
                        download={`${single.name}-qr.svg`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Download SVG
                      </a>
                      <AdminBtnSecondary
                        onClick={() => window.open(single.pngDownloadUrl, "_blank", "noopener,noreferrer")}
                      >
                        Print
                      </AdminBtnSecondary>
                      <AdminBtnSecondary onClick={() => void copyLink(single.publicUrl)}>Copy link</AdminBtnSecondary>
                    </div>
                    <p className="admin-staff-drawer-hint mt-2">
                      PDF print packs, label / sticker / table-tent templates come next.
                    </p>
                  </section>

                  <section
                    className="admin-staff-drawer-section"
                    ref={(el) => {
                      sectionRefs.current.analytics = el;
                    }}
                  >
                    <h4 className="admin-staff-drawer-section-title">Analytics</h4>
                    {isUiOnlyQrId(single.id) ? (
                      <p className="admin-staff-drawer-hint">Analytics unavailable for preview QR codes.</p>
                    ) : analyticsLoading ? (
                      <p className="admin-staff-drawer-hint">Loading analytics…</p>
                    ) : analytics ? (
                      <dl className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                        <div>
                          <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Scans</dt>
                          <dd>{analytics.scans}</dd>
                        </div>
                        <div>
                          <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Orders</dt>
                          <dd>{analytics.orders}</dd>
                        </div>
                        <div>
                          <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Revenue</dt>
                          <dd>{formatMoneyCents(analytics.revenueCents)}</dd>
                        </div>
                        <div>
                          <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Conversion</dt>
                          <dd>{`${(analytics.conversionRate * 100).toFixed(1)}%`}</dd>
                        </div>
                        <div>
                          <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Last order</dt>
                          <dd>{formatWhen(analytics.lastOrderAt)}</dd>
                        </div>
                        <div>
                          <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Last activity</dt>
                          <dd>{formatWhen(single.lastUsedAt)}</dd>
                        </div>
                      </dl>
                    ) : (
                      <p className="admin-staff-drawer-hint">No analytics yet.</p>
                    )}
                  </section>

                  <section className="admin-staff-drawer-section">
                    <h4 className="admin-staff-drawer-section-title">Activity</h4>
                    <ul className="grid gap-2 text-sm text-slate-700">
                      <li>
                        <span className="font-semibold text-slate-800">Created</span>
                        <span className="ml-2 text-slate-500">{formatWhen(single.createdAt)}</span>
                      </li>
                      <li>
                        <span className="font-semibold text-slate-800">Updated</span>
                        <span className="ml-2 text-slate-500">{formatWhen(single.updatedAt)}</span>
                      </li>
                      {single.deactivatedAt ? (
                        <li>
                          <span className="font-semibold text-slate-800">Deactivated</span>
                          <span className="ml-2 text-slate-500">{formatWhen(single.deactivatedAt)}</span>
                        </li>
                      ) : null}
                      {single.archivedAt ? (
                        <li>
                          <span className="font-semibold text-slate-800">Archived</span>
                          <span className="ml-2 text-slate-500">{formatWhen(single.archivedAt)}</span>
                        </li>
                      ) : null}
                      {single.lastUsedAt ? (
                        <li>
                          <span className="font-semibold text-slate-800">Last scan / use</span>
                          <span className="ml-2 text-slate-500">{formatWhen(single.lastUsedAt)}</span>
                        </li>
                      ) : null}
                    </ul>
                    <p className="admin-staff-drawer-hint mt-2">
                      Full audit timeline (print, download, rotate events) will use a dedicated activity log.
                    </p>
                  </section>

                  <section className="admin-staff-drawer-section">
                    <h4 className="admin-staff-drawer-section-title">Integrations</h4>
                    <dl className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                      <div>
                        <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Linked menu</dt>
                        <dd>{single.menuName ?? (single.menuId ? single.menuId : "Auto / none")}</dd>
                      </div>
                      <div>
                        <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Location</dt>
                        <dd>{single.locationLabel ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Area</dt>
                        <dd>{single.areaLabel ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Table</dt>
                        <dd>{single.tableLabel ?? "—"}</dd>
                      </div>
                    </dl>
                    <p className="admin-staff-drawer-hint mt-2">
                      Printer, campaign, and promotion links land with those domains.
                    </p>
                  </section>

                  {single.status !== "ROTATED" && single.status !== "ARCHIVED" ? (
                    <section
                      className="admin-staff-drawer-section admin-menu-manage-danger-zone"
                      ref={(el) => {
                        sectionRefs.current.security = el;
                      }}
                    >
                      <h4 className="admin-staff-drawer-section-title admin-menu-manage-danger-title">Danger Zone</h4>
                      <div className="admin-menu-manage-danger-row" role="group" aria-label="Dangerous QR actions">
                        <button
                          type="button"
                          className="admin-menu-manage-danger-btn"
                          disabled={busy}
                          onClick={() => handleAction("rotate")}
                        >
                          <span className="admin-menu-manage-danger-btn-label">Rotate QR</span>
                          <span className="admin-menu-manage-danger-btn-desc">
                            New public code — old prints stop working
                          </span>
                        </button>
                        {single.status === "ACTIVE" ? (
                          <button
                            type="button"
                            className="admin-menu-manage-danger-btn"
                            disabled={busy}
                            onClick={() => handleAction("deactivate")}
                          >
                            <span className="admin-menu-manage-danger-btn-label">Deactivate</span>
                            <span className="admin-menu-manage-danger-btn-desc">Block new scans</span>
                          </button>
                        ) : null}
                        {single.status === "ACTIVE" && !single.orderingPaused ? (
                          <button
                            type="button"
                            className="admin-menu-manage-danger-btn"
                            disabled={busy}
                            onClick={() => handleAction("pause-ordering")}
                          >
                            <span className="admin-menu-manage-danger-btn-label">Pause ordering</span>
                            <span className="admin-menu-manage-danger-btn-desc">Menu browse still allowed</span>
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="admin-menu-manage-danger-btn"
                          disabled={busy}
                          onClick={() => {
                            if (
                              !window.confirm(
                                `Unlink destination for “${single.name}”? Guests will see an unavailable page until reconfigured.`
                              )
                            ) {
                              return;
                            }
                            void runSingle(
                              () =>
                                updateQrCode(token, restaurantId, single.id, {
                                  menuId: null,
                                  locationLabel: null,
                                  areaLabel: null,
                                  tableLabel: null
                                }),
                              "Destination unlinked."
                            );
                          }}
                        >
                          <span className="admin-menu-manage-danger-btn-label">Unlink destination</span>
                          <span className="admin-menu-manage-danger-btn-desc">Clear menu / table links</span>
                        </button>
                        <button
                          type="button"
                          className="admin-menu-manage-danger-btn"
                          disabled={busy}
                          onClick={() => handleAction("archive")}
                        >
                          <span className="admin-menu-manage-danger-btn-label">Archive</span>
                          <span className="admin-menu-manage-danger-btn-desc">Hide from normal lists</span>
                        </button>
                      </div>
                    </section>
                  ) : null}
                </>
              ) : null}

              {dangerActions.length > 0 && canManage && !single ? (
                <section
                  className="admin-staff-drawer-section admin-menu-manage-danger-zone"
                  ref={(el) => {
                    sectionRefs.current.security = el;
                  }}
                >
                  <h4 className="admin-staff-drawer-section-title admin-menu-manage-danger-title">Danger Zone</h4>
                  <div className="admin-menu-manage-danger-row" role="group" aria-label="Dangerous QR actions">
                    {dangerActions.map((action) => (
                      <button
                        key={action.id}
                        type="button"
                        className="admin-menu-manage-danger-btn"
                        disabled={busy}
                        onClick={() => handleAction(action.id)}
                      >
                        <span className="admin-menu-manage-danger-btn-label">{action.label}</span>
                        {action.description ? (
                          <span className="admin-menu-manage-danger-btn-desc">{action.description}</span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
