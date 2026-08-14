import { useEffect, useMemo, useRef, useState } from "react";
import type {
  PaymentCancellationPolicy,
  PaymentMethodConfig,
  PaymentOrderSource,
  PaymentReconciliationMode,
  PaymentRefundPolicy,
  PaymentSettlementMode,
  PaymentStaffRole,
  VenuePaymentSettings
} from "../../../api";
import { AdminInput, AdminLabel } from "../../AdminUi";
import {
  DetailsDrawerShell,
  DetailsGrid,
  DetailsRow,
  DetailsSection,
  formatDetailsWhen,
  useCachedDetailsEntity
} from "../menu/detailsDrawerUi";
import { PAYMENT_METHOD_CATALOG } from "./paymentMethodCatalog";
import { paymentMethodIconSrc } from "./paymentMethodIcons";
import {
  paymentMethodHealthBadgeClass,
  paymentMethodHealthLabel,
  resolvePaymentMethodHealth
} from "./paymentMethodsListQuery";
import { PaymentsBusyLabel, PaymentsDetailsReveal, PaymentsDrawerSpinner } from "./paymentsLoadingUi";
import {
  SERVEOS_CURRENCY_OPTIONS,
  sanitizeServeosCurrencies,
  serveosCurrencyLabel
} from "./serveosCurrencies";
import { GROUP_LABELS, ORDER_SOURCE_LABELS, getMethodConfig, methodLabel } from "./paymentsUiHelpers";
import { MenuPageModalShell, ProfileModalFooter, ProfileModalNote } from "../menu/menuPageModalShell";
import { PaymentMethodDangerZoneSection } from "./PaymentMethodDangerZoneSection";

type Props = {
  open: boolean;
  methodKey: string | null;
  settings: VenuePaymentSettings | null;
  canEdit: boolean;
  token?: string;
  restaurantId?: string;
  focusAudit?: boolean;
  /** Increment to request close/leave; drawer confirms if dirty then calls onLeaveAllowed. */
  leaveRequestId?: number;
  onLeaveAllowed?: () => void;
  onLeaveCancelled?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  onClose: () => void;
  onEditSetup?: (methodKey: string) => void;
  onToast?: (message: string, tone?: "success" | "error") => void;
  onSettingsRefresh?: (payload: {
    settings?: VenuePaymentSettings;
    methodCapabilities?: import("../../../api").PaymentMethodCapabilitiesPayload;
  }) => void;
  onSave: (
    methodKey: string,
    config: PaymentMethodConfig,
    extras?: { setDefault?: boolean }
  ) => boolean | Promise<boolean>;
};

type PendingConfirm = {
  title: string;
  copy: string;
  confirmLabel: string;
  danger?: boolean;
  successStatus: string;
  failStatus: string;
  nextConfig: PaymentMethodConfig;
  extras?: { setDefault?: boolean };
};

type TextBaseline = {
  displayName: string;
  priority: number;
  minCents: number | null;
  maxCents: number | null;
  scheduleNote: string;
};

function textBaselineFromConfig(config: PaymentMethodConfig): TextBaseline {
  return {
    displayName: config.displayName ?? "",
    priority: config.priority ?? 100,
    minCents: config.minCents ?? null,
    maxCents: config.maxCents ?? null,
    scheduleNote: config.availabilityRules?.scheduleNote ?? ""
  };
}

type MethodSelectOption = { value: string; label: string; hint?: string };

const ALL_SOURCES: PaymentOrderSource[] = [
  "qr_orders",
  "in_app",
  "walk_ins",
  "staff_created",
  "reservations",
  "delivery",
  "catering",
  "b2b"
];

const ALL_ROLES: PaymentStaffRole[] = ["owner", "manager", "staff"];

const SETTLEMENT_OPTIONS: MethodSelectOption[] = [
  { value: "automatic", label: "Automatic (provider)", hint: "Provider marks paid when capture succeeds" },
  { value: "staff_confirmed", label: "Staff confirmed", hint: "Staff must confirm before settled" },
  { value: "provider_verified", label: "Provider verified", hint: "Wait for provider verification event" },
  { value: "manual_reference", label: "Manual reference", hint: "Settle using a pasted reference" }
];

const RECONCILIATION_OPTIONS: MethodSelectOption[] = [
  { value: "none", label: "None", hint: "No reconciliation step required" },
  { value: "required", label: "Required", hint: "Must be reconciled in ops tools" },
  { value: "provider_match", label: "Provider match", hint: "Match against provider ledger" }
];

const REFUND_OPTIONS: MethodSelectOption[] = [
  { value: "standard", label: "Standard", hint: "Normal refund flow for this method" },
  { value: "manager_only", label: "Manager only", hint: "Only managers can refund" },
  { value: "provider_only", label: "Provider only", hint: "Refunds only via provider tools" },
  { value: "disabled", label: "Disabled", hint: "Refunds blocked for this method" }
];

const CANCELLATION_OPTIONS: MethodSelectOption[] = [
  { value: "allow", label: "Allow", hint: "Cancel unpaid / unsettled attempts" },
  { value: "manager_only", label: "Manager only", hint: "Managers approve cancellations" },
  { value: "block_if_paid", label: "Block if paid", hint: "Cannot cancel once paid" }
];

const CAPTURE_OPTIONS: MethodSelectOption[] = [
  { value: "automatic", label: "Automatic", hint: "Capture funds at authorization time" },
  { value: "manual", label: "Manual", hint: "Authorize first; capture later" }
];

const THREE_DS_OPTIONS: MethodSelectOption[] = [
  { value: "automatic", label: "Automatic", hint: "Provider decides when 3DS is needed" },
  { value: "always", label: "Always", hint: "Always challenge card payments" },
  { value: "never", label: "Never", hint: "Skip 3DS when the rail allows" }
];

