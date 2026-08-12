import { useEffect, useMemo, useRef, useState } from "react";
import type { PaymentMethodConfig, PaymentMethodCapabilitiesPayload, VenuePaymentSettings } from "../../../api";
import { startVenuePaymentMethodSetup, submitVenuePaymentMethodSetupStep } from "../../../api";
import { MenuEntityActionsMenu } from "../menu/MenuEntityActionsMenu";
import { MenuActionConfirmModal } from "../menu/MenuActionConfirmModal";
import { MenuListSearchField } from "../menu/MenuPageUi";
import {
  PAYMENT_METHOD_CATALOG,
  PAYMENT_METHOD_FAMILY_ORDER,
  paymentMethodFamilyLabel,
  type PaymentMethodFamilyFilter
} from "./paymentMethodCatalog";
import {
  buildPaymentMethodCardActions,
  methodAllowsManage,
  methodNeedsSetup,
  type PaymentMethodCardActionId
} from "./paymentMethodCardActions";
import { paymentMethodIconSrc } from "./paymentMethodIcons";
import {
  applyPaymentMethodFamilyFilter,
  applyPaymentMethodFilters,
  applyPaymentMethodSort,
  applyServerMethodCapability,
  groupPaymentMethodRowsByFamily,
  matchesPaymentMethodSearch,
  PAYMENT_METHODS_LIST_QUERY,
  paymentMethodHealthLabel,
  resolvePaymentMethodHealth,
  type PaymentMethodListRow
} from "./paymentMethodsListQuery";
import { PaymentMethodManageDrawer } from "./PaymentMethodManageDrawer";
import { PaymentMethodSetupWizard } from "./PaymentMethodSetupWizard";
import { PaymentMethodsBulkManageDrawer } from "./PaymentMethodsBulkManageDrawer";
import { GROUP_LABELS, ORDER_SOURCE_LABELS, getMethodConfig } from "./paymentsUiHelpers";

type Props = {
  token: string;
  restaurantId: string;
  settings: VenuePaymentSettings;
  methodCapabilities?: PaymentMethodCapabilitiesPayload | null;
  canEdit: boolean;
  selectedKeys: string[];
  onSelectionChange: (keys: string[]) => void;
  /** Increment from parent Manage / Manage selected control. */
  manageRequestId?: number;
  /** Increment to request closing the manage drawer (e.g. leaving Methods tab). */
  leaveRequestId?: number;
  onLeaveAllowed?: () => void;
  onLeaveCancelled?: () => void;
  onManageDirtyChange?: (dirty: boolean) => void;
  onManageOpenChange?: (open: boolean) => void;
  onSettingsRefresh?: (payload: {
    settings?: VenuePaymentSettings;
    methodCapabilities?: PaymentMethodCapabilitiesPayload;
  }) => void;
  onSaveMethod: (
    methodKey: string,
    config: PaymentMethodConfig,
    extras?: { setDefault?: boolean }
  ) => boolean | Promise<boolean>;
  onSaveBulkMethods: (
    updates: Array<{ key: string; config: PaymentMethodConfig }>,
    extras?: { setDefaultKey?: string | null }
  ) => Promise<boolean>;
  onViewActivity: () => void;
  onViewReconciliation: () => void;
  onToast: (message: string, tone?: "success" | "error") => void;
};

function buildRows(
  settings: VenuePaymentSettings,
  methodCapabilities?: PaymentMethodCapabilitiesPayload | null
): PaymentMethodListRow[] {
  const byKey = new Map((methodCapabilities?.methods ?? []).map((m) => [m.key, m]));
  return PAYMENT_METHOD_CATALOG.map((entry) => {
    const config = getMethodConfig(settings, entry.key);
    const enabled = Boolean(config.enabled);
    const isDefault = settings.defaultPaymentMethodKey === entry.key || Boolean(config.isDefault);
    const health = resolvePaymentMethodHealth(settings, config);
    const sources = (config.supportedOrderSources ?? [])
      .map((s) => ORDER_SOURCE_LABELS[s])
      .filter(Boolean);
    const base: PaymentMethodListRow = {
      ...entry,
      enabled,
      isDefault,
      health,
      config,
      statusLabel: paymentMethodHealthLabel(health, isDefault),
      channelLabel: GROUP_LABELS[entry.group],
      supportLabel: sources.length ? sources.slice(0, 3).join(", ") : entry.hint
    };
    return applyServerMethodCapability(base, byKey.get(entry.key));
  });
}

