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
  restoreQrCode,
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
import { AdminBtnPrimary, AdminBtnSecondary, AdminLabel, AdminSelect } from "../../AdminUi";
import { useAdminToast } from "../../AdminToast";
import {
  MENU_PAGE_DRAWER_BACKDROP_CLASS,
  MENU_PAGE_DRAWER_SHELL_CLASS
} from "../menu/menuPageModalShell";
import { isUiOnlyQrId } from "./qrListUiMocks";
import { QrInScopeGrid } from "./QrInScopeGrid";
import { QrRequestLoading } from "./QrRequestLoading";
import {
  buildQrLabelOptions,
  buildQrLabelSuggestions,
  QrHoverEditDuration,
  QrHoverEditPick,
  QrHoverEditReadonly,
  QrHoverEditSuggestText,
  QrHoverEditText,
  QrHoverEditToggle
} from "./QrHoverEditField";

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
  /** Keep parent selection in sync after rotate (new QR id). */
  onReplaceSelection?: (ids: string[]) => void;
  initialFocus?: QrManageInitialFocus;
  onRequestPrint?: (qr: QrCodeRow) => void;
};

function buildLocalManageActions(targets: QrCodeRow[]): QrManageActionDescriptor[] {
  const actions: QrManageActionDescriptor[] = [];
  if (targets.length === 0) return actions;

  if (targets.length === 1) {
    const qr = targets[0]!;
    actions.push(
      { id: "edit-settings", label: "Edit QR", description: "General, destination, and ordering" },
      { id: "download-assets", label: "Download", description: "PNG or SVG" },
      { id: "view-analytics", label: "View analytics" }
    );
    if (qr.status === "INACTIVE") actions.push({ id: "activate", label: "Activate" });
    if (qr.status !== "ROTATED" && qr.status !== "ARCHIVED") {
      if (qr.orderingPaused) actions.push({ id: "resume-ordering", label: "Resume ordering" });
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

/** Destination is linked when any destination field is set (backend SSOT). */
function qrHasDestinationLink(qr: QrCodeRow) {
  return Boolean(
    qr.menuId ||
      qr.locationLabel?.trim() ||
      qr.areaLabel?.trim() ||
      qr.tableLabel?.trim() ||
      qr.tableId
  );
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
  onReplaceSelection,
  initialFocus = null,
  onRequestPrint
}: Props) {
  const { pushToast } = useAdminToast();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const sectionRefs = useRef<Partial<Record<NonNullable<QrManageInitialFocus>, HTMLElement | null>>>({});

  const [context, setContext] = useState<QrManageContextPayload | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("Working…");
  /** Soft pending — disables controls without replacing the drawer body. */
  const [pending, setPending] = useState(false);
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
  const [idCopied, setIdCopied] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [draftEpoch, setDraftEpoch] = useState(0);
  const [toggleConfirm, setToggleConfirm] = useState<{
    title: string;
    consequence: string;
    apply: () => void;
  } | null>(null);
  const baselineRef = useRef<{
    name: string;
    description: string;
    locationLabel: string;
    areaLabel: string;
    tableLabel: string;
    experience: QrExperience;
    menuId: string;
    paymentMode: QrPaymentMode;
    sessionTtlHours: string;
    headline: string;
  } | null>(null);

  const targets = context?.targets ?? [];
  const actions: QrManageActionDescriptor[] = context?.actions ?? [];
  const dangerActions = useMemo(() => actions.filter((a) => a.danger), [actions]);
  const single = targets.length === 1 ? targets[0]! : null;
  const realTargets = useMemo(() => targets.filter((t) => !isUiOnlyQrId(t.id)), [targets]);
  const allUiOnly = targets.length > 0 && realTargets.length === 0;

  const selectedKey = useMemo(() => [...selectedQrIds].sort().join(","), [selectedQrIds]);
  const previewQr = targets.length > 0 ? targets[Math.min(previewIndex, targets.length - 1)]! : null;
  const previewCanPage = targets.length > 1;
  const destinationLinked = single ? qrHasDestinationLink(single) : false;
  const fieldsDisabled = busy || pending || single?.status === "ARCHIVED";
  const controlsDisabled = busy || pending;

  const orderingGuestLabel = !allowOrdering
    ? "Disabled"
    : orderingPaused
      ? "Paused"
      : "Enabled";

  const selectionLabel =
    selectedQrIds.size > 0 ? `${selectedQrIds.size} selected` : `${items.length} in list`;

  const locationOptions = useMemo(
    () => buildQrLabelOptions(items, "locationLabel", locationLabel),
    [items, locationLabel]
  );
  const areaSuggestions = useMemo(() => buildQrLabelSuggestions(items, "areaLabel"), [items]);
  const tableSuggestions = useMemo(() => buildQrLabelSuggestions(items, "tableLabel"), [items]);
  const menuOptions = useMemo(
    () => [
      { value: "", label: "Auto (first published)" },
      ...menus.map((m) => ({ value: m.id, label: m.name }))
    ],
    [menus]
  );

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
    setPreviewIndex(0);
    setIdCopied(false);
  }, [open, selectedKey]);

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
    // Intentionally omit `items` — parent list refresh must not wipe manage context mid-action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, token, restaurantId, selectedKey, pushToast]);

  const hydrateFromQr = (qr: QrCodeRow) => {
    const next = {
      name: qr.name,
      description: qr.description ?? "",
      locationLabel: qr.locationLabel ?? "",
      areaLabel: qr.areaLabel ?? "",
      tableLabel: qr.tableLabel ?? "",
      experience: qr.experience,
      menuId: qr.menuId ?? "",
      paymentMode: qr.paymentMode,
      sessionTtlHours: qr.sessionTtlHours != null ? String(qr.sessionTtlHours) : "",
      headline: qr.headline ?? ""
    };
    setName(next.name);
    setDescription(next.description);
    setLocationLabel(next.locationLabel);
    setAreaLabel(next.areaLabel);
    setTableLabel(next.tableLabel);
    setExperience(next.experience);
    setMenuId(next.menuId);
    setPaymentMode(next.paymentMode);
    setAllowOrdering(qr.allowOrdering);
    setOrderingPaused(qr.orderingPaused);
    setSessionTtlHours(next.sessionTtlHours);
    setHeadline(next.headline);
    setShowRestaurantLogo(qr.showRestaurantLogo);
    setShowServeosBranding(qr.showServeosBranding);
    baselineRef.current = next;
    setDraftEpoch((n) => n + 1);
  };

  useEffect(() => {
    if (!open || !single) return;
    hydrateFromQr(single);
    setToggleConfirm(null);
    // Sync whenever the active QR identity changes (including after rotate → new id).
    // Field-level sync after mutations is handled explicitly via hydrateFromQr(res.qr).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, single?.id]);

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
  }, [open, single?.id, token, restaurantId]);

  useEffect(() => {
    if (!visible || !initialFocus || contextLoading) return;
    const t = window.setTimeout(() => scrollToSection(initialFocus), 80);
    return () => window.clearTimeout(t);
  }, [visible, initialFocus, contextLoading, single?.id, targets.length]);

  useModalScrollLock(mounted);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (toggleConfirm) {
        setToggleConfirm(null);
        return;
      }
      if (busy || pending) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, onClose, toggleConfirm, busy, pending]);

  const beginBusy = (label = "Working…") => {
    setBusyLabel(label);
    setBusy(true);
  };

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
    okMsg: string,
    opts?: {
      busyLabel?: string;
      closeAfter?: boolean;
      clearSelectionAfter?: boolean;
      /** Keep form mounted — no full-body loader. */
      inline?: boolean;
      /** Refresh parent list (default: true for body busy, false for inline). */
      refreshList?: boolean;
    }
  ) => {
    if (!single) return false;
    if (guardUiOnly([single.id])) return false;
    const priorId = single.id;
    const inline = Boolean(opts?.inline);
    const refreshList = opts?.refreshList ?? !inline;

    if (inline) setPending(true);
    else beginBusy(opts?.busyLabel ?? "Saving…");

    const res = await fn();
    if (!res.ok || !res.qr) {
      if (inline) setPending(false);
      else setBusy(false);
      pushToast(res.message ?? res.error ?? "Action failed.", "error");
      return false;
    }

    const matchId = res.previousId ?? priorId;
    const nextQr = res.qr;
    const rotated = Boolean(res.previousId && nextQr.id !== priorId);

    // Selection first (rotate) so a subsequent list refresh cannot reload the old ROTATED id.
    if (rotated) onReplaceSelection?.([nextQr.id]);

    hydrateFromQr(nextQr);
    setContext((prev) => {
      if (!prev) {
        return { targets: [nextQr], actions: buildLocalManageActions([nextQr]) };
      }
      const replaced = prev.targets.some((t) => t.id === matchId || t.id === nextQr.id);
      const nextTargets = replaced
        ? prev.targets.map((t) => (t.id === matchId || t.id === nextQr.id ? nextQr : t))
        : [nextQr];
      return { targets: nextTargets, actions: buildLocalManageActions(nextTargets) };
    });

    if (rotated) {
      setPreviewIndex(0);
      setIdCopied(false);
    }

    if (inline) setPending(false);
    else setBusy(false);

    pushToast(okMsg, "success");
    if (refreshList) onRefresh();
    if (opts?.clearSelectionAfter) onClearSelection();
    if (opts?.closeAfter) onClose();
    return true;
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
    beginBusy("Updating…");
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
    okLabel: string,
    opts?: { closeAfter?: boolean }
  ) => {
    const realIds = ids.filter((id) => !isUiOnlyQrId(id));
    if (realIds.length === 0) {
      pushToast(previewOnlyToast(), "error");
      return;
    }
    beginBusy(`${okLabel}…`);
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
      if (opts?.closeAfter) onClose();
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
      pushToast("QR link copied.", "success");
    } catch {
      pushToast("Could not copy link.", "error");
    }
  };

  const copyPublicCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setIdCopied(true);
      pushToast("QR ID copied.", "success");
      window.setTimeout(() => setIdCopied(false), 1800);
    } catch {
      pushToast("Could not copy QR ID.", "error");
    }
  };

  const handleAction = (actionId: string) => {
    if (
      actionId === "edit-settings" ||
      actionId === "edit-general" ||
      actionId === "edit-destination" ||
      actionId === "edit-ordering"
    ) {
      scrollToSection("general");
      return;
    }
    if (actionId === "view-analytics") {
      scrollToSection("analytics");
      return;
    }
    if (
      (actionId === "download-assets" || actionId === "download-png" || actionId === "download-svg") &&
      single
    ) {
      if (onRequestPrint) {
        onRequestPrint(single);
        return;
      }
      downloadUrl(single.pngDownloadUrl, `${single.name}-qr.png`);
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
        requestToggle(
          `Deactivate “${single.name}”?`,
          "New scans will be blocked. Existing guest sessions continue until they expire.",
          () => {
            void runSingle(
              () => deactivateQrCode(token, restaurantId, single.id),
              "QR deactivated.",
              { busyLabel: "Deactivating…" }
            );
          }
        );
      } else {
        requestToggle(
          `Deactivate ${targets.length} QR codes?`,
          "New scans will be blocked for the selected codes.",
          () => {
            void runBulkStatus({ status: "INACTIVE" }, "QR codes deactivated.");
          }
        );
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
      requestToggle(
        `Rotate “${single.name}”?`,
        "Issues a new public code. Existing prints and bookmarks with the old URL will stop working.",
        () => {
          void runSingle(
            () => rotateQrCode(token, restaurantId, single.id),
            "QR rotated — reprint the new code.",
            { busyLabel: "Rotating…" }
          );
        }
      );
      return;
    }
    if (actionId === "archive") {
      const ids = targets.map((t) => t.id);
      if (single) {
        requestToggle(
          `Archive “${single.name}”?`,
          "Hides this QR from normal lists. Scans will no longer open ordering until it is unarchived.",
          () => {
            void runSingle(
              () => archiveQrCode(token, restaurantId, single.id),
              "QR archived.",
              { busyLabel: "Archiving…" }
            );
          }
        );
        return;
      }
      requestToggle(
        `Archive ${ids.length} QR codes?`,
        "Selected codes will be hidden from normal lists and stop opening ordering until restored.",
        () => {
          void runPerId(ids, (id) => archiveQrCode(token, restaurantId, id), "Archive", {
            closeAfter: true
          });
        }
      );
    }
  };

  const patchSingle = (
    patch: Parameters<typeof updateQrCode>[3],
    okMsg = "Saved.",
    busyLabel = "Saving…"
  ) => {
    if (!single || !canManage) return;
    void runSingle(() => updateQrCode(token, restaurantId, single.id, patch), okMsg, {
      busyLabel,
      inline: true
    });
  };

  const draftDirty = useMemo(() => {
    const b = baselineRef.current;
    if (!b || !single) return false;
    return (
      name !== b.name ||
      description !== b.description ||
      locationLabel !== b.locationLabel ||
      areaLabel !== b.areaLabel ||
      tableLabel !== b.tableLabel ||
      experience !== b.experience ||
      menuId !== b.menuId ||
      paymentMode !== b.paymentMode ||
      sessionTtlHours !== b.sessionTtlHours ||
      headline !== b.headline
    );
    // draftEpoch forces recompute after hydrate
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    draftEpoch,
    name,
    description,
    locationLabel,
    areaLabel,
    tableLabel,
    experience,
    menuId,
    paymentMode,
    sessionTtlHours,
    headline,
    single
  ]);

  const saveDraftChanges = async () => {
    if (!single || !canManage || !draftDirty) return;
    if (!name.trim()) {
      pushToast("Name is required.", "error");
      return;
    }
    const ttl = sessionTtlHours.trim() === "" ? null : Number(sessionTtlHours);
    const ok = await runSingle(
      () =>
        updateQrCode(token, restaurantId, single.id, {
          name: name.trim(),
          description: description.trim() || null,
          locationLabel: locationLabel.trim() || null,
          areaLabel: areaLabel.trim() || null,
          tableLabel: tableLabel.trim() || null,
          experience,
          menuId: menuId || null,
          paymentMode,
          sessionTtlHours: ttl != null && Number.isFinite(ttl) && ttl > 0 ? ttl : null,
          headline: headline.trim() || null
        }),
      "Changes saved.",
      { busyLabel: "Saving changes…", inline: true, refreshList: true }
    );
    if (!ok) return;
    baselineRef.current = {
      name: name.trim(),
      description: description.trim(),
      locationLabel: locationLabel.trim(),
      areaLabel: areaLabel.trim(),
      tableLabel: tableLabel.trim(),
      experience,
      menuId,
      paymentMode,
      sessionTtlHours,
      headline: headline.trim()
    };
    setDraftEpoch((n) => n + 1);
  };

  const requestToggle = (title: string, consequence: string, apply: () => void) => {
    setToggleConfirm({ title, consequence, apply });
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
        onClick={() => {
          if (!controlsDisabled) onClose();
        }}
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
          {single && canManage && draftDirty && !controlsDisabled ? (
            <AdminBtnPrimary
              className="admin-qr-manage-save-btn shrink-0"
              disabled={controlsDisabled}
              onClick={() => void saveDraftChanges()}
            >
              Save changes
            </AdminBtnPrimary>
          ) : null}
          <button
            type="button"
            className="admin-staff-profile-close"
            onClick={onClose}
            aria-label="Close"
            disabled={controlsDisabled}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        <div className="admin-staff-profile-body admin-menu-item-profile-body admin-menu-manage-body">
          {busy || contextLoading ? (
            <QrRequestLoading
              title={contextLoading ? "Loading…" : busyLabel}
              sub={contextLoading ? "Fetching manage options" : "Please wait"}
            />
          ) : targets.length === 0 ? (
            <p className="admin-staff-drawer-hint">Select QR codes from the list or use actions for the full list.</p>
          ) : (
            <>
              <section className="admin-staff-drawer-section">
                <h4 className="admin-staff-drawer-section-title">In scope</h4>
                <QrInScopeGrid items={targets} />
              </section>

              {previewQr ? (
                <section className="admin-staff-drawer-section">
                  <h4 className="admin-staff-drawer-section-title">QR code</h4>
                  <div className="admin-qr-manage-preview">
                    {previewCanPage ? (
                      <div className="admin-qr-manage-preview-nav" role="group" aria-label="Browse QR codes in scope">
                        <button
                          type="button"
                          className="admin-qr-manage-preview-nav-btn"
                          aria-label="Previous QR code"
                          disabled={busy}
                          onClick={() => {
                            setIdCopied(false);
                            setPreviewIndex((i) => (i - 1 + targets.length) % targets.length);
                          }}
                        >
                          <svg viewBox="0 0 20 20" fill="none" aria-hidden className="admin-qr-manage-preview-nav-icon">
                            <path d="M12.5 4.5 7 10l5.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                        <span className="admin-qr-manage-preview-nav-meta">
                          {Math.min(previewIndex, targets.length - 1) + 1} / {targets.length}
                        </span>
                        <button
                          type="button"
                          className="admin-qr-manage-preview-nav-btn"
                          aria-label="Next QR code"
                          disabled={busy}
                          onClick={() => {
                            setIdCopied(false);
                            setPreviewIndex((i) => (i + 1) % targets.length);
                          }}
                        >
                          <svg viewBox="0 0 20 20" fill="none" aria-hidden className="admin-qr-manage-preview-nav-icon">
                            <path d="M7.5 4.5 13 10l-5.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </div>
                    ) : null}
                    {previewCanPage ? (
                      <p className="admin-qr-manage-preview-name" title={previewQr.name}>
                        {previewQr.name}
                      </p>
                    ) : null}
                    <img
                      src={previewQr.qrImageUrl}
                      alt={`QR for ${previewQr.name}`}
                      className="admin-qr-manage-preview-img"
                    />
                    <div className="admin-qr-manage-preview-id">
                      <span className="admin-qr-manage-preview-id-label">QR ID</span>
                      <code className="admin-qr-manage-preview-id-value">{previewQr.publicCode}</code>
                      <button
                        type="button"
                        className="admin-qr-manage-preview-id-copy"
                        aria-label={idCopied ? "Copied" : "Copy QR ID"}
                        title={idCopied ? "Copied" : "Copy QR ID"}
                        onClick={() => void copyPublicCode(previewQr.publicCode)}
                      >
                        {idCopied ? (
                          <svg className="h-3.5 w-3.5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                            <rect x="9" y="9" width="13" height="13" rx="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                        )}
                      </button>
                    </div>
                    <AdminBtnPrimary
                      className="admin-qr-manage-preview-link-btn"
                      disabled={busy}
                      onClick={() => void copyLink(previewQr.publicUrl)}
                    >
                      Copy QR link
                    </AdminBtnPrimary>
                  </div>
                </section>
              ) : null}

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
                    <div className="admin-qr-hover-edit-fields">
                      <QrHoverEditText
                        label="Name"
                        value={name}
                        disabled={fieldsDisabled}
                        onCommit={(next) => {
                          if (!next) {
                            pushToast("Name is required.", "error");
                            return;
                          }
                          setName(next);
                        }}
                      />
                      <QrHoverEditText
                        label="Description / internal notes"
                        value={description}
                        displayValue={description || "—"}
                        placeholder="e.g. QR replaced after physical damage"
                        disabled={busy}
                        onCommit={(next) => setDescription(next)}
                      />
                      <div className="admin-qr-hover-edit-fields admin-qr-hover-edit-fields--2">
                        <QrHoverEditReadonly label="QR type">{single.type}</QrHoverEditReadonly>
                        <QrHoverEditReadonly label="Status">{single.status}</QrHoverEditReadonly>
                        <QrHoverEditReadonly label="Public code">
                          <span className="font-mono text-xs">{single.publicCode}</span>
                        </QrHoverEditReadonly>
                        <QrHoverEditReadonly label="Created">{formatWhen(single.createdAt)}</QrHoverEditReadonly>
                        <QrHoverEditReadonly label="Last scan">{formatWhen(single.lastUsedAt)}</QrHoverEditReadonly>
                        <QrHoverEditReadonly label="Orders">{single.orderCount}</QrHoverEditReadonly>
                        <QrHoverEditReadonly label="Scans">{single.scanCount}</QrHoverEditReadonly>
                      </div>
                    </div>
                  </section>

                  <section
                    className="admin-staff-drawer-section"
                    ref={(el) => {
                      sectionRefs.current.destination = el;
                    }}
                  >
                    <h4 className="admin-staff-drawer-section-title">Destination</h4>
                    <div className="admin-qr-hover-edit-fields">
                      <QrHoverEditPick
                        label="Destination type"
                        value={experience}
                        disabled={fieldsDisabled}
                        options={EXPERIENCE_OPTIONS}
                        onCommit={(next) => setExperience(next as QrExperience)}
                      />
                      <QrHoverEditPick
                        label="Default menu"
                        value={menuId}
                        disabled={fieldsDisabled}
                        options={menuOptions}
                        emptyHint="No published menus yet"
                        onCommit={(next) => setMenuId(next)}
                      />
                      <div className="admin-qr-hover-edit-fields admin-qr-hover-edit-fields--2">
                        <QrHoverEditPick
                          label="Location"
                          value={locationLabel}
                          disabled={fieldsDisabled}
                          options={locationOptions}
                          emptyHint="No locations on existing QR codes yet"
                          onCommit={(next) => setLocationLabel(next)}
                        />
                        <QrHoverEditSuggestText
                          label="Area"
                          value={areaLabel}
                          disabled={fieldsDisabled}
                          placeholder="e.g. Patio, Bar"
                          suggestions={areaSuggestions}
                          suggestionsTitle="Recently used areas"
                          onCommit={(next) => setAreaLabel(next)}
                        />
                        <QrHoverEditSuggestText
                          label="Table"
                          value={tableLabel}
                          disabled={fieldsDisabled}
                          placeholder="e.g. 12, A3"
                          suggestions={tableSuggestions}
                          suggestionsTitle="Recently used tables"
                          onCommit={(next) => setTableLabel(next)}
                        />
                        <QrHoverEditPick
                          label="Payment mode"
                          value={paymentMode}
                          disabled={fieldsDisabled}
                          options={PAYMENT_OPTIONS}
                          onCommit={(next) => setPaymentMode(next as QrPaymentMode)}
                        />
                      </div>
                    </div>
                  </section>

                  <section
                    className="admin-staff-drawer-section"
                    ref={(el) => {
                      sectionRefs.current.ordering = el;
                    }}
                  >
                    <h4 className="admin-staff-drawer-section-title">Ordering rules</h4>
                    <div className="admin-qr-hover-edit-fields">
                      <div className="admin-qr-hover-edit-fields admin-qr-hover-edit-fields--2">
                        <QrHoverEditToggle
                          label="Allow ordering"
                          value={allowOrdering}
                          onLabel="Enabled"
                          offLabel="Disabled"
                          disabled={fieldsDisabled}
                          onRequestChange={(next) =>
                            requestToggle(
                              next ? "Enable ordering?" : "Disable ordering?",
                              next
                                ? "Guests scanning this QR will be able to place orders again."
                                : "Guests will browse the menu only — new orders will be blocked.",
                              () => {
                                void patchSingle(
                                  { allowOrdering: next },
                                  "Ordering rule updated.",
                                  "Updating ordering…"
                                );
                              }
                            )
                          }
                        />
                        <QrHoverEditToggle
                          label="Ordering paused"
                          value={orderingPaused}
                          onLabel="Paused"
                          offLabel="Not paused"
                          disabled={fieldsDisabled}
                          onRequestChange={(next) =>
                            requestToggle(
                              next ? "Pause ordering?" : "Resume ordering?",
                              next
                                ? "Useful during kitchen overload. Guests can still view the menu; new orders stop."
                                : "Guests will be able to place orders from this QR again.",
                              () => {
                                void patchSingle(
                                  { orderingPaused: next },
                                  next ? "Ordering paused." : "Ordering resumed.",
                                  next ? "Pausing…" : "Resuming…"
                                );
                              }
                            )
                          }
                        />
                      </div>
                      <QrHoverEditDuration
                        label="Session TTL"
                        value={sessionTtlHours}
                        disabled={fieldsDisabled}
                        onCommit={(next) => setSessionTtlHours(next)}
                      />
                    </div>
                  </section>

                  <section className="admin-staff-drawer-section">
                    <h4 className="admin-staff-drawer-section-title">Availability</h4>
                    <div className="admin-qr-hover-edit-fields">
                      <QrHoverEditToggle
                        label="Active now"
                        value={single.status === "ACTIVE"}
                        onLabel="Active"
                        offLabel="Inactive"
                        disabled={
                          controlsDisabled ||
                          single.status === "ROTATED" ||
                          single.status === "ARCHIVED"
                        }
                        onRequestChange={(next) =>
                          requestToggle(
                            next ? "Activate this QR?" : "Deactivate this QR?",
                            next
                              ? "New scans will work again using the current public code."
                              : "New scans will be blocked. Existing guest sessions continue until they expire.",
                            () => {
                              if (next) {
                                void runSingle(
                                  () => reactivateQrCode(token, restaurantId, single.id),
                                  "QR activated.",
                                  { busyLabel: "Activating…", inline: true, refreshList: true }
                                );
                              } else {
                                void runSingle(
                                  () => deactivateQrCode(token, restaurantId, single.id),
                                  "QR deactivated.",
                                  { busyLabel: "Deactivating…", inline: true, refreshList: true }
                                );
                              }
                            }
                          )
                        }
                      />
                      <div className="admin-qr-hover-edit-fields admin-qr-hover-edit-fields--2">
                        <QrHoverEditReadonly label="Status">{single.status}</QrHoverEditReadonly>
                        <QrHoverEditReadonly label="Ordering for guests">{orderingGuestLabel}</QrHoverEditReadonly>
                        <QrHoverEditReadonly label="Allow ordering">
                          {allowOrdering ? "Enabled" : "Disabled"}
                        </QrHoverEditReadonly>
                        <QrHoverEditReadonly label="Ordering paused">
                          {orderingPaused ? "Paused" : "Not paused"}
                        </QrHoverEditReadonly>
                        <QrHoverEditReadonly label="Deactivated">
                          {formatWhen(single.deactivatedAt ?? null)}
                        </QrHoverEditReadonly>
                      </div>
                      <p className="admin-staff-drawer-hint">
                        Change allow / pause under Ordering rules. Active now controls whether scans resolve at all.
                      </p>
                    </div>
                  </section>

                  <section className="admin-staff-drawer-section">
                    <h4 className="admin-staff-drawer-section-title">Appearance</h4>
                    <div className="admin-qr-hover-edit-fields">
                      <QrHoverEditText
                        label="Headline"
                        value={headline}
                        disabled={fieldsDisabled}
                        onCommit={(next) => setHeadline(next)}
                      />
                      <div className="admin-qr-hover-edit-fields admin-qr-hover-edit-fields--2">
                        <QrHoverEditToggle
                          label="Restaurant logo"
                          value={showRestaurantLogo}
                          onLabel="Shown"
                          offLabel="Hidden"
                          disabled={fieldsDisabled}
                          onRequestChange={(next) =>
                            requestToggle(
                              next ? "Show restaurant logo?" : "Hide restaurant logo?",
                              next
                                ? "The restaurant logo will appear on guest-facing QR landing."
                                : "The restaurant logo will be hidden on guest-facing QR landing.",
                              () => {
                                void patchSingle(
                                  { showRestaurantLogo: next },
                                  "Appearance updated.",
                                  "Updating appearance…"
                                );
                              }
                            )
                          }
                        />
                        <QrHoverEditToggle
                          label="ServeOS branding"
                          value={showServeosBranding}
                          onLabel="Shown"
                          offLabel="Hidden"
                          disabled={fieldsDisabled}
                          onRequestChange={(next) =>
                            requestToggle(
                              next ? "Show ServeOS branding?" : "Hide ServeOS branding?",
                              next
                                ? "ServeOS branding will appear on the guest QR experience."
                                : "ServeOS branding will be removed from the guest QR experience.",
                              () => {
                                void patchSingle(
                                  { showServeosBranding: next },
                                  "Appearance updated.",
                                  "Updating appearance…"
                                );
                              }
                            )
                          }
                        />
                      </div>
                    </div>
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

                  {single.status !== "ROTATED" ? (
                    <section
                      className="admin-staff-drawer-section admin-menu-manage-danger-zone"
                      ref={(el) => {
                        sectionRefs.current.security = el;
                      }}
                    >
                      <h4 className="admin-staff-drawer-section-title admin-menu-manage-danger-title">Danger Zone</h4>
                      <div className="admin-qr-danger-row" role="group" aria-label="Dangerous QR actions">
                        {single.status === "ARCHIVED" ? (
                          <button
                            type="button"
                            className="admin-qr-danger-btn admin-qr-danger-btn--restore"
                            disabled={controlsDisabled}
                            onClick={() =>
                              requestToggle(
                                `Unarchive “${single.name}”?`,
                                "Restores this QR to Active. Scans will work again with the current public code.",
                                () => {
                                  void runSingle(
                                    () => restoreQrCode(token, restaurantId, single.id),
                                    "QR unarchived.",
                                    { busyLabel: "Unarchiving…" }
                                  );
                                }
                              )
                            }
                          >
                            Unarchive
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="admin-qr-danger-btn"
                              disabled={controlsDisabled}
                              onClick={() =>
                                requestToggle(
                                  `Rotate “${single.name}”?`,
                                  "Issues a new public code and QR image. Existing prints and bookmarks with the old URL will stop working.",
                                  () => {
                                    void runSingle(
                                      () => rotateQrCode(token, restaurantId, single.id),
                                      "QR rotated — reprint the new code.",
                                      { busyLabel: "Rotating…" }
                                    );
                                  }
                                )
                              }
                            >
                              Rotate
                            </button>
                            {destinationLinked ? (
                              <button
                                type="button"
                                className="admin-qr-danger-btn"
                                disabled={controlsDisabled}
                                onClick={() =>
                                  requestToggle(
                                    `Unlink destination for “${single.name}”?`,
                                    "Clears menu and table links. Guests will see an unavailable page until you link a destination again.",
                                    () => {
                                      void runSingle(
                                        () =>
                                          updateQrCode(token, restaurantId, single.id, {
                                            menuId: null,
                                            locationLabel: null,
                                            areaLabel: null,
                                            tableLabel: null,
                                            tableId: null
                                          }),
                                        "Destination unlinked.",
                                        { busyLabel: "Unlinking…" }
                                      );
                                    }
                                  )
                                }
                              >
                                Unlink
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="admin-qr-danger-btn admin-qr-danger-btn--restore"
                                disabled={controlsDisabled}
                                onClick={() => {
                                  scrollToSection("destination");
                                  pushToast("Set a menu or location under Destination, then Save changes.", "success");
                                }}
                              >
                                Link QR
                              </button>
                            )}
                            <button
                              type="button"
                              className="admin-qr-danger-btn"
                              disabled={controlsDisabled}
                              onClick={() =>
                                requestToggle(
                                  `Archive “${single.name}”?`,
                                  "Hides this QR from normal lists. Scans will no longer open ordering until it is unarchived.",
                                  () => {
                                    void runSingle(
                                      () => archiveQrCode(token, restaurantId, single.id),
                                      "QR archived.",
                                      { busyLabel: "Archiving…" }
                                    );
                                  }
                                )
                              }
                            >
                              Archive
                            </button>
                          </>
                        )}
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
                  <div className="admin-qr-danger-row" role="group" aria-label="Dangerous QR actions">
                    {dangerActions.map((action) => (
                      <button
                        key={action.id}
                        type="button"
                        className="admin-qr-danger-btn"
                        disabled={busy}
                        onClick={() => {
                          if (action.id === "archive") {
                            requestToggle(
                              `Archive ${targets.length} QR codes?`,
                              "Selected codes will be hidden from normal lists and stop opening ordering until restored.",
                              () => {
                                void runPerId(
                                  targets.map((t) => t.id),
                                  (id) => archiveQrCode(token, restaurantId, id),
                                  "Archive",
                                  { closeAfter: true }
                                );
                              }
                            );
                            return;
                          }
                          handleAction(action.id);
                        }}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          )}
        </div>
        {toggleConfirm ? (
          <div className="admin-qr-toggle-confirm" role="alertdialog" aria-modal="true" aria-labelledby="qr-toggle-confirm-title">
            <div className="admin-qr-toggle-confirm-card">
              <h4 id="qr-toggle-confirm-title" className="admin-qr-toggle-confirm-title">
                {toggleConfirm.title}
              </h4>
              <p className="admin-qr-toggle-confirm-consequence">{toggleConfirm.consequence}</p>
              <div className="admin-qr-toggle-confirm-actions">
                <AdminBtnSecondary disabled={controlsDisabled} onClick={() => setToggleConfirm(null)}>
                  Cancel
                </AdminBtnSecondary>
                <AdminBtnPrimary
                  disabled={controlsDisabled}
                  onClick={() => {
                    const apply = toggleConfirm.apply;
                    setToggleConfirm(null);
                    apply();
                  }}
                >
                  Confirm
                </AdminBtnPrimary>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
