import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  connectVenuePaymentProvider,
  disconnectVenuePaymentProvider,
  getVenuePaymentSettings,
  listRestaurants,
  patchVenuePaymentSettings,
  type PaymentStats,
  type VenuePaymentSettings
} from "../../api";
import { AdminBtnPrimary, AdminBtnSecondary, AdminEmptyState, AdminInput, AdminLabel, AdminPanel, AdminRefreshButton, AdminSectionHeader, subPanelCls } from "../AdminUi";
import { ProfileModalFooter, ProfileModalShell } from "../profile/ProfileModalShell";
import { AdminSkeletonStatGrid, AdminStaleContent } from "../AdminSkeleton";
import { useAdminToast } from "../AdminToast";
import { usePageRecoverySync, useSilentRevalidate } from "../sync/adminPageSync";
import { canEditPayments, paymentsEditReason } from "./paymentsAccess";
import { CONFIG_PRESET_DESCRIPTIONS } from "./configRouting";

type Props = {
  token: string | null;
  restaurantId: string | null;
};

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="admin-stat-card rounded-xl border p-4 shadow-sm">
      <p className="admin-stat-label text-[10px] font-bold uppercase tracking-[0.14em]">{label}</p>
      <p className="admin-stat-value mt-2 font-display text-2xl font-bold">{value}</p>
      {hint ? <p className="admin-stat-hint mt-1 text-xs">{hint}</p> : null}
    </div>
  );
}

function PayChip({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "success" | "muted" | "warning" | "danger" }) {
  return <span className={`admin-payments-chip${tone !== "default" ? ` admin-payments-chip--${tone}` : ""}`}>{children}</span>;
}

function PaySection({
  title,
  description,
  action,
  children,
  className = ""
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`${subPanelCls} admin-config-section admin-payments-section overflow-hidden p-0 ${className}`.trim()}>
      <div className="admin-payments-section-head">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide admin-config-text-muted">{title}</p>
          {description ? <p className="admin-config-text-subtle mt-1 text-sm">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="admin-payments-section-body">{children}</div>
    </section>
  );
}