export function PaymentsMethodsTab({
  token,
  restaurantId,
  settings,
  methodCapabilities = null,
  canEdit,
  selectedKeys,
  onSelectionChange,
  manageRequestId = 0,
  leaveRequestId = 0,
  onLeaveAllowed,
  onLeaveCancelled,
  onManageDirtyChange,
  onManageOpenChange,
  onSettingsRefresh,
  onSaveMethod,
  onSaveBulkMethods,
  onViewActivity,
  onViewReconciliation,
  onToast
}: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [activeSort, setActiveSort] = useState(PAYMENT_METHODS_LIST_QUERY.defaultSort);
  const [familyFilter, setFamilyFilter] = useState<PaymentMethodFamilyFilter>("all");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [manageKey, setManageKey] = useState<string | null>(null);
  const [setupKey, setSetupKey] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [focusAudit, setFocusAudit] = useState(false);
  const [confirm, setConfirm] = useState<{
    key: string;
    action: "disable" | "enable" | "set_default" | "duplicate" | "test";
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const lastManageRequestRef = useRef(manageRequestId);

  const rows = useMemo(() => buildRows(settings, methodCapabilities), [settings, methodCapabilities]);
  const filtered = useMemo(() => {
    const searched = rows.filter((r) => matchesPaymentMethodSearch(r, searchQuery));
    const narrowed = applyPaymentMethodFilters(searched, activeFilters);
    const byFamily = applyPaymentMethodFamilyFilter(narrowed, familyFilter);
    return applyPaymentMethodSort(byFamily, activeSort);
  }, [rows, searchQuery, activeFilters, activeSort, familyFilter]);

  const familySections = useMemo(
    () => groupPaymentMethodRowsByFamily(filtered, PAYMENT_METHOD_FAMILY_ORDER),
    [filtered]
  );

  const familyChipOptions = useMemo(() => {
    const present = new Set(rows.map((r) => r.family));
    return PAYMENT_METHOD_FAMILY_ORDER.filter((f) => present.has(f));
  }, [rows]);

  const selectedSet = useMemo(() => new Set(selectedKeys), [selectedKeys]);
  const selectedRows = useMemo(
    () => rows.filter((row) => selectedSet.has(row.key)),
    [rows, selectedSet]
  );
  const allFilteredSelected =
    filtered.length > 0 && filtered.every((row) => selectedSet.has(row.key));
  const someFilteredSelected = filtered.some((row) => selectedSet.has(row.key));

  useEffect(() => {
    onManageOpenChange?.(Boolean(manageKey));
    return () => onManageOpenChange?.(false);
  }, [manageKey, onManageOpenChange]);

  useEffect(() => {
    const el = selectAllRef.current;
    if (!el) return;
    el.indeterminate = someFilteredSelected && !allFilteredSelected;
  }, [someFilteredSelected, allFilteredSelected]);

  useEffect(() => {
    if (!manageRequestId || manageRequestId === lastManageRequestRef.current) return;
    lastManageRequestRef.current = manageRequestId;
    if (selectedKeys.length === 0) return;
    setFocusAudit(false);
    if (selectedKeys.length === 1) {
      const row = rows.find((r) => r.key === selectedKeys[0]);
      setBulkOpen(false);
      if (row && methodNeedsSetup(row)) {
        setManageKey(null);
        setSetupKey(row.key);
        return;
      }
      if (row && !methodAllowsManage(row)) {
        onToast("Complete setup before managing this method.", "error");
        setSetupKey(row.key);
        return;
      }
      setManageKey(selectedKeys[0] ?? null);
      return;
    }
    const blocked = selectedRows.filter((r) => methodNeedsSetup(r) || !methodAllowsManage(r));
    if (blocked.length) {
      onToast("Select only methods that are already set up to bulk manage.", "error");
      return;
    }
    setManageKey(null);
    setBulkOpen(true);
  }, [manageRequestId, selectedKeys, rows, selectedRows, onToast]);

  const toggleSelection = (key: string, nextChecked?: boolean) => {
    const shouldCheck = nextChecked ?? !selectedSet.has(key);
    const next = new Set(selectedSet);
    if (shouldCheck) next.add(key);
    else next.delete(key);
    onSelectionChange([...next]);
  };

  const toggleSelectAllFiltered = (checked: boolean) => {
    const next = new Set(selectedSet);
    for (const row of filtered) {
      if (checked) next.add(row.key);
      else next.delete(row.key);
    }
    onSelectionChange([...next]);
  };

  const runToggle = async (key: string, enabled: boolean) => {
    const row = rows.find((r) => r.key === key);
    if (enabled) {
      if (!row || row.canEnable !== true) {
        onToast(row?.setupReason || "Complete setup before enabling this method.", "error");
        setConfirm(null);
        setSetupKey(key);
        return;
      }
      // Fresh eligibility via backend setup session — never trust a prior UI readiness check alone.
      setBusy(true);
      try {
        const started = await startVenuePaymentMethodSetup(token, restaurantId, key);
        if (!started.ok || !started.session) {
          onToast(started.message ?? started.error ?? "Could not start enable check.", "error");
          return;
        }
        const enabledRes = await submitVenuePaymentMethodSetupStep(
          token,
          restaurantId,
          key,
          "ACTIVATE",
          { expectedVersion: started.session.version, values: { confirmEnable: true } }
        );
        if (!enabledRes.ok) {
          onToast(enabledRes.message ?? enabledRes.error ?? "Enable failed.", "error");
          if (enabledRes.session?.status !== "ENABLED") setSetupKey(key);
          return;
        }
        onSettingsRefresh?.({
          settings: enabledRes.settings,
          methodCapabilities: enabledRes.methodCapabilities
        });
        onToast(`${row.label} is enabled.`, "success");
      } finally {
        setBusy(false);
        setConfirm(null);
      }
      return;
    }
    const config = { ...getMethodConfig(settings, key), enabled: false };
    setBusy(true);
    try {
      await onSaveMethod(key, config);
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const runSetDefault = async (key: string) => {
    const config = { ...getMethodConfig(settings, key), enabled: true, isDefault: true };
    setBusy(true);
    try {
      await onSaveMethod(key, config, { setDefault: true });
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const runDuplicate = async (key: string) => {
    const config = {
      ...getMethodConfig(settings, key),
      displayName: `${getMethodConfig(settings, key).displayName || key} (copy)`,
      isDefault: false
    };
    setBusy(true);
    try {
      await onSaveMethod(key, config);
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const runTest = (key: string) => {
    const row = rows.find((r) => r.key === key);
    onToast(
      row?.enabled
        ? "Test: record payment against an unpaid order — customer claims never mark PAID."
        : "Enable this method before running a live test.",
      "success"
    );
    setConfirm(null);
  };

  const openMethod = (row: PaymentMethodListRow) => {
    setFocusAudit(false);
    if (methodNeedsSetup(row) || !methodAllowsManage(row)) {
      setManageKey(null);
      setSetupKey(row.key);
      return;
    }
    setSetupKey(null);
    setManageKey(row.key);
  };

  const handleAction = (row: PaymentMethodListRow, actionId: string) => {
    const id = actionId as PaymentMethodCardActionId;
    setOpenMenuId(null);
    if (id === "setup") {
      setSetupKey(row.key);
      return;
    }
    if (id === "manage") {
      if (!methodAllowsManage(row) || methodNeedsSetup(row)) {
        onToast("Complete setup before managing this method.", "error");
        setSetupKey(row.key);
        return;
      }
      setFocusAudit(false);
      setManageKey(row.key);
      return;
    }
    if (id === "view_audit") {
      if (!methodAllowsManage(row) && !row.enabled) {
        onToast("Complete setup before viewing configuration audit.", "error");
        setSetupKey(row.key);
        return;
      }
      setFocusAudit(true);
      setManageKey(row.key);
      return;
    }
    if (id === "view_activity") {
      onViewActivity();
      return;
    }
    if (id === "view_reconciliation") {
      onViewReconciliation();
      return;
    }
    if (id === "enable") {
      if (row.canEnable !== true) {
        onToast(row.setupReason || "Complete setup before enabling this method.", "error");
        setSetupKey(row.key);
        return;
      }
      setConfirm({ key: row.key, action: "enable" });
      return;
    }
    if (id === "disable" || id === "set_default" || id === "duplicate" || id === "test") {
      if ((id === "duplicate" || id === "test") && !row.enabled) {
        onToast("Enable this method before that action.", "error");
        return;
      }
      setConfirm({ key: row.key, action: id });
    }
  };

  const confirmCopy = (() => {
    if (!confirm) return { title: "", description: "", label: "Confirm", danger: false };
    const label = rows.find((r) => r.key === confirm.key)?.label ?? confirm.key;
    if (confirm.action === "disable") {
      return {
        title: `Disable ${label}?`,
        description: "Guests and staff will no longer be able to settle with this method until it is enabled again.",
        label: "Disable method",
        danger: true
      };
    }
    if (confirm.action === "enable") {
      return {
        title: `Enable ${label}?`,
        description: "This method becomes available according to its supported order sources and staff rules.",
        label: "Enable method",
        danger: false
      };
    }
    if (confirm.action === "set_default") {
      return {
        title: `Set ${label} as default?`,
        description: "New settlement flows will prefer this method. Selecting pay-at-venue still never marks an order paid by itself.",
        label: "Set as default",
        danger: false
      };
    }
    if (confirm.action === "test") {
      return {
        title: `Run a test for ${label}?`,
        description:
          "This opens the test guidance for recording a payment against an unpaid order. Customer claims never mark an order paid by themselves.",
        label: "Run test",
        danger: false
      };
    }
    return {
      title: `Duplicate ${label} configuration?`,
      description: "ServeOS will write a new versioned configuration snapshot to the audit log (backend SSOT).",
      label: "Duplicate",
      danger: false
    };
  })();

  return (
    <div className="admin-payments-methods-page admin-payments-methods-page--unified">
      <div className="admin-payments-methods-board-head">
        <div>
          <p className="admin-payments-methods-board-title">Payment methods</p>
          <p className="admin-payments-methods-board-desc">
            Turn payment options on or off for your venue, then open any method to set how guests and staff can use it.
          </p>
        </div>
      </div>

      <MenuListSearchField
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search methods by name, channel, rails, or source…"
        aria-label="Search payment methods"
        filterGroups={PAYMENT_METHODS_LIST_QUERY.filterGroups}
        sortOptions={PAYMENT_METHODS_LIST_QUERY.sortOptions}
        defaultSort={PAYMENT_METHODS_LIST_QUERY.defaultSort}
        activeFilters={activeFilters}
        activeSort={activeSort}
        totalCount={rows.length}
        resultCount={filtered.length}
        onFiltersChange={setActiveFilters}
        onSortChange={setActiveSort}
        filterTitle="Filter payment methods"
        filterSubtitle="Narrow by status, channel, and acquiring rails."
        sortTitle="Sort payment methods"
        sortSubtitle="Changes apply to the list instantly."
      />

      <div className="admin-payments-methods-list-toolbar">
        <div
          className="admin-payments-methods-family-chips"
          role="tablist"
          aria-label="Payment method groups"
        >
          <button
            type="button"
            role="tab"
            aria-selected={familyFilter === "all"}
            className={`admin-payments-methods-family-chip${familyFilter === "all" ? " is-active" : ""}`}
            onClick={() => setFamilyFilter("all")}
          >
            All
          </button>
          {familyChipOptions.map((family) => (
            <button
              key={family}
              type="button"
              role="tab"
              aria-selected={familyFilter === family}
              className={`admin-payments-methods-family-chip${familyFilter === family ? " is-active" : ""}`}
              onClick={() => setFamilyFilter(family)}
            >
              {paymentMethodFamilyLabel(family)}
            </button>
          ))}
        </div>

        {filtered.length > 0 ? (
          <label className="admin-menu-surface-select-all admin-payments-methods-select-all">
            <input
              ref={selectAllRef}
              type="checkbox"
              className="admin-menu-surface-checkbox"
              checked={allFilteredSelected}
              aria-label="Select all payment methods currently listed"
              onChange={(e) => toggleSelectAllFiltered(e.target.checked)}
            />
            <span className="admin-menu-surface-select-all-label">Select all</span>
          </label>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <p className="admin-config-text-muted py-2 text-sm">No payment methods match your search or filters.</p>
      ) : (
        <div className="admin-payments-methods-grouped-list">
          {familySections.map((section) => (
            <section key={section.family} className="admin-payments-methods-family-section">
              {familyFilter === "all" ? (
                <h3 className="admin-payments-methods-family-heading">
                  {paymentMethodFamilyLabel(section.family)}
                </h3>
              ) : null}
              <ul className="admin-menu-surface-list admin-payments-methods-surface-list">
                {section.rows.map((row, index) => {
                  const actions = buildPaymentMethodCardActions(row, { canEdit });
                  const isChecked = selectedSet.has(row.key);
                  const iconSrc = paymentMethodIconSrc(row.key);
                  return (
                    <li
                      key={row.key}
                      className="admin-menu-surface-list-item"
                      style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
                    >
                      <div
                        className={`admin-menu-surface-card admin-payments-method-card-row is-${row.health}${isChecked ? " is-checked" : ""}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => openMethod(row)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openMethod(row);
                          }
                        }}
                      >
                        <label
                          className="admin-menu-surface-checkbox-wrap"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            className="admin-menu-surface-checkbox"
                            checked={isChecked}
                            aria-label={`Select ${row.label}`}
                            onChange={(e) => toggleSelection(row.key, e.target.checked)}
                          />
                        </label>

                        <span className={`admin-menu-surface-status admin-payments-method-tone is-${row.health}`}>
                          {row.statusLabel}
                        </span>

                        {iconSrc ? (
                          <span className="admin-payments-method-icon" aria-hidden>
                            <img
                              src={iconSrc}
                              alt=""
                              className="admin-payments-method-icon-img"
                              loading="lazy"
                              decoding="async"
                            />
                          </span>
                        ) : null}

                        <div className="admin-menu-surface-main">
                          <span className={`admin-menu-surface-name admin-payments-method-tone is-${row.health}`}>
                            {row.config.displayName || row.label}
                          </span>
                          <span className="admin-menu-surface-sep" aria-hidden>
                            ·
                          </span>
                          <span className="admin-menu-surface-desc">{row.channelLabel}</span>
                          <span className="admin-menu-surface-sep" aria-hidden>
                            ·
                          </span>
                          <span className="admin-menu-surface-meta">{row.supportLabel}</span>
                          <span className="admin-menu-surface-sep" aria-hidden>
                            ·
                          </span>
                          <span className="admin-menu-surface-meta">v{row.config.version ?? 1}</span>
                        </div>

                        <div
                          className="admin-menu-surface-actions"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          <MenuEntityActionsMenu
                            entityName={row.label}
                            subtitle={row.channelLabel}
                            hideHeader
                            open={openMenuId === row.key}
                            actions={actions}
                            onToggle={() => setOpenMenuId((cur) => (cur === row.key ? null : row.key))}
                            onAction={(id) => handleAction(row, id)}
                          />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <PaymentMethodSetupWizard
        open={Boolean(setupKey)}
        token={token}
        restaurantId={restaurantId}
        methodKey={setupKey}
        methodLabel={rows.find((r) => r.key === setupKey)?.label ?? setupKey ?? "method"}
        canEdit={canEdit}
        onClose={() => setSetupKey(null)}
        onCompleted={(payload) => onSettingsRefresh?.(payload)}
        onToast={onToast}
      />

      <PaymentMethodManageDrawer
        open={Boolean(manageKey)}
        methodKey={manageKey}
        settings={settings}
        canEdit={canEdit}
        focusAudit={focusAudit}
        leaveRequestId={leaveRequestId}
        onLeaveAllowed={onLeaveAllowed}
        onLeaveCancelled={onLeaveCancelled}
        onDirtyChange={onManageDirtyChange}
        onClose={() => {
          setManageKey(null);
          setFocusAudit(false);
        }}
        onSave={async (key, config, extras) => {
          try {
            return Boolean(await onSaveMethod(key, config, extras));
          } catch {
            return false;
          }
        }}
      />

      <PaymentMethodsBulkManageDrawer
        open={bulkOpen}
        settings={settings}
        targets={selectedRows}
        canEdit={canEdit}
        onClose={() => setBulkOpen(false)}
        onClearSelection={() => onSelectionChange([])}
        onSaveBulk={onSaveBulkMethods}
        onViewActivity={onViewActivity}
        onViewReconciliation={onViewReconciliation}
        onToast={onToast}
      />

      <MenuActionConfirmModal
        open={Boolean(confirm)}
        title={confirmCopy.title}
        description={confirmCopy.description}
        confirmLabel={confirmCopy.label}
        danger={confirmCopy.danger}
        busy={busy}
        onClose={() => (busy ? undefined : setConfirm(null))}
        onConfirm={() => {
          if (!confirm) return;
          if (confirm.action === "enable") void runToggle(confirm.key, true);
          else if (confirm.action === "disable") void runToggle(confirm.key, false);
          else if (confirm.action === "set_default") void runSetDefault(confirm.key);
          else if (confirm.action === "test") runTest(confirm.key);
          else void runDuplicate(confirm.key);
        }}
      />
    </div>
  );
}