const SETTLEMENT_LABELS: Record<PaymentSettlementMode, string> = {
  automatic: "Automatic (provider)",
  staff_confirmed: "Staff confirmed",
  provider_verified: "Provider verified",
  manual_reference: "Manual reference"
};

const RECONCILIATION_LABELS: Record<PaymentReconciliationMode, string> = {
  none: "None",
  required: "Required",
  provider_match: "Provider match"
};

const REFUND_LABELS: Record<PaymentRefundPolicy, string> = {
  standard: "Standard",
  manager_only: "Manager only",
  provider_only: "Provider only",
  disabled: "Disabled"
};

const CANCELLATION_LABELS: Record<PaymentCancellationPolicy, string> = {
  allow: "Allow",
  manager_only: "Manager only",
  block_if_paid: "Block if paid"
};

const CAPTURE_LABELS: Record<PaymentMethodConfig["capture"], string> = {
  automatic: "Automatic",
  manual: "Manual"
};

const THREE_DS_LABELS: Record<PaymentMethodConfig["threeDSecure"], string> = {
  automatic: "Automatic",
  always: "Always",
  never: "Never"
};

const SECTION_HELP = {
  basics:
    "Enable offers this method at the venue. Default is preferred at checkout. Customer-facing name is what guests see. Priority sorts the method list (lower number appears first).",
  sources:
    "Order sources are channels where this method can be chosen — QR table orders, in-app, walk-ins, staff-created tickets, reservations, delivery, catering, and B2B. Mark only channels you actually support.",
  limits:
    "Currencies are chosen from ServeOS-supported options (SEK default, EUR, USD, GBP, and Nordic). Min/max are in öre for SEK (100 öre = 1.00 SEK). Leave empty for no floor/ceiling.",
  staff:
    "Roles control who may record or verify this method. Staff confirmation / payment reference add checks before settlement. Settlement, reconciliation, refund, and cancellation policies define how money movement is finished or reversed.",
  availability:
    "Always available ignores venue hours. Open hours only offers the method during scheduled open time. Schedule note is staff-facing context (not a hard rule engine by itself).",
  instructions:
    "Staff instructions guide POS/admin recording (e.g. ask for last 4 digits). Customer instructions can appear during guest checkout or pay-at-table for this method. Keep them short and actionable.",
  provider:
    "Provider is the rail ServeOS uses for this catalog method. Capture chooses when funds are taken (now vs later). 3D Secure adds cardholder authentication for card rails — leave Automatic unless you have a compliance reason to force Always/Never.",
  audit:
    "Versioned history of saved configuration changes for this method from the venue payment settings source of truth."
} as const;

function toggleInList<T extends string>(list: T[], value: T, on: boolean): T[] {
  if (on) return list.includes(value) ? list : [...list, value];
  return list.filter((x) => x !== value);
}

function MethodToggle({
  label,
  checked,
  disabled,
  onRequestChange
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onRequestChange: (next: boolean) => void;
}) {
  return (
    <div className={`admin-payments-method-toggle-row${disabled ? " is-disabled" : ""}`}>
      <span className="admin-payments-method-toggle-label">{label}</span>
      <label className={`admin-payments-switch${disabled ? " is-disabled" : ""}`}>
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => {
            e.preventDefault();
            onRequestChange(e.target.checked);
          }}
          aria-label={label}
        />
        <span className="admin-payments-switch-track" aria-hidden>
          <span className="admin-payments-switch-thumb" />
        </span>
      </label>
    </div>
  );
}

