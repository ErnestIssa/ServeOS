import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  connectVenuePaymentProvider,
  disconnectVenuePaymentProvider,
  getVenuePaymentOverview,
  getVenuePaymentReconciliation,
  getVenuePaymentSettings,
  getVenuePaymentTransaction,
  getVenuePaymentWebhookHealth,
  listRestaurants,
  listVenuePaymentLogs,
  listVenuePaymentPayouts,
  listVenuePaymentRefunds,
  listVenuePaymentTransactions,
  patchVenuePaymentSettings,
  type PaymentLogRow,
  type PaymentMethodConfig,
  type PaymentOverview,
  type PaymentPayoutRow,
  type PaymentProviderEnvReady,
  type PaymentReconciliation,
  type PaymentRefundRow,
  type PaymentTransactionDetail,
  type PaymentTransactionRow,
  type PaymentWebhookHealth,
  type VenuePaymentSettings
} from "../../../api";
import {
  AdminBtnPrimary,
  AdminEmptyState,
  AdminInput,
  AdminLabel,
  AdminPanel,
  AdminRefreshButton,
  AdminSectionHeader,
  subPanelCls
} from "../../AdminUi";
import { AdminStaleContent } from "../../AdminSkeleton";
import { useAdminToast } from "../../AdminToast";
import { ADMIN_NAV_SYNC_EVENT, parseAdminHashQuery } from "../../adminWorkspaceRouting";
import { usePageRecoverySync, useSilentRevalidate } from "../../sync/adminPageSync";
import { ProfileModalFooter, ProfileModalShell } from "../../profile/ProfileModalShell";
import { canEditPayments, paymentsEditReason } from "../paymentsAccess";
import {
  CONFIG_PRESET_DESCRIPTIONS,
  PAYMENTS_TAB_LABELS,
  PAYMENTS_TABS,
  normalizePaymentsTab,
  type PaymentsSectionTab
} from "../configRouting";
import { PaymentMethodConfigModal } from "./PaymentMethodConfigModal";
import { PaymentProviderDetailModal } from "./PaymentProviderDetailModal";
import { PaymentTransactionDrawer } from "./PaymentTransactionDrawer";
import { PaymentsAdvancedSettingsPage } from "./PaymentsAdvancedSettingsPage";
import { PaymentsLogsTab } from "./PaymentsLogsTab";
import { PaymentsMethodsTab } from "./PaymentsMethodsTab";
import { PaymentsOverviewTab } from "./PaymentsOverviewTab";
import { PaymentsPayoutsTab } from "./PaymentsPayoutsTab";
import { PaymentsProvidersTab } from "./PaymentsProvidersTab";
import { PaymentsReconciliationTab } from "./PaymentsReconciliationTab";
import { PaymentsRefundsTab } from "./PaymentsRefundsTab";
import { PaymentsRulesTab } from "./PaymentsRulesTab";
import { PaymentsTransactionsTab } from "./PaymentsTransactionsTab";
import { RefundDetailModal } from "./RefundDetailModal";
import { getMethodConfig } from "./paymentsUiHelpers";

type Props = {
  token: string | null;
  restaurantId: string | null;
};

const TAB_TRANSITION = { duration: 0.34, ease: [0.22, 1, 0.36, 1] as const };

function setPaymentsTabHash(next: PaymentsSectionTab, advanced = false) {
  const base = window.location.hash.split("?")[0] || "#/admin/config/payments";
  const q = parseAdminHashQuery();
  q.set("tab", next);
  if (advanced) q.set("view", "advanced");
  else q.delete("view");
  const qs = q.toString();
  window.location.hash = qs ? `${base}?${qs}` : base;
}