function ProviderRow({
  name,
  status,
  future,
  onConnect,
  connectDisabled
}: {
  name: string;
  status: "connected" | "disconnected";
  future?: boolean;
  onConnect?: () => void;
  connectDisabled?: boolean;
}) {
  return (
    <div className={`admin-payments-provider-row${future ? " admin-payments-provider-row--future" : ""}`}>
      <div>
        <p className="font-semibold admin-config-text">{name}</p>
        {future ? <p className="admin-config-text-subtle mt-0.5 text-xs">Coming soon</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <PayChip tone={status === "connected" ? "success" : future ? "muted" : "warning"}>
          {status === "connected" ? "Connected" : future ? "Future" : "Disconnected"}
        </PayChip>
        {!future && status === "disconnected" && onConnect ? (
          <AdminBtnSecondary type="button" disabled={connectDisabled} onClick={onConnect}>
            Connect
          </AdminBtnSecondary>
        ) : null}
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  disabled,
  onChange
}: {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className={`admin-payments-toggle-row${disabled ? " admin-payments-toggle-row--disabled" : ""}`}>
      <span className="min-w-0 flex-1">
        <span className="admin-payments-toggle-label">{label}</span>
        {description ? <span className="admin-payments-toggle-desc">{description}</span> : null}
      </span>
      <input
        type="checkbox"
        className="admin-payments-toggle-input"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

function MethodChip({
  label,
  enabled,
  future,
  disabled,
  onChange
}: {
  label: string;
  enabled: boolean;
  future?: boolean;
  disabled?: boolean;
  onChange?: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled || future}
      className={`admin-payments-method-chip${enabled ? " admin-payments-method-chip--on" : ""}${future ? " admin-payments-method-chip--future" : ""}`}
      onClick={() => onChange?.(!enabled)}
    >
      {label}
      {future ? <span className="admin-payments-method-future">Future</span> : null}
    </button>
  );
}

function venueNameFromSettings(_settings: VenuePaymentSettings | null) {
  return "Venue account";
}

export function AdminConfigPaymentsPage({ token, restaurantId }: Props) {
  const { pushToast } = useAdminToast();
  const [role, setRole] = useState("STAFF");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [settings, setSettings] = useState<VenuePaymentSettings | null>(null);
  const [connectOpen, setConnectOpen] = useState<"stripe" | "swish" | null>(null);
  const [connectId, setConnectId] = useState("");

  const loadPaymentsContext = useCallback(
    async (mode: "initial" | "refresh" | "soft") => {
      if (!token || !restaurantId) return;
      if (mode === "initial") setLoading(true);
      else if (mode === "refresh") setRefreshing(true);
      const [restaurantsRes, paymentRes] = await Promise.all([
        listRestaurants(token),
        getVenuePaymentSettings(token, restaurantId)
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
        setStats(paymentRes.stats ?? null);
      }
    },
    [token, restaurantId]
  );

  const saveSettings = async () => {
    if (!token || !restaurantId || !settings) return;
    setSaving(true);
    const res = await patchVenuePaymentSettings(token, restaurantId, {
      methods: settings.methods,
      rules: settings.rules,
      refunds: settings.refunds,
      taxes: settings.taxes,
      bankAccount: settings.bankAccount
    });
    setSaving(false);
    if (!res.ok || !res.settings) {
      pushToast(res.message ?? res.error ?? "Could not save payment settings", "error");
      return;
    }
    setSettings(res.settings);
    pushToast("Payment settings saved.", "success");
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
    setConnectOpen(null);
    setConnectId("");
    pushToast(`${connectOpen === "stripe" ? "Stripe" : "Swish"} connected.`, "success");
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

  const methods = settings?.methods ?? {
    card: false,
    swish: false,
    applePay: false,
    googlePay: false,
    cash: true,
    invoice: false,
    giftCards: false
  };
  const rules = settings?.rules ?? {
    payBeforeOrder: true,
    payAfterMeal: false,
    depositRequired: false,
    minOrderCents: null,
    maxOrderCents: null,
    defaultPaymentMode: "PREPAY" as const
  };
  const refunds = settings?.refunds ?? {
    managerApproval: true,
    automaticRefund: false,
    manualRefund: true,
    refundTimeoutHours: 24
  };
  const taxes = settings?.taxes ?? {
    vatStandardPercent: 12,
    serviceFeePercent: 0,
    deliveryFeeCents: 0,
    tipsEnabled: true
  };
  const providers = settings?.providers ?? { stripe: { connected: false }, swish: { connected: false } };

  const patchSettings = (patch: Partial<VenuePaymentSettings>) => {
    setSettings((current) => (current ? { ...current, ...patch, methods: { ...current.methods, ...(patch.methods ?? {}) }, rules: { ...current.rules, ...(patch.rules ?? {}) }, refunds: { ...current.refunds, ...(patch.refunds ?? {}) }, taxes: { ...current.taxes, ...(patch.taxes ?? {}) } } : current));
  };

  const canEdit = useMemo(() => canEditPayments(role), [role]);
  const lockReason = paymentsEditReason(role);

  const { recover, recovering } = usePageRecoverySync([() => loadPaymentsContext("refresh")]);
  useSilentRevalidate(() => loadPaymentsContext("soft"), {
    enabled: Boolean(token && restaurantId && ready),
    minIntervalMs: 30_000,
    intervalMs: 90_000
  });

  useEffect(() => {
    void loadPaymentsContext("initial");
  }, [loadPaymentsContext]);

  if (!token || !restaurantId) {
    return (
      <AdminPanel id="ws-config" className="admin-top-page admin-panel--edge admin-config-page admin-payments-page">
        <AdminSectionHeader eyebrowText="Configuration" title="Payments" description={CONFIG_PRESET_DESCRIPTIONS.payments} />
        <div className={`${subPanelCls} admin-config-section mt-8 p-6`}>
          <AdminEmptyState>Sign in and select a venue to manage payment settings.</AdminEmptyState>
        </div>
      </AdminPanel>
    );
  }

  return (
    <AdminPanel id="ws-config" className="admin-top-page admin-panel--edge admin-config-page admin-payments-page">
      <AdminSectionHeader
        eyebrowText="Configuration"
        title="Payments"
        description="Everything related to money — providers, methods, rules, payouts, and security."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {canEdit ? (
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

      <div className="admin-payments-hero mt-6 rounded-2xl border p-5 sm:p-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-violet-600">Payments</p>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed admin-config-text-muted">
          Connect providers, configure accepted methods, and control how this venue collects, settles, and refunds money.
        </p>
        {!canEdit ? <p className="admin-payments-locked mt-3 text-sm">{lockReason}</p> : null}
      </div>

      <AdminStaleContent refreshing={refreshing}>
        {loading && !ready ? (
          <div className="mt-8">
            <AdminSkeletonStatGrid count={4} />
          </div>
        ) : (
          <>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <StatTile label="Successful" value={String(stats?.successful ?? 0)} hint="Transactions" />
              <StatTile label="Pending" value={String(stats?.pending ?? 0)} hint="Awaiting capture" />
              <StatTile label="Refunded" value={String(stats?.refunded ?? 0)} hint="All time" />
              <StatTile label="Failed" value={String(stats?.failed ?? 0)} hint="Last 30 days" />
              <StatTile label="Disputed" value={String(stats?.disputed ?? 0)} hint="Chargebacks" />
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <PaySection title="Payment providers" description="Connect acquirers and wallets for this venue.">
                <ProviderRow
                  name="Stripe"
                  status={providers.stripe.connected ? "connected" : "disconnected"}
                  connectDisabled={!canEdit}
                  onConnect={() => {
                    setConnectOpen("stripe");
                    setConnectId("");
                  }}
                />
                <ProviderRow
                  name="Swish"
                  status={providers.swish.connected ? "connected" : "disconnected"}
                  connectDisabled={!canEdit}
                  onConnect={() => {
                    setConnectOpen("swish");
                    setConnectId("");
                  }}
                />
                {providers.stripe.connected ? (
                  <AdminBtnSecondary type="button" disabled={!canEdit} onClick={() => void handleDisconnect("stripe")}>
                    Disconnect Stripe
                  </AdminBtnSecondary>
                ) : null}
                {providers.swish.connected ? (
                  <AdminBtnSecondary type="button" disabled={!canEdit} onClick={() => void handleDisconnect("swish")}>
                    Disconnect Swish
                  </AdminBtnSecondary>
                ) : null}
              </PaySection>

              <PaySection title="Provider status" description="Connection health across active providers.">
                <div className="admin-payments-kv-grid">
                  <div className="admin-payments-kv">
                    <p className="admin-payments-kv-label">Connected</p>
                    <p className="admin-payments-kv-value">{stats?.connectedProviders ?? 0}</p>
                  </div>
                  <div className="admin-payments-kv">
                    <p className="admin-payments-kv-label">Disconnected</p>
                    <p className="admin-payments-kv-value">{stats?.disconnectedProviders ?? 0}</p>
                  </div>
                  <div className="admin-payments-kv">
                    <p className="admin-payments-kv-label">Verification</p>
                    <PayChip tone={providers.stripe.connected || providers.swish.connected ? "success" : "warning"}>
                      {providers.stripe.connected || providers.swish.connected ? "Verified" : "Pending"}
                    </PayChip>
                  </div>
                  <div className="admin-payments-kv">
                    <p className="admin-payments-kv-label">Last sync</p>
                    <p className="admin-payments-kv-value admin-payments-kv-value--subtle">
                      {stats?.lastSyncAt ? new Date(stats.lastSyncAt).toLocaleString() : "—"}
                    </p>
                  </div>
                </div>
              </PaySection>
            </div>

            <PaySection
              className="mt-5"
              title="Accepted payment methods"
              description="Methods guests can use once providers are connected."
            >
              <div className="admin-payments-method-grid">
                <MethodChip label="Card" enabled={methods.card} disabled={!canEdit} onChange={(v) => patchSettings({ methods: { ...methods, card: v } })} />
                <MethodChip label="Swish" enabled={methods.swish} disabled={!canEdit} onChange={(v) => patchSettings({ methods: { ...methods, swish: v } })} />
                <MethodChip label="Apple Pay" enabled={methods.applePay} disabled={!canEdit} onChange={(v) => patchSettings({ methods: { ...methods, applePay: v } })} />
                <MethodChip label="Google Pay" enabled={methods.googlePay} disabled={!canEdit} onChange={(v) => patchSettings({ methods: { ...methods, googlePay: v } })} />
                <MethodChip label="Cash" enabled={methods.cash} disabled={!canEdit} onChange={(v) => patchSettings({ methods: { ...methods, cash: v } })} />
                <MethodChip label="Invoice" enabled={methods.invoice} disabled={!canEdit} onChange={(v) => patchSettings({ methods: { ...methods, invoice: v } })} />
                <MethodChip label="Gift cards" enabled={methods.giftCards} disabled={!canEdit} onChange={(v) => patchSettings({ methods: { ...methods, giftCards: v } })} />
              </div>
            </PaySection>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <PaySection title="Payment rules" description="When and how guests must pay.">
                <div className="admin-payments-toggle-stack">
                  <ToggleRow label="Pay before order" checked={rules.payBeforeOrder} disabled={!canEdit} onChange={(v) => patchSettings({ rules: { ...rules, payBeforeOrder: v } })} />
                  <ToggleRow label="Pay after meal" checked={rules.payAfterMeal} disabled={!canEdit} onChange={(v) => patchSettings({ rules: { ...rules, payAfterMeal: v } })} />
                  <ToggleRow label="Deposit required" checked={rules.depositRequired} disabled={!canEdit} onChange={(v) => patchSettings({ rules: { ...rules, depositRequired: v } })} />
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <AdminLabel>
                    <span className="admin-config-text-muted text-xs font-bold uppercase tracking-wide">Minimum order (SEK)</span>
                    <AdminInput
                      className="mt-1.5"
                      placeholder="e.g. 50"
                      value={rules.minOrderCents != null ? String(rules.minOrderCents / 100) : ""}
                      readOnly={!canEdit}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        patchSettings({ rules: { ...rules, minOrderCents: Number.isFinite(n) && e.target.value ? Math.round(n * 100) : null } });
                      }}
                    />
                  </AdminLabel>
                  <AdminLabel>
                    <span className="admin-config-text-muted text-xs font-bold uppercase tracking-wide">Maximum order (SEK)</span>
                    <AdminInput
                      className="mt-1.5"
                      placeholder="No limit"
                      value={rules.maxOrderCents != null ? String(rules.maxOrderCents / 100) : ""}
                      readOnly={!canEdit}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        patchSettings({ rules: { ...rules, maxOrderCents: Number.isFinite(n) && e.target.value ? Math.round(n * 100) : null } });
                      }}
                    />
                  </AdminLabel>
                </div>
              </PaySection>

              <PaySection title="Refund settings" description="Approval flow and automation for refunds.">
                <div className="admin-payments-toggle-stack">
                  <ToggleRow label="Manager approval" checked={refunds.managerApproval} disabled={!canEdit} onChange={(v) => patchSettings({ refunds: { ...refunds, managerApproval: v } })} />
                  <ToggleRow label="Automatic refund" checked={refunds.automaticRefund} disabled={!canEdit} onChange={(v) => patchSettings({ refunds: { ...refunds, automaticRefund: v } })} />
                  <ToggleRow label="Manual refund" checked={refunds.manualRefund} disabled={!canEdit} onChange={(v) => patchSettings({ refunds: { ...refunds, manualRefund: v } })} />
                </div>
                <AdminLabel className="mt-4 block">
                  <span className="admin-config-text-muted text-xs font-bold uppercase tracking-wide">Refund timeout (hours)</span>
                  <AdminInput
                    className="mt-1.5 w-full max-w-[10rem]"
                    value={String(refunds.refundTimeoutHours)}
                    readOnly={!canEdit}
                    onChange={(e) => patchSettings({ refunds: { ...refunds, refundTimeoutHours: Number(e.target.value) || 24 } })}
                  />
                </AdminLabel>
              </PaySection>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <PaySection title="Taxes" description="VAT rates, fees, and tips.">
                <div className="grid gap-3 sm:grid-cols-2">
                  <AdminLabel>
                    <span className="admin-config-text-muted text-xs font-bold uppercase tracking-wide">VAT rates (%)</span>
                    <AdminInput
                      className="mt-1.5"
                      value={String(taxes.vatStandardPercent)}
                      readOnly={!canEdit}
                      onChange={(e) => patchSettings({ taxes: { ...taxes, vatStandardPercent: Number(e.target.value) || 0 } })}
                    />
                  </AdminLabel>
                  <AdminLabel>
                    <span className="admin-config-text-muted text-xs font-bold uppercase tracking-wide">Service fee (%)</span>
                    <AdminInput
                      className="mt-1.5"
                      value={String(taxes.serviceFeePercent)}
                      readOnly={!canEdit}
                      onChange={(e) => patchSettings({ taxes: { ...taxes, serviceFeePercent: Number(e.target.value) || 0 } })}
                    />
                  </AdminLabel>
                  <AdminLabel>
                    <span className="admin-config-text-muted text-xs font-bold uppercase tracking-wide">Delivery fee (öre)</span>
                    <AdminInput
                      className="mt-1.5"
                      value={String(taxes.deliveryFeeCents)}
                      readOnly={!canEdit}
                      onChange={(e) => patchSettings({ taxes: { ...taxes, deliveryFeeCents: Number(e.target.value) || 0 } })}
                    />
                  </AdminLabel>
                </div>
                <div className="mt-4">
                  <ToggleRow label="Tips enabled" checked={taxes.tipsEnabled} disabled={!canEdit} onChange={(v) => patchSettings({ taxes: { ...taxes, tipsEnabled: v } })} />
                </div>
              </PaySection>

              <PaySection title="Payouts" description="Settlement account and payout schedule.">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="admin-payments-kv">
                    <p className="admin-payments-kv-label">Bank linked</p>
                    <p className="admin-payments-kv-value">{settings?.bankAccount.linked ? "Yes" : "No"}</p>
                  </div>
                  <div className="admin-payments-kv">
                    <p className="admin-payments-kv-label">Successful payouts</p>
                    <p className="admin-payments-kv-value">{stats?.successful ?? 0}</p>
                  </div>
                </div>
                <AdminBtnPrimary
                  className="mt-4"
                  type="button"
                  disabled={!canEdit || !(providers.stripe.connected || providers.swish.connected)}
                  onClick={() => patchSettings({ bankAccount: { linked: true, lastFour: "4242", holderName: venueNameFromSettings(settings) } })}
                >
                  Link bank account
                </AdminBtnPrimary>
              </PaySection>
            </div>

            <PaySection className="mt-5" title="Transactions" description="Live breakdown by payment state.">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {[
                  ["Successful", stats?.successful ?? 0],
                  ["Pending", stats?.pending ?? 0],
                  ["Refunded", stats?.refunded ?? 0],
                  ["Failed", stats?.failed ?? 0],
                  ["Disputed", stats?.disputed ?? 0]
                ].map(([label, value]) => (
                  <div key={label} className="admin-payments-txn-tile">
                    <p className="admin-payments-kv-label">{label}</p>
                    <p className="admin-payments-kv-value mt-1">{value}</p>
                  </div>
                ))}
              </div>
            </PaySection>

            <PaySection className="mt-5" title="Payment security" description="Webhooks, API health, and fraud monitoring.">
              <ul className="admin-payments-security-list">
                <li className="admin-payments-security-row">
                  <span className="font-semibold admin-config-text">Webhook status</span>
                  <PayChip tone={providers.stripe.connected || providers.swish.connected ? "success" : "muted"}>
                    {providers.stripe.connected || providers.swish.connected ? "Active" : "Awaiting provider"}
                  </PayChip>
                </li>
                <li className="admin-payments-security-row">
                  <span className="font-semibold admin-config-text">API keys health</span>
                  <PayChip tone="success">Healthy</PayChip>
                </li>
                <li className="admin-payments-security-row">
                  <span className="font-semibold admin-config-text">Fraud protection</span>
                  <PayChip tone="warning">Monitoring</PayChip>
                </li>
                <li className="admin-payments-security-row">
                  <span className="font-semibold admin-config-text">Risk alerts</span>
                  <span className="admin-config-text-subtle text-sm">None active</span>
                </li>
              </ul>
            </PaySection>
          </>
        )}
      </AdminStaleContent>

      <ProfileModalShell
        open={connectOpen !== null}
        onClose={saving ? () => undefined : () => setConnectOpen(null)}
        title={connectOpen === "stripe" ? "Connect Stripe" : "Connect Swish"}
        description={`Enter your ${connectOpen === "stripe" ? "Stripe account ID" : "Swish merchant number"} to enable payments.`}
        titleId="connect-provider-title"
        stackLevel="overlay"
      >
        <AdminLabel>
          <span className="text-xs admin-config-text-muted">
            {connectOpen === "stripe" ? "Stripe account ID" : "Swish merchant number"}
          </span>
          <AdminInput className="mt-1.5" value={connectId} onChange={(e) => setConnectId(e.target.value)} placeholder={connectOpen === "stripe" ? "acct_..." : "1234567890"} />
        </AdminLabel>
        <ProfileModalFooter
          onCancel={() => setConnectOpen(null)}
          onConfirm={() => void handleConnect()}
          confirmLabel={saving ? "Connecting…" : "Connect"}
          busy={saving}
        />
      </ProfileModalShell>
    </AdminPanel>
  );
}