function MethodPolicyDropdown({
  label,
  value,
  options,
  disabled,
  onRequestChange
}: {
  label: string;
  value: string;
  options: MethodSelectOption[];
  disabled?: boolean;
  onRequestChange: (next: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && rootRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="admin-payments-expand-select" ref={rootRef}>
      <span className="admin-payments-expand-select-label">{label}</span>
      <div className={`admin-payments-expand-select-body${open ? " is-open" : ""}${disabled ? " is-disabled" : ""}`}>
        <button
          type="button"
          className="admin-payments-expand-select-trigger"
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={disabled}
          onClick={() => {
            if (disabled) return;
            setOpen((v) => !v);
          }}
        >
          <span className="admin-payments-expand-select-value">{selected?.label ?? value}</span>
          <span className={`admin-payments-expand-select-chevron${open ? " is-open" : ""}`} aria-hidden>
            ▾
          </span>
        </button>
        <div className="admin-payments-expand-select-panel" aria-hidden={!open}>
          <div className="admin-payments-expand-select-panel-inner" role="listbox" aria-label={label}>
            {options.map((opt) => {
              const active = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`admin-payments-expand-select-option${active ? " is-selected" : ""}`}
                  tabIndex={open ? 0 : -1}
                  onClick={() => {
                    setOpen(false);
                    if (opt.value === value) return;
                    onRequestChange(opt.value);
                  }}
                >
                  <span className="admin-payments-expand-select-option-label">{opt.label}</span>
                  {opt.hint ? <span className="admin-payments-expand-select-option-hint">{opt.hint}</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function MethodCurrencyPicker({
  selected,
  disabled,
  onRequestToggle
}: {
  selected: string[];
  disabled?: boolean;
  onRequestToggle: (code: string, enable: boolean) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selectedSet = useMemo(() => new Set(sanitizeServeosCurrencies(selected)), [selected]);
  const summary =
    selectedSet.size === 0
      ? "SEK (kr)"
      : Array.from(selectedSet)
          .map((code) => serveosCurrencyLabel(code))
          .join(", ");

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && rootRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="admin-payments-expand-select" ref={rootRef}>
      <span className="admin-payments-expand-select-label">Currencies</span>
      <div className={`admin-payments-expand-select-body${open ? " is-open" : ""}${disabled ? " is-disabled" : ""}`}>
        <button
          type="button"
          className="admin-payments-expand-select-trigger"
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={disabled}
          onClick={() => {
            if (disabled) return;
            setOpen((v) => !v);
          }}
        >
          <span className="admin-payments-expand-select-value">{summary}</span>
          <span className={`admin-payments-expand-select-chevron${open ? " is-open" : ""}`} aria-hidden>
            ▾
          </span>
        </button>
        <div className="admin-payments-expand-select-panel" aria-hidden={!open}>
          <div className="admin-payments-expand-select-panel-inner" role="listbox" aria-label="Currencies" aria-multiselectable>
            {SERVEOS_CURRENCY_OPTIONS.map((opt) => {
              const active = selectedSet.has(opt.code);
              return (
                <button
                  key={opt.code}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`admin-payments-expand-select-option${active ? " is-selected" : ""}`}
                  tabIndex={open ? 0 : -1}
                  onClick={() => {
                    onRequestToggle(opt.code, !active);
                  }}
                >
                  <span className="admin-payments-expand-select-option-label">{opt.label}</span>
                  <span className="admin-payments-expand-select-option-hint">
                    {opt.hint}
                    {active ? " · selected" : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function MethodMessageField({
  label,
  value,
  disabled,
  saveLabel,
  onRequestSave,
  onDirtyChange
}: {
  label: string;
  value: string;
  disabled?: boolean;
  saveLabel: string;
  onRequestSave: (next: string) => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => {
    setLocal(value);
  }, [value]);
  const dirty = local !== value;

  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);

  return (
    <div className="admin-payments-message-field">
      <label className="grid gap-1">
        <AdminLabel>{label}</AdminLabel>
        <textarea
          className="admin-payments-select min-h-[4.5rem]"
          disabled={disabled}
          value={local}
          onChange={(e) => setLocal(e.target.value)}
        />
      </label>
      {dirty && !disabled ? (
        <button
          type="button"
          className="admin-payments-message-save"
          onClick={() => onRequestSave(local)}
        >
          {saveLabel}
        </button>
      ) : null}
    </div>
  );
}

export function PaymentMethodManageDrawer({
  open,
  methodKey,
  settings,
  canEdit,
  token,
  restaurantId,
  focusAudit = false,
  leaveRequestId = 0,
  onLeaveAllowed,
  onLeaveCancelled,
  onDirtyChange,
  onClose,
  onEditSetup,
  onToast,
  onSettingsRefresh,
  onSave
}: Props) {
  const activeKey = useCachedDetailsEntity(open, methodKey);
  const catalog = useMemo(
    () => PAYMENT_METHOD_CATALOG.find((m) => m.key === (activeKey ?? "")) ?? null,
    [activeKey]
  );
  const [draft, setDraft] = useState<PaymentMethodConfig | null>(null);
  const [textBaseline, setTextBaseline] = useState<TextBaseline | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [actionTone, setActionTone] = useState<"ok" | "error">("ok");
  const [discardOpen, setDiscardOpen] = useState(false);
  const [staffMsgDirty, setStaffMsgDirty] = useState(false);
  const [customerMsgDirty, setCustomerMsgDirty] = useState(false);
  const loadedKeyRef = useRef<string | null>(null);
  const lastLeaveRequestRef = useRef(0);
  const afterCloseRef = useRef<(() => void) | null>(null);
  const leaveGateActiveRef = useRef(false);

  useEffect(() => {
    if (!open || !methodKey || !settings) return;
    if (loadedKeyRef.current === methodKey) return;
    let cancelled = false;
    setLoading(true);
    setDraft(null);
    setTextBaseline(null);
    setPendingConfirm(null);
    setConfirmBusy(false);
    setActionStatus(null);
    setActionTone("ok");
    setDiscardOpen(false);
    setStaffMsgDirty(false);
    setCustomerMsgDirty(false);
    afterCloseRef.current = null;
    const t = window.setTimeout(() => {
      if (cancelled) return;
      const config = getMethodConfig(settings, methodKey);
      setDraft(config);
      setTextBaseline(textBaselineFromConfig(config));
      loadedKeyRef.current = methodKey;
      setLoading(false);
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [open, methodKey, settings]);

  useEffect(() => {
    if (open) return;
    loadedKeyRef.current = null;
    const t = window.setTimeout(() => {
      setDraft(null);
      setTextBaseline(null);
      setLoading(false);
      setPendingConfirm(null);
      setConfirmBusy(false);
      setActionStatus(null);
      setDiscardOpen(false);
      setStaffMsgDirty(false);
      setCustomerMsgDirty(false);
      afterCloseRef.current = null;
    }, 520);
    return () => window.clearTimeout(t);
  }, [open]);

  const auditRows = useMemo(() => {
    if (!activeKey || !settings?.auditLog) return [];
    return settings.auditLog.filter((a) => a.path === `methods.${activeKey}` || a.path === "settings").slice(0, 12);
  }, [activeKey, settings?.auditLog]);

  useEffect(() => {
    if (!open || !focusAudit) return;
    const t = window.setTimeout(() => {
      document.getElementById("payment-method-audit")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
    return () => window.clearTimeout(t);
  }, [open, focusAudit, activeKey]);

  useEffect(() => {
    if (!actionStatus) return;
    const t = window.setTimeout(() => setActionStatus(null), 4200);
    return () => window.clearTimeout(t);
  }, [actionStatus]);

  const dirtySections = useMemo(() => {
    const sections: string[] = [];
    if (!draft || !textBaseline) {
      if (staffMsgDirty || customerMsgDirty) sections.push("Instructions");
      return sections;
    }
    const basicsDirty =
      (draft.displayName ?? "") !== textBaseline.displayName ||
      (draft.priority ?? 100) !== textBaseline.priority;
    const limitsDirty =
      (draft.minCents ?? null) !== textBaseline.minCents ||
      (draft.maxCents ?? null) !== textBaseline.maxCents;
    const availabilityDirty =
      (draft.availabilityRules?.scheduleNote ?? "") !== textBaseline.scheduleNote;
    if (basicsDirty) sections.push("Basics");
    if (limitsDirty) sections.push("Limits & currencies");
    if (availabilityDirty) sections.push("Availability");
    if (staffMsgDirty || customerMsgDirty) sections.push("Instructions");
    return sections;
  }, [draft, textBaseline, staffMsgDirty, customerMsgDirty]);

  const hasDirty = dirtySections.length > 0;

  useEffect(() => {
    onDirtyChange?.(hasDirty);
    return () => onDirtyChange?.(false);
  }, [hasDirty, onDirtyChange]);

  useEffect(() => {
    if (!open || !hasDirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [open, hasDirty]);

  const finishClose = () => {
    setDiscardOpen(false);
    setPendingConfirm(null);
    const after = afterCloseRef.current;
    afterCloseRef.current = null;
    const notifyLeave = leaveGateActiveRef.current;
    leaveGateActiveRef.current = false;
    onClose();
    after?.();
    if (notifyLeave) onLeaveAllowed?.();
  };

  const keepEditing = () => {
    leaveGateActiveRef.current = false;
    afterCloseRef.current = null;
    setDiscardOpen(false);
    onLeaveCancelled?.();
  };

  const attemptClose = (afterClose?: () => void) => {
    if (confirmBusy) return;
    if (discardOpen) return;
    if (pendingConfirm) {
      setPendingConfirm(null);
      if (!leaveGateActiveRef.current) return;
    }
    if (hasDirty) {
      afterCloseRef.current = afterClose ?? null;
      setDiscardOpen(true);
      return;
    }
    afterCloseRef.current = afterClose ?? null;
    finishClose();
  };

  useEffect(() => {
    if (!open || !leaveRequestId || leaveRequestId === lastLeaveRequestRef.current) return;
    lastLeaveRequestRef.current = leaveRequestId;
    leaveGateActiveRef.current = true;
    attemptClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to leave requests
  }, [leaveRequestId, open]);

  const title = draft?.displayName || (activeKey ? methodLabel(activeKey) : "Payment method");
  const iconSrc = activeKey ? paymentMethodIconSrc(activeKey) : null;
  const methodHealth = useMemo(() => {
    if (!draft || !settings) return "inactive" as const;
    return resolvePaymentMethodHealth(settings, draft);
  }, [draft, settings]);
  const isDefault =
    Boolean(draft?.isDefault) ||
    (activeKey != null && settings?.defaultPaymentMethodKey === activeKey);
  const healthLabel = paymentMethodHealthLabel(methodHealth, isDefault);
  const healthBadgeClass = paymentMethodHealthBadgeClass(methodHealth);

  const requestConfirm = (next: PendingConfirm) => {
    if (!canEdit || confirmBusy) return;
    setPendingConfirm(next);
  };

  const queueSave = (
    nextConfig: PaymentMethodConfig,
    meta: {
      title: string;
      copy: string;
      confirmLabel: string;
      danger?: boolean;
      successStatus: string;
      failStatus?: string;
      extras?: { setDefault?: boolean };
    }
  ) => {
    requestConfirm({
      title: meta.title,
      copy: meta.copy,
      confirmLabel: meta.confirmLabel,
      danger: meta.danger,
      successStatus: meta.successStatus,
      failStatus: meta.failStatus ?? "Could not save that change.",
      nextConfig,
      extras: meta.extras
    });
  };

  const runConfirmed = async () => {
    if (!pendingConfirm || !activeKey || confirmBusy) return;
    const pending = pendingConfirm;
    setConfirmBusy(true);
    try {
      const ok = await Promise.resolve(onSave(activeKey, pending.nextConfig, pending.extras));
      if (ok) {
        setDraft(pending.nextConfig);
        setTextBaseline(textBaselineFromConfig(pending.nextConfig));
        setActionTone("ok");
        setActionStatus(pending.successStatus);
        setPendingConfirm(null);
      } else {
        setActionTone("error");
        setActionStatus(pending.failStatus);
        setPendingConfirm(null);
      }
    } catch {
      setActionTone("error");
      setActionStatus(pending.failStatus);
      setPendingConfirm(null);
    } finally {
      setConfirmBusy(false);
    }
  };

  const dismissConfirm = () => {
    if (confirmBusy) return;
    setPendingConfirm(null);
  };

  const discardUnsaved = () => {
    if (textBaseline && draft) {
      setDraft({
        ...draft,
        displayName: textBaseline.displayName,
        priority: textBaseline.priority,
        minCents: textBaseline.minCents,
        maxCents: textBaseline.maxCents,
        availabilityRules: {
          always: Boolean(draft.availabilityRules?.always),
          openHoursOnly: Boolean(draft.availabilityRules?.openHoursOnly),
          scheduleNote: textBaseline.scheduleNote
        }
      });
    }
    setStaffMsgDirty(false);
    setCustomerMsgDirty(false);
    finishClose();
  };

  return (
    <>
    <DetailsDrawerShell
      open={open}
      entityKey={activeKey}
      title={title}
      subtitle={
        catalog
          ? `${GROUP_LABELS[catalog.group]} · ${catalog.family} · ${catalog.rails} rails`
          : "Venue payment method configuration"
      }
      badge={
        <span className="admin-payments-method-drawer-status">
          {iconSrc ? (
            <span className="admin-payments-method-drawer-icon" aria-hidden>
              <img src={iconSrc} alt="" className="admin-payments-method-drawer-icon-img" />
            </span>
          ) : null}
          <span className={`admin-payments-health-issue-badge ${healthBadgeClass}`}>{healthLabel}</span>
        </span>
      }
      closeLabel="Close payment method manager"
      onClose={() => attemptClose()}
      overlay={
        pendingConfirm ? (
          <div
            className="admin-payments-source-confirm"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="payment-method-confirm-title"
            onClick={dismissConfirm}
          >
            <div className="admin-payments-source-confirm-card" onClick={(e) => e.stopPropagation()}>
              <h4 id="payment-method-confirm-title" className="admin-payments-source-confirm-title">
                {pendingConfirm.title}
              </h4>
              <p className="admin-payments-source-confirm-copy">{pendingConfirm.copy}</p>
              <div className="admin-payments-source-confirm-actions">
                <button
                  type="button"
                  className="admin-payments-today-view-all"
                  disabled={confirmBusy}
                  onClick={dismissConfirm}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={`admin-payments-today-view-all is-primary${pendingConfirm.danger ? " is-danger" : ""}`}
                  disabled={confirmBusy}
                  onClick={() => void runConfirmed()}
                >
                  <PaymentsBusyLabel busy={confirmBusy}>{pendingConfirm.confirmLabel}</PaymentsBusyLabel>
                </button>
              </div>
            </div>
          </div>
        ) : null
      }
    >
      {loading && !draft ? <PaymentsDrawerSpinner label="Loading payment method" /> : null}

      <PaymentsDetailsReveal ready={Boolean(draft && activeKey && !loading)}>
        {draft && activeKey ? (
          <>
            <DetailsSection
              title="Support & channel"
              hint="Choosing a payment method does not mark an order paid — ServeOS records and verifies the payment first."
            >
              <DetailsGrid>
                <DetailsRow label="Catalog channel" value={catalog ? GROUP_LABELS[catalog.group] : "—"} />
                <DetailsRow label="Family / rails" value={catalog ? `${catalog.family} · ${catalog.rails}` : "—"} />
                <DetailsRow label="Config version" value={`v${draft.version ?? 1}`} />
                <DetailsRow label="Updated" value={formatDetailsWhen(draft.updatedAt)} />
              </DetailsGrid>
            </DetailsSection>

            {actionStatus ? (
              <p
                className={`admin-payments-source-status${actionTone === "error" ? " is-error" : ""}`}
                role="status"
              >
                {actionStatus}
              </p>
            ) : null}

            <DetailsSection title="Basics" helpTip={SECTION_HELP.basics}>
              <div className="admin-payments-method-config grid gap-3">
                <MethodToggle
                  label="Enabled at this venue"
                  checked={draft.enabled}
                  disabled={!canEdit || confirmBusy}
                  onRequestChange={(enabled) =>
                    queueSave(
                      { ...draft, enabled, isDefault: enabled ? draft.isDefault : false },
                      {
                        title: enabled ? "Enable this method?" : "Disable this method?",
                        copy: enabled
                          ? "This payment method will become available at this venue."
                          : "This payment method will stop being offered at this venue.",
                        confirmLabel: enabled ? "Enable" : "Disable",
                        danger: !enabled,
                        successStatus: enabled ? "Method enabled." : "Method disabled.",
                        failStatus: enabled ? "Could not enable this method." : "Could not disable this method."
                      }
                    )
                  }
                />
                <MethodToggle
                  label="Default method"
                  checked={Boolean(draft.isDefault)}
                  disabled={!canEdit || !draft.enabled || confirmBusy}
                  onRequestChange={(isDefault) =>
                    queueSave(
                      { ...draft, isDefault },
                      {
                        title: isDefault ? "Set as default?" : "Clear default?",
                        copy: isDefault
                          ? "This method will be preferred when guests or staff choose how to pay."
                          : "This method will no longer be the venue default.",
                        confirmLabel: isDefault ? "Set default" : "Clear default",
                        successStatus: isDefault ? "Default method updated." : "Default cleared.",
                        failStatus: "Could not update the default method.",
                        extras: { setDefault: isDefault }
                      }
                    )
                  }
                />
                <label className="grid gap-1">
                  <AdminLabel>Customer-facing name</AdminLabel>
                  <AdminInput
                    value={draft.displayName ?? ""}
                    disabled={!canEdit}
                    onChange={(e) => setDraft({ ...draft, displayName: e.target.value })}
                  />
                </label>
                <label className="grid gap-1">
                  <AdminLabel>Priority</AdminLabel>
                  <AdminInput
                    type="number"
                    value={draft.priority ?? 100}
                    disabled={!canEdit}
                    onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) || 100 })}
                  />
                </label>
              </div>
            </DetailsSection>

            <DetailsSection title="Supported order sources" helpTip={SECTION_HELP.sources}>
              <div className="admin-payments-method-checks" role="group" aria-label="Order sources">
                {ALL_SOURCES.map((source) => {
                  const on = (draft.supportedOrderSources ?? []).includes(source);
                  const label = ORDER_SOURCE_LABELS[source];
                  return (
                    <button
                      key={source}
                      type="button"
                      className={`admin-payments-source-chip${on ? " is-on" : ""}${!canEdit ? " is-disabled" : ""}`}
                      disabled={!canEdit || confirmBusy}
                      aria-pressed={on}
                      onClick={() => {
                        const enable = !on;
                        queueSave(
                          {
                            ...draft,
                            supportedOrderSources: toggleInList(draft.supportedOrderSources ?? [], source, enable)
                          },
                          {
                            title: enable ? "Offer for this source?" : "Remove this source?",
                            copy: enable
                              ? `Customers and staff will be able to use this method for ${label}.`
                              : `This method will no longer be offered for ${label}.`,
                            confirmLabel: enable ? "Offer" : "Remove",
                            danger: !enable,
                            successStatus: enable
                              ? `${label} is now offered for this method.`
                              : `${label} will no longer be offered for this method.`,
                            failStatus: enable
                              ? `Could not offer this method for ${label}.`
                              : `Could not remove ${label} for this method.`
                          }
                        );
                      }}
                    >
                      <span className="admin-payments-source-chip-mark" aria-hidden>
                        {on ? "✓" : "+"}
                      </span>
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            </DetailsSection>

            <DetailsSection title="Limits & currencies" helpTip={SECTION_HELP.limits}>
              <div className="admin-payments-method-config grid gap-3">
                <MethodCurrencyPicker
                  selected={draft.currencies ?? ["SEK"]}
                  disabled={!canEdit || confirmBusy}
                  onRequestToggle={(code, enable) => {
                    const current = sanitizeServeosCurrencies(draft.currencies);
                    const next = enable
                      ? current.includes(code)
                        ? current
                        : [...current, code]
                      : current.filter((c) => c !== code);
                    const currencies = sanitizeServeosCurrencies(next);
                    if (currencies.join(",") === current.join(",")) return;
                    queueSave(
                      { ...draft, currencies },
                      {
                        title: enable ? `Add ${serveosCurrencyLabel(code)}?` : `Remove ${serveosCurrencyLabel(code)}?`,
                        copy: enable
                          ? `This method will accept ${serveosCurrencyLabel(code)}.`
                          : `This method will no longer accept ${serveosCurrencyLabel(code)}.`,
                        confirmLabel: enable ? "Add currency" : "Remove currency",
                        danger: !enable,
                        successStatus: enable
                          ? `${serveosCurrencyLabel(code)} added.`
                          : `${serveosCurrencyLabel(code)} removed.`,
                        failStatus: "Could not update currencies."
                      }
                    );
                  }}
                />
                <div className="grid grid-cols-2 gap-3">
                  <label className="grid gap-1">
                    <AdminLabel>Minimum (öre)</AdminLabel>
                    <AdminInput
                      type="number"
                      disabled={!canEdit}
                      value={draft.minCents ?? ""}
                      onChange={(e) =>
                        setDraft({ ...draft, minCents: e.target.value === "" ? null : Number(e.target.value) })
                      }
                    />
                  </label>
                  <label className="grid gap-1">
                    <AdminLabel>Maximum (öre)</AdminLabel>
                    <AdminInput
                      type="number"
                      disabled={!canEdit}
                      value={draft.maxCents ?? ""}
                      onChange={(e) =>
                        setDraft({ ...draft, maxCents: e.target.value === "" ? null : Number(e.target.value) })
                      }
                    />
                  </label>
                </div>
              </div>
            </DetailsSection>

            <DetailsSection title="Staff recording & verification" helpTip={SECTION_HELP.staff}>
              <div className="admin-payments-method-config grid gap-3">
                <div className="admin-payments-method-checks" role="group" aria-label="Allowed roles">
                  {ALL_ROLES.map((role) => {
                    const on = (draft.allowedRoles ?? []).includes(role);
                    const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
                    return (
                      <button
                        key={role}
                        type="button"
                        className={`admin-payments-source-chip${on ? " is-on" : ""}${!canEdit ? " is-disabled" : ""}`}
                        disabled={!canEdit || confirmBusy}
                        aria-pressed={on}
                        onClick={() => {
                          const enable = !on;
                          queueSave(
                            {
                              ...draft,
                              allowedRoles: toggleInList(draft.allowedRoles ?? [], role, enable)
                            },
                            {
                              title: enable ? `Allow ${roleLabel}?` : `Remove ${roleLabel}?`,
                              copy: enable
                                ? `${roleLabel} staff will be able to record or verify this payment method.`
                                : `${roleLabel} staff will no longer be allowed for this method.`,
                              confirmLabel: enable ? "Allow" : "Remove",
                              danger: !enable,
                              successStatus: enable
                                ? `${roleLabel} role added.`
                                : `${roleLabel} role removed.`,
                              failStatus: enable
                                ? `Could not allow ${roleLabel}.`
                                : `Could not remove ${roleLabel}.`
                            }
                          );
                        }}
                      >
                        <span className="admin-payments-source-chip-mark" aria-hidden>
                          {on ? "✓" : "+"}
                        </span>
                        <span className="capitalize">{role}</span>
                      </button>
                    );
                  })}
                </div>
                <MethodToggle
                  label="Require staff confirmation"
                  checked={Boolean(draft.requiresStaffConfirmation)}
                  disabled={!canEdit || confirmBusy}
                  onRequestChange={(requiresStaffConfirmation) =>
                    queueSave(
                      { ...draft, requiresStaffConfirmation },
                      {
                        title: requiresStaffConfirmation
                          ? "Require staff confirmation?"
                          : "Turn off staff confirmation?",
                        copy: requiresStaffConfirmation
                          ? "Staff must confirm before this payment is treated as settled."
                          : "Staff confirmation will no longer be required for this method.",
                        confirmLabel: requiresStaffConfirmation ? "Require" : "Turn off",
                        danger: !requiresStaffConfirmation,
                        successStatus: requiresStaffConfirmation
                          ? "Staff confirmation required."
                          : "Staff confirmation turned off.",
                        failStatus: "Could not update staff confirmation."
                      }
                    )
                  }
                />
                <MethodToggle
                  label="Require payment reference"
                  checked={Boolean(draft.requiresReference)}
                  disabled={!canEdit || confirmBusy}
                  onRequestChange={(requiresReference) =>
                    queueSave(
                      { ...draft, requiresReference },
                      {
                        title: requiresReference ? "Require payment reference?" : "Turn off payment reference?",
                        copy: requiresReference
                          ? "A payment reference will be required when recording this method."
                          : "Payment reference will no longer be required for this method.",
                        confirmLabel: requiresReference ? "Require" : "Turn off",
                        danger: !requiresReference,
                        successStatus: requiresReference
                          ? "Payment reference required."
                          : "Payment reference requirement removed.",
                        failStatus: "Could not update payment reference setting."
                      }
                    )
                  }
                />
                <MethodPolicyDropdown
                  label="Settlement mode"
                  value={draft.settlementMode ?? "automatic"}
                  options={SETTLEMENT_OPTIONS}
                  disabled={!canEdit || confirmBusy}
                  onRequestChange={(next) => {
                    const settlementMode = next as PaymentSettlementMode;
                    queueSave(
                      { ...draft, settlementMode },
                      {
                        title: "Change settlement mode?",
                        copy: `Settlement will be set to “${SETTLEMENT_LABELS[settlementMode]}”.`,
                        confirmLabel: "Change",
                        successStatus: `Settlement set to ${SETTLEMENT_LABELS[settlementMode]}.`,
                        failStatus: "Could not update settlement mode."
                      }
                    );
                  }}
                />
                <MethodPolicyDropdown
                  label="Reconciliation"
                  value={draft.reconciliationMode ?? "none"}
                  options={RECONCILIATION_OPTIONS}
                  disabled={!canEdit || confirmBusy}
                  onRequestChange={(next) => {
                    const reconciliationMode = next as PaymentReconciliationMode;
                    queueSave(
                      { ...draft, reconciliationMode },
                      {
                        title: "Change reconciliation?",
                        copy: `Reconciliation will be set to “${RECONCILIATION_LABELS[reconciliationMode]}”.`,
                        confirmLabel: "Change",
                        successStatus: `Reconciliation set to ${RECONCILIATION_LABELS[reconciliationMode]}.`,
                        failStatus: "Could not update reconciliation."
                      }
                    );
                  }}
                />
                <MethodPolicyDropdown
                  label="Refund policy"
                  value={draft.refundPolicy ?? "standard"}
                  options={REFUND_OPTIONS}
                  disabled={!canEdit || confirmBusy}
                  onRequestChange={(next) => {
                    const refundPolicy = next as PaymentRefundPolicy;
                    queueSave(
                      {
                        ...draft,
                        refundPolicy,
                        refundsEnabled: refundPolicy !== "disabled"
                      },
                      {
                        title: "Change refund policy?",
                        copy: `Refund policy will be set to “${REFUND_LABELS[refundPolicy]}”.`,
                        confirmLabel: "Change",
                        danger: refundPolicy === "disabled",
                        successStatus: `Refund policy set to ${REFUND_LABELS[refundPolicy]}.`,
                        failStatus: "Could not update refund policy."
                      }
                    );
                  }}
                />
                <MethodPolicyDropdown
                  label="Cancellation"
                  value={draft.cancellationPolicy ?? "allow"}
                  options={CANCELLATION_OPTIONS}
                  disabled={!canEdit || confirmBusy}
                  onRequestChange={(next) => {
                    const cancellationPolicy = next as PaymentCancellationPolicy;
                    queueSave(
                      { ...draft, cancellationPolicy },
                      {
                        title: "Change cancellation policy?",
                        copy: `Cancellation will be set to “${CANCELLATION_LABELS[cancellationPolicy]}”.`,
                        confirmLabel: "Change",
                        successStatus: `Cancellation set to ${CANCELLATION_LABELS[cancellationPolicy]}.`,
                        failStatus: "Could not update cancellation policy."
                      }
                    );
                  }}
                />
              </div>
            </DetailsSection>

            <DetailsSection title="Availability" helpTip={SECTION_HELP.availability}>
              <div className="admin-payments-method-config grid gap-3">
                <MethodToggle
                  label="Always available"
                  checked={Boolean(draft.availabilityRules?.always)}
                  disabled={!canEdit || confirmBusy}
                  onRequestChange={(always) =>
                    queueSave(
                      {
                        ...draft,
                        availabilityRules: {
                          always,
                          openHoursOnly: always ? false : Boolean(draft.availabilityRules?.openHoursOnly),
                          scheduleNote: draft.availabilityRules?.scheduleNote ?? ""
                        }
                      },
                      {
                        title: always ? "Make always available?" : "Turn off always available?",
                        copy: always
                          ? "This method will be offered regardless of open hours."
                          : "Always-available will be turned off for this method.",
                        confirmLabel: always ? "Make always available" : "Turn off",
                        successStatus: always ? "Always available set." : "Always available cleared.",
                        failStatus: "Could not update availability."
                      }
                    )
                  }
                />
                <MethodToggle
                  label="Open hours only"
                  checked={Boolean(draft.availabilityRules?.openHoursOnly)}
                  disabled={!canEdit || Boolean(draft.availabilityRules?.always) || confirmBusy}
                  onRequestChange={(openHoursOnly) =>
                    queueSave(
                      {
                        ...draft,
                        availabilityRules: {
                          always: false,
                          openHoursOnly,
                          scheduleNote: draft.availabilityRules?.scheduleNote ?? ""
                        }
                      },
                      {
                        title: openHoursOnly ? "Limit to open hours?" : "Remove open-hours limit?",
                        copy: openHoursOnly
                          ? "This method will only be offered during venue open hours."
                          : "This method will no longer be limited to open hours.",
                        confirmLabel: openHoursOnly ? "Limit to open hours" : "Remove limit",
                        successStatus: openHoursOnly ? "Open hours only set." : "Open hours limit cleared.",
                        failStatus: "Could not update open-hours setting."
                      }
                    )
                  }
                />
                <label className="grid gap-1">
                  <AdminLabel>Schedule note</AdminLabel>
                  <AdminInput
                    value={draft.availabilityRules?.scheduleNote ?? ""}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        availabilityRules: {
                          always: Boolean(draft.availabilityRules?.always),
                          openHoursOnly: Boolean(draft.availabilityRules?.openHoursOnly),
                          scheduleNote: e.target.value
                        }
                      })
                    }
                  />
                </label>
              </div>
            </DetailsSection>

            <DetailsSection title="Instructions" helpTip={SECTION_HELP.instructions}>
              <div className="admin-payments-method-config grid gap-3">
                <MethodMessageField
                  label="Staff instructions"
                  value={draft.instructionsStaff ?? ""}
                  disabled={!canEdit || confirmBusy}
                  saveLabel="Save staff instructions"
                  onDirtyChange={setStaffMsgDirty}
                  onRequestSave={(instructionsStaff) =>
                    queueSave(
                      { ...draft, instructionsStaff },
                      {
                        title: "Save staff instructions?",
                        copy: "These notes will guide staff when recording or verifying this payment method.",
                        confirmLabel: "Save",
                        successStatus: "Staff instructions saved.",
                        failStatus: "Could not save staff instructions."
                      }
                    )
                  }
                />
                <MethodMessageField
                  label="Customer instructions"
                  value={draft.instructionsCustomer ?? ""}
                  disabled={!canEdit || confirmBusy}
                  saveLabel="Save customer instructions"
                  onDirtyChange={setCustomerMsgDirty}
                  onRequestSave={(instructionsCustomer) =>
                    queueSave(
                      { ...draft, instructionsCustomer },
                      {
                        title: "Save customer instructions?",
                        copy: "These notes can appear for guests during checkout or pay-at-table for this method.",
                        confirmLabel: "Save",
                        successStatus: "Customer instructions saved.",
                        failStatus: "Could not save customer instructions."
                      }
                    )
                  }
                />
              </div>
            </DetailsSection>

            <DetailsSection title="Provider capture" helpTip={SECTION_HELP.provider}>
              <div className="admin-payments-method-config grid gap-3">
                <DetailsGrid>
                  <DetailsRow label="Provider" value={draft.provider ?? "none"} />
                </DetailsGrid>
                <MethodPolicyDropdown
                  label="Capture"
                  value={draft.capture}
                  options={CAPTURE_OPTIONS}
                  disabled={!canEdit || confirmBusy}
                  onRequestChange={(next) => {
                    const capture = next as PaymentMethodConfig["capture"];
                    queueSave(
                      { ...draft, capture },
                      {
                        title: "Change capture mode?",
                        copy: `Capture will be set to “${CAPTURE_LABELS[capture]}”.`,
                        confirmLabel: "Change",
                        successStatus: `Capture set to ${CAPTURE_LABELS[capture]}.`,
                        failStatus: "Could not update capture mode."
                      }
                    );
                  }}
                />
                <MethodPolicyDropdown
                  label="3D Secure"
                  value={draft.threeDSecure}
                  options={THREE_DS_OPTIONS}
                  disabled={!canEdit || confirmBusy}
                  onRequestChange={(next) => {
                    const threeDSecure = next as PaymentMethodConfig["threeDSecure"];
                    queueSave(
                      { ...draft, threeDSecure },
                      {
                        title: "Change 3D Secure setting?",
                        copy: `3D Secure will be set to “${THREE_DS_LABELS[threeDSecure]}”.`,
                        confirmLabel: "Change",
                        successStatus: `3D Secure set to ${THREE_DS_LABELS[threeDSecure]}.`,
                        failStatus: "Could not update 3D Secure."
                      }
                    );
                  }}
                />
              </div>
            </DetailsSection>

            <DetailsSection title="Setup" helpTip="Re-open the backend-driven setup wizard to change credentials, contexts, or verification.">
              <div className="admin-payments-method-setup-actions">
                <button
                  type="button"
                  className="admin-menu-manage-action"
                  disabled={!canEdit || confirmBusy || !activeKey}
                  onClick={() => {
                    if (!activeKey || !onEditSetup) return;
                    attemptClose(() => onEditSetup(activeKey));
                  }}
                >
                  <span className="admin-menu-manage-action-label">Edit setup</span>
                  <span className="admin-menu-manage-action-desc">
                    Return to the provider setup flow to update credentials, channels, or verification.
                  </span>
                </button>
              </div>
            </DetailsSection>

            <DetailsSection title="Audit history" helpTip={SECTION_HELP.audit}>
              <div id="payment-method-audit">
                {auditRows.length === 0 ? (
                  <p className="admin-staff-profile-muted text-sm">No method-specific audit events yet.</p>
                ) : (
                  <ul className="admin-payments-method-audit">
                    {auditRows.map((row) => (
                      <li key={row.id}>
                        <strong>{row.action}</strong>
                        <span>{formatDetailsWhen(row.at)}</span>
                        <span>{row.path}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </DetailsSection>

            {token && restaurantId && onToast && onSettingsRefresh ? (
              <PaymentMethodDangerZoneSection
                open={open}
                token={token}
                restaurantId={restaurantId}
                methodKey={activeKey}
                canEdit={canEdit}
                onToast={onToast}
                onCompleted={(payload) => {
                  onSettingsRefresh(payload);
                  if (payload.settings && activeKey) {
                    const next = getMethodConfig(payload.settings, activeKey);
                    setDraft(next);
                    setTextBaseline(textBaselineFromConfig(next));
                  }
                }}
              />
            ) : null}
          </>
        ) : null}
      </PaymentsDetailsReveal>
    </DetailsDrawerShell>

    <MenuPageModalShell
      open={discardOpen}
      onClose={keepEditing}
      title="Unsaved changes"
      description="You have edits that are not saved yet."
      titleId="payment-method-unsaved-title"
      maxWidthClass="max-w-md"
      stackLevel="overlay"
      panelClassName="admin-menu-create-confirm-modal"
    >
      <ProfileModalNote>
        {dirtySections.length ? (
          <>
            You have unsaved changes in:
            <ul className="mt-2 list-disc pl-5">
              {dirtySections.map((section) => (
                <li key={section}>{section}</li>
              ))}
            </ul>
            Leaving now discards them. This cannot be undone.
          </>
        ) : (
          "You have unsaved changes. Leaving now discards them. This cannot be undone."
        )}
      </ProfileModalNote>
      <ProfileModalFooter
        onCancel={keepEditing}
        onConfirm={discardUnsaved}
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        danger
      />
    </MenuPageModalShell>
    </>
  );
}