export function AdminConfigPaymentsPage({ token, restaurantId }: Props) {
  const { pushToast } = useAdminToast();
  const [tab, setTab] = useState<PaymentsSectionTab>("overview");
  const [role, setRole] = useState("STAFF");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<VenuePaymentSettings | null>(null);
  const [envReady, setEnvReady] = useState<PaymentProviderEnvReady | null>(null);
  const [overview, setOverview] = useState<PaymentOverview | null>(null);
  const [transactions, setTransactions] = useState<PaymentTransactionRow[]>([]);
  const [txnSource, setTxnSource] = useState<"live" | "demo">("demo");
  const [refunds, setRefunds] = useState<PaymentRefundRow[]>([]);
  const [refundSource, setRefundSource] = useState<"live" | "demo">("demo");
  const [reconciliation, setReconciliation] = useState<PaymentReconciliation | null>(null);
  const [payouts, setPayouts] = useState<PaymentPayoutRow[]>([]);
  const [payoutSummary, setPayoutSummary] = useState<{
    upcomingCents: number;
    lastCents: number;
    currency: string;
  } | null>(null);
  const [logs, setLogs] = useState<PaymentLogRow[]>([]);
  const [logSource, setLogSource] = useState<"live" | "demo">("demo");
  const [webhookHealth, setWebhookHealth] = useState<PaymentWebhookHealth | null>(null);
  const [activityRefreshKey, setActivityRefreshKey] = useState(0);

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [methodKey, setMethodKey] = useState<string | null>(null);
  const [providerDetail, setProviderDetail] = useState<"stripe" | "swish" | "terminals" | null>(null);
  const [connectOpen, setConnectOpen] = useState<"stripe" | "swish" | null>(null);
  const [connectId, setConnectId] = useState("");
  const [selectedTxn, setSelectedTxn] = useState<PaymentTransactionDetail | null>(null);
  const [txnDrawerOpen, setTxnDrawerOpen] = useState(false);
  const [selectedRefund, setSelectedRefund] = useState<PaymentRefundRow | null>(null);

  const canEdit = useMemo(() => canEditPayments(role), [role]);
  const lockReason = paymentsEditReason(role);

  const paymentsTitle = (
    <span className="admin-payments-title-inline">
      Payments
      <span className="admin-payments-help-wrap">
        <span className="admin-payments-help" tabIndex={0} aria-describedby="admin-payments-help-tip">
          ?
        </span>
        <span id="admin-payments-help-tip" className="admin-payments-help-tip" role="tooltip">
          ServeOS subscription billing is managed under Billing — this workspace is guest payment infrastructure
          only.
        </span>
      </span>
    </span>
  );

  const loadPaymentsContext = useCallback(
    async (mode: "initial" | "refresh" | "soft") => {
      if (!token || !restaurantId) return;
      if (mode === "initial") setLoading(true);
      else if (mode === "refresh") setRefreshing(true);

      const [
        restaurantsRes,
        paymentRes,
        overviewRes,
        txnRes,
        refundRes,
        reconRes,
        payoutRes,
        logRes,
        webhookRes
      ] = await Promise.all([
        listRestaurants(token),
        getVenuePaymentSettings(token, restaurantId),
        getVenuePaymentOverview(token, restaurantId),
        listVenuePaymentTransactions(token, restaurantId, 100),
        listVenuePaymentRefunds(token, restaurantId),
        getVenuePaymentReconciliation(token, restaurantId),
        listVenuePaymentPayouts(token, restaurantId),
        listVenuePaymentLogs(token, restaurantId),
        getVenuePaymentWebhookHealth(token, restaurantId)
      ]);

      if (mode === "initial") {
        setLoading(false);
        setReady(true);
      } else if (mode === "refresh") {
        setRefreshing(false);
      }

      const row = restaurantsRes.restaurants?.find((r) => r.id === restaurantId);
      if (row?.role) setRole(row.role);

      if (paymentRes.ok && paymentRes.settings) {
        setSettings(paymentRes.settings);
        setEnvReady(paymentRes.envReady ?? null);
      }
      if (overviewRes.ok && overviewRes.overview) setOverview(overviewRes.overview);
      if (txnRes.ok) {
        setTransactions(txnRes.transactions ?? []);
        setTxnSource(txnRes.source ?? "demo");
      }
      if (refundRes.ok) {
        setRefunds(refundRes.refunds ?? []);
        setRefundSource(refundRes.source ?? "demo");
      }
      if (reconRes.ok && reconRes.reconciliation) setReconciliation(reconRes.reconciliation);
      if (payoutRes.ok) {
        setPayouts(payoutRes.payouts ?? []);
        setPayoutSummary(payoutRes.summary ?? null);
      }
      if (logRes.ok) {
        setLogs(logRes.logs ?? []);
        setLogSource(logRes.source ?? "demo");
      }
      if (webhookRes.ok && webhookRes.health) setWebhookHealth(webhookRes.health);
      if (mode !== "soft") setActivityRefreshKey((k) => k + 1);
    },
    [token, restaurantId]
  );

  useEffect(() => {
    void loadPaymentsContext("initial");
  }, [loadPaymentsContext]);

  useEffect(() => {
    const applyHash = () => {
      const q = parseAdminHashQuery();
      const next = normalizePaymentsTab(q.get("tab"));
      if (next) setTab(next);
      setAdvancedOpen(q.get("view") === "advanced");
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    window.addEventListener(ADMIN_NAV_SYNC_EVENT, applyHash as EventListener);
    return () => {
      window.removeEventListener("hashchange", applyHash);
      window.removeEventListener(ADMIN_NAV_SYNC_EVENT, applyHash as EventListener);
    };
  }, []);

  const selectTab = (next: PaymentsSectionTab) => {
    setTab(next);
    setAdvancedOpen(false);
    setPaymentsTabHash(next, false);
  };

  const openAdvanced = () => {
    setAdvancedOpen(true);
    setPaymentsTabHash(tab, true);
  };

  const closeAdvanced = () => {
    setAdvancedOpen(false);
    setPaymentsTabHash(tab, false);
  };

  const patchLocal = (patch: Partial<VenuePaymentSettings>) => {
    setSettings((current) => {
      if (!current) return current;
      return {
        ...current,
        ...patch,
        methods: { ...current.methods, ...(patch.methods ?? {}) },
        methodConfig: { ...(current.methodConfig ?? {}), ...(patch.methodConfig ?? {}) },
        rules: { ...current.rules, ...(patch.rules ?? {}) },
        payAtVenue: current.payAtVenue
          ? {
              ...current.payAtVenue,
              ...(patch.payAtVenue ?? {}),
              channels: { ...current.payAtVenue.channels, ...(patch.payAtVenue?.channels ?? {}) },
              settlementMethods: {
                ...current.payAtVenue.settlementMethods,
                ...(patch.payAtVenue?.settlementMethods ?? {})
              }
            }
          : patch.payAtVenue,
        qrPolicy: current.qrPolicy ? { ...current.qrPolicy, ...(patch.qrPolicy ?? {}) } : patch.qrPolicy,
        splits: current.splits ? { ...current.splits, ...(patch.splits ?? {}) } : patch.splits,
        tips: current.tips ? { ...current.tips, ...(patch.tips ?? {}) } : patch.tips,
        failedPayment: current.failedPayment
          ? { ...current.failedPayment, ...(patch.failedPayment ?? {}) }
          : patch.failedPayment,
        refunds: { ...current.refunds, ...(patch.refunds ?? {}) },
        refundLimits: current.refundLimits
          ? { ...current.refundLimits, ...(patch.refundLimits ?? {}) }
          : patch.refundLimits,
        taxes: { ...current.taxes, ...(patch.taxes ?? {}) },
        bankAccount: { ...current.bankAccount, ...(patch.bankAccount ?? {}) }
      };
    });
  };

  const saveSettings = async (override?: Partial<VenuePaymentSettings>) => {
    if (!token || !restaurantId || !settings) return false;
    const body = override ?? {
      methods: settings.methods,
      methodConfig: settings.methodConfig,
      rules: settings.rules,
      payAtVenue: settings.payAtVenue,
      qrPolicy: settings.qrPolicy,
      splits: settings.splits,
      tips: settings.tips,
      failedPayment: settings.failedPayment,
      refunds: settings.refunds,
      refundLimits: settings.refundLimits,
      taxes: settings.taxes,
      taxDisplay: settings.taxDisplay,
      bankAccount: settings.bankAccount
    };
    setSaving(true);
    const res = await patchVenuePaymentSettings(token, restaurantId, body);
    setSaving(false);
    if (!res.ok || !res.settings) {
      pushToast(res.message ?? res.error ?? "Could not save payment settings", "error");
      return false;
    }
    setSettings(res.settings);
    pushToast("Payment settings saved.", "success");
    void loadPaymentsContext("soft");
    return true;
  };

  const handleConnect = async () => {
    if (!token || !restaurantId || !connectOpen) return;
    setSaving(true);
    const res = await connectVenuePaymentProvider(token, restaurantId, {
      provider: connectOpen,
      accountId: connectOpen === "stripe" ? connectId : undefined,
      merchantId: connectOpen === "swish" ? connectId : undefined
    });
    setSaving(false);
    if (!res.ok || !res.settings) {
      pushToast(res.message ?? res.error ?? "Connect failed", "error");
      return;
    }
    setSettings(res.settings);
    setEnvReady(res.envReady ?? envReady);
    setConnectOpen(null);
    setConnectId("");
    pushToast(
      `${connectOpen === "stripe" ? "Stripe" : "Swish"} connected${res.needsEnv ? " (sandbox — add env keys for live)" : ""}.`,
      "success"
    );
    void loadPaymentsContext("refresh");
  };

  const handleDisconnect = async (provider: "stripe" | "swish") => {
    if (!token || !restaurantId) return;
    const res = await disconnectVenuePaymentProvider(token, restaurantId, provider);
    if (!res.ok || !res.settings) {
      pushToast(res.message ?? res.error ?? "Disconnect failed", "error");
      return;
    }
    setSettings(res.settings);
    pushToast(`${provider === "stripe" ? "Stripe" : "Swish"} disconnected.`, "success");
    void loadPaymentsContext("refresh");
  };

  const openTransaction = async (row: PaymentTransactionRow) => {
    if (!token || !restaurantId) return;
    setTxnDrawerOpen(true);
    setSelectedTxn(null);
    const res = await getVenuePaymentTransaction(token, restaurantId, row.id);
    if (res.ok && res.transaction) setSelectedTxn(res.transaction);
    else setSelectedTxn({ ...row, timeline: [] });
  };

  const { recover, recovering } = usePageRecoverySync([() => loadPaymentsContext("refresh")]);
  useSilentRevalidate(() => loadPaymentsContext("soft"), {
    enabled: Boolean(token && restaurantId && ready),
    minIntervalMs: 30_000,
    intervalMs: 90_000
  });

  if (!token || !restaurantId) {
    return (
      <AdminPanel id="ws-config" className="admin-top-page admin-panel--edge admin-config-page admin-payments-page">
        <AdminSectionHeader
          eyebrowText="Configuration"
          title={paymentsTitle}
          description={CONFIG_PRESET_DESCRIPTIONS.payments}
        />
        <div className={`${subPanelCls} admin-config-section mt-8 p-6`}>
          <AdminEmptyState>Sign in and select a venue to manage payment settings.</AdminEmptyState>
        </div>
      </AdminPanel>
    );
  }

  if (advancedOpen && settings) {
    return (
      <AdminPanel
        id="ws-config"
        className="admin-top-page admin-panel--edge admin-config-page admin-payments-page admin-payments-page--advanced"
      >
        <AdminStaleContent refreshing={refreshing}>
          <AnimatePresence mode="wait">
            <motion.div
              key="advanced"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={TAB_TRANSITION}
            >
              <PaymentsAdvancedSettingsPage
                settings={settings}
                envReady={envReady}
                canEdit={canEdit}
                saving={saving}
                onBack={closeAdvanced}
                onPatch={patchLocal}
                onSave={() => {
                  void saveSettings();
                }}
              />
            </motion.div>
          </AnimatePresence>
        </AdminStaleContent>

        <ProfileModalShell
          open={Boolean(connectOpen)}
          onClose={() => setConnectOpen(null)}
          title={connectOpen === "stripe" ? "Connect Stripe" : "Connect Swish"}
          description="Paste a sandbox account / merchant ID. Live keys stay in server environment variables."
          titleId="payment-connect-modal"
        >
          <label className="grid gap-1">
            <AdminLabel>{connectOpen === "stripe" ? "Stripe account ID" : "Swish merchant ID"}</AdminLabel>
            <AdminInput
              value={connectId}
              onChange={(e) => setConnectId(e.target.value)}
              placeholder={connectOpen === "stripe" ? "acct_…" : "123xxxxxxx"}
            />
          </label>
          <ProfileModalFooter
            cancelLabel="Cancel"
            confirmLabel={saving ? "Connecting…" : "Connect"}
            confirmDisabled={saving}
            onCancel={() => setConnectOpen(null)}
            onConfirm={() => void handleConnect()}
          />
        </ProfileModalShell>
      </AdminPanel>
    );
  }

  return (
    <AdminPanel id="ws-config" className="admin-top-page admin-panel--edge admin-config-page admin-payments-page">
      <AdminSectionHeader
        eyebrowText="Configuration"
        title={paymentsTitle}
        description={CONFIG_PRESET_DESCRIPTIONS.payments}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {canEdit && (tab === "methods" || tab === "rules" || tab === "refunds" || tab === "payouts") ? (
              <AdminBtnPrimary type="button" disabled={saving || !settings} onClick={() => void saveSettings()}>
                {saving ? "Saving…" : "Save changes"}
              </AdminBtnPrimary>
            ) : null}
            <AdminRefreshButton
              onRefresh={() => void recover()}
              refreshing={recovering || refreshing}
              label="Sync payments"
            />
          </div>
        }
      />

      {!canEdit ? <p className="admin-payments-locked mt-3 text-sm">{lockReason}</p> : null}

      <div className="admin-payments-tabs-row mt-5">
        <div className="admin-page-tabs admin-payments-tabs" role="tablist" aria-label="Payments sections">
          {PAYMENTS_TABS.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={`admin-page-tab${tab === id ? " admin-page-tab--active" : ""}`}
              onClick={() => selectTab(id)}
            >
              {PAYMENTS_TAB_LABELS[id]}
            </button>
          ))}
        </div>
        <button type="button" className="admin-payments-advanced-btn" onClick={openAdvanced}>
          Advanced Settings
        </button>
      </div>

      <AdminStaleContent refreshing={refreshing}>
        {loading && !ready ? (
          <div className="mt-8 admin-config-text-muted text-sm">Loading payments workspace…</div>
        ) : !settings ? (
          <div className="mt-8">
            <AdminEmptyState>Could not load payment settings.</AdminEmptyState>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={TAB_TRANSITION}
              className="mt-6"
            >
              {tab === "overview" ? (
                <PaymentsOverviewTab
                  token={token}
                  restaurantId={restaurantId}
                  overview={overview}
                  refreshKey={activityRefreshKey}
                  onNavigateHealth={(target) => {
                    if (target === "overview") return;
                    selectTab(target);
                  }}
                />
              ) : null}
              {tab === "methods" ? (
                <PaymentsMethodsTab
                  settings={settings}
                  canEdit={canEdit}
                  onToggle={(key, enabled) => {
                    patchLocal({
                      methods: { ...settings.methods, [key]: enabled },
                      methodConfig: {
                        ...(settings.methodConfig ?? {}),
                        [key]: { ...getMethodConfig(settings, key), enabled }
                      }
                    });
                  }}
                  onConfigure={(key) => setMethodKey(key)}
                />
              ) : null}
              {tab === "rules" ? (
                <PaymentsRulesTab settings={settings} canEdit={canEdit} onPatch={patchLocal} />
              ) : null}
              {tab === "providers" ? (
                <PaymentsProvidersTab
                  settings={settings}
                  webhookHealth={webhookHealth}
                  envReady={envReady}
                  canEdit={canEdit}
                  onOpenProvider={setProviderDetail}
                  onConnect={(p) => {
                    setConnectOpen(p);
                    setConnectId("");
                  }}
                />
              ) : null}
              {tab === "refunds" ? (
                <PaymentsRefundsTab
                  refunds={refunds}
                  settings={settings}
                  canEdit={canEdit}
                  source={refundSource}
                  onOpen={setSelectedRefund}
                  onPatchSettings={patchLocal}
                />
              ) : null}
              {tab === "reconciliation" ? (
                <PaymentsReconciliationTab reconciliation={reconciliation} />
              ) : null}
              {tab === "payouts" ? (
                <PaymentsPayoutsTab
                  payouts={payouts}
                  summary={payoutSummary}
                  settings={settings}
                  canEdit={canEdit}
                  onLinkBank={() =>
                    patchLocal({
                      bankAccount: {
                        linked: true,
                        lastFour: "4821",
                        holderName: settings.bankAccount.holderName ?? ""
                      }
                    })
                  }
                  onPatchBank={(bankAccount) => patchLocal({ bankAccount })}
                />
              ) : null}
              {tab === "transactions" ? (
                <PaymentsTransactionsTab
                  transactions={transactions}
                  source={txnSource}
                  onOpen={(row) => void openTransaction(row)}
                />
              ) : null}
              {tab === "logs" ? <PaymentsLogsTab logs={logs} source={logSource} /> : null}
            </motion.div>
          </AnimatePresence>
        )}
      </AdminStaleContent>

      <PaymentMethodConfigModal
        open={Boolean(methodKey)}
        methodKey={methodKey}
        config={methodKey && settings ? getMethodConfig(settings, methodKey) : null}
        canEdit={canEdit}
        onClose={() => setMethodKey(null)}
        onSave={(key, config: PaymentMethodConfig) => {
          const nextMethods = { ...(settings?.methods ?? {}), [key]: config.enabled };
          const nextConfig = { ...(settings?.methodConfig ?? {}), [key]: config };
          patchLocal({ methods: nextMethods, methodConfig: nextConfig });
          setMethodKey(null);
          void saveSettings({ methods: nextMethods, methodConfig: nextConfig });
        }}
      />

      <PaymentProviderDetailModal
        open={Boolean(providerDetail)}
        provider={providerDetail}
        settings={settings}
        webhookHealth={webhookHealth}
        canEdit={canEdit}
        onClose={() => setProviderDetail(null)}
        onConnect={() => {
          if (providerDetail === "stripe" || providerDetail === "swish") {
            setConnectOpen(providerDetail);
            setProviderDetail(null);
          }
        }}
        onDisconnect={() => {
          if (providerDetail === "stripe" || providerDetail === "swish") {
            void handleDisconnect(providerDetail);
            setProviderDetail(null);
          }
        }}
      />

      <PaymentTransactionDrawer
        open={txnDrawerOpen}
        transaction={selectedTxn}
        onClose={() => {
          setTxnDrawerOpen(false);
          setSelectedTxn(null);
        }}
      />

      <RefundDetailModal
        open={Boolean(selectedRefund)}
        refund={selectedRefund}
        onClose={() => setSelectedRefund(null)}
      />

      <ProfileModalShell
        open={Boolean(connectOpen)}
        onClose={() => setConnectOpen(null)}
        title={connectOpen === "stripe" ? "Connect Stripe" : "Connect Swish"}
        description="Paste a sandbox account / merchant ID. Live keys stay in server environment variables."
        titleId="payment-connect-modal"
      >
        <label className="grid gap-1">
          <AdminLabel>{connectOpen === "stripe" ? "Stripe account ID" : "Swish merchant ID"}</AdminLabel>
          <AdminInput
            value={connectId}
            onChange={(e) => setConnectId(e.target.value)}
            placeholder={connectOpen === "stripe" ? "acct_…" : "123xxxxxxx"}
          />
        </label>
        <ProfileModalFooter
          cancelLabel="Cancel"
          confirmLabel={saving ? "Connecting…" : "Connect"}
          confirmDisabled={saving}
          onCancel={() => setConnectOpen(null)}
          onConfirm={() => void handleConnect()}
        />
      </ProfileModalShell>
    </AdminPanel>
  );
}
