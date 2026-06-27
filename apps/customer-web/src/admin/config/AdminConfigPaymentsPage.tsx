import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { listRestaurants } from "../../api";
import {
  AdminBtnPrimary,
  AdminBtnSecondary,
  AdminEmptyState,
  AdminInput,
  AdminLabel,
  AdminPanel,
  AdminRefreshButton,
  AdminSectionHeader,
  subPanelCls
} from "../AdminUi";
import { AdminSkeletonStatGrid, AdminStaleContent } from "../AdminSkeleton";
import { useAdminToast } from "../AdminToast";
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

export function AdminConfigPaymentsPage({ token, restaurantId }: Props) {
  const { pushToast } = useAdminToast();
  const [role, setRole] = useState("STAFF");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadPaymentsContext = useCallback(
    async (mode: "initial" | "refresh") => {
      if (!token || !restaurantId) return;
      if (mode === "initial") setLoading(true);
      else setRefreshing(true);
      const res = await listRestaurants(token);
      if (mode === "initial") {
        setLoading(false);
        setReady(true);
      } else {
        setRefreshing(false);
      }
      const row = res.restaurants?.find((r) => r.id === restaurantId);
      if (row?.role) setRole(row.role);
    },
    [token, restaurantId]
  );

  const [methods, setMethods] = useState({
    card: false,
    swish: false,
    applePay: false,
    googlePay: false,
    cash: true,
    invoice: false,
    giftCards: false
  });
  const [rules, setRules] = useState({
    payBeforeOrder: true,
    payAfterMeal: false,
    depositRequired: false,
    minOrder: "",
    maxOrder: ""
  });
  const [refunds, setRefunds] = useState({
    managerApproval: true,
    automaticRefund: false,
    manualRefund: true,
    refundTimeoutHours: "24"
  });
  const [taxes, setTaxes] = useState({
    vatStandard: "12",
    serviceFee: "0",
    deliveryFee: "0",
    tipsEnabled: true
  });

  const canEdit = useMemo(() => canEditPayments(role), [role]);
  const lockReason = paymentsEditReason(role);

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
          <AdminRefreshButton
            onRefresh={() => loadPaymentsContext("refresh")}
            refreshing={refreshing}
            label="Refresh payments"
          />
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
              <StatTile label="Successful" value="0" hint="Transactions" />
              <StatTile label="Pending" value="0" hint="Awaiting capture" />
              <StatTile label="Refunded" value="0" hint="All time" />
              <StatTile label="Failed" value="0" hint="Last 30 days" />
              <StatTile label="Disputed" value="0" hint="Chargebacks" />
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <PaySection title="Payment providers" description="Connect acquirers and wallets for this venue.">
                <ProviderRow
                  name="Stripe"
                  status="disconnected"
                  connectDisabled={!canEdit}
                  onConnect={() => pushToast("Stripe Connect onboarding will open here.", "success")}
                />
                <ProviderRow
                  name="Swish"
                  status="disconnected"
                  connectDisabled={!canEdit}
                  onConnect={() => pushToast("Swish merchant linking will open here.", "success")}
                />
                <ProviderRow name="Adyen" status="disconnected" future />
                <ProviderRow name="Klarna" status="disconnected" future />
                <ProviderRow name="SumUp" status="disconnected" future />
              </PaySection>

              <PaySection title="Provider status" description="Connection health across active providers.">
                <div className="admin-payments-kv-grid">
                  <div className="admin-payments-kv">
                    <p className="admin-payments-kv-label">Connected</p>
                    <p className="admin-payments-kv-value">0</p>
                  </div>
                  <div className="admin-payments-kv">
                    <p className="admin-payments-kv-label">Disconnected</p>
                    <p className="admin-payments-kv-value">2</p>
                  </div>
                  <div className="admin-payments-kv">
                    <p className="admin-payments-kv-label">Verification</p>
                    <PayChip tone="warning">Pending</PayChip>
                  </div>
                  <div className="admin-payments-kv">
                    <p className="admin-payments-kv-label">Last sync</p>
                    <p className="admin-payments-kv-value admin-payments-kv-value--subtle">—</p>
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
                <MethodChip label="Card" enabled={methods.card} disabled={!canEdit} onChange={(v) => setMethods((m) => ({ ...m, card: v }))} />
                <MethodChip label="Swish" enabled={methods.swish} disabled={!canEdit} onChange={(v) => setMethods((m) => ({ ...m, swish: v }))} />
                <MethodChip label="Apple Pay" enabled={methods.applePay} disabled={!canEdit} onChange={(v) => setMethods((m) => ({ ...m, applePay: v }))} />
                <MethodChip label="Google Pay" enabled={methods.googlePay} disabled={!canEdit} onChange={(v) => setMethods((m) => ({ ...m, googlePay: v }))} />
                <MethodChip label="Cash" enabled={methods.cash} disabled={!canEdit} onChange={(v) => setMethods((m) => ({ ...m, cash: v }))} />
                <MethodChip label="Invoice" enabled={methods.invoice} future disabled={!canEdit} />
                <MethodChip label="Gift cards" enabled={methods.giftCards} future disabled={!canEdit} />
              </div>
            </PaySection>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <PaySection title="Payment rules" description="When and how guests must pay.">
                <div className="admin-payments-toggle-stack">
                  <ToggleRow label="Pay before order" checked={rules.payBeforeOrder} disabled={!canEdit} onChange={(v) => setRules((r) => ({ ...r, payBeforeOrder: v }))} />
                  <ToggleRow label="Pay after meal" checked={rules.payAfterMeal} disabled={!canEdit} onChange={(v) => setRules((r) => ({ ...r, payAfterMeal: v }))} />
                  <ToggleRow label="Deposit required" checked={rules.depositRequired} disabled={!canEdit} onChange={(v) => setRules((r) => ({ ...r, depositRequired: v }))} />
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <AdminLabel>
                    <span className="admin-config-text-muted text-xs font-bold uppercase tracking-wide">Minimum order</span>
                    <AdminInput className="mt-1.5" placeholder="e.g. 50" value={rules.minOrder} readOnly={!canEdit} onChange={(e) => setRules((r) => ({ ...r, minOrder: e.target.value }))} />
                  </AdminLabel>
                  <AdminLabel>
                    <span className="admin-config-text-muted text-xs font-bold uppercase tracking-wide">Maximum order</span>
                    <AdminInput className="mt-1.5" placeholder="No limit" value={rules.maxOrder} readOnly={!canEdit} onChange={(e) => setRules((r) => ({ ...r, maxOrder: e.target.value }))} />
                  </AdminLabel>
                </div>
              </PaySection>

              <PaySection title="Refund settings" description="Approval flow and automation for refunds.">
                <div className="admin-payments-toggle-stack">
                  <ToggleRow label="Manager approval" checked={refunds.managerApproval} disabled={!canEdit} onChange={(v) => setRefunds((r) => ({ ...r, managerApproval: v }))} />
                  <ToggleRow label="Automatic refund" checked={refunds.automaticRefund} disabled={!canEdit} onChange={(v) => setRefunds((r) => ({ ...r, automaticRefund: v }))} />
                  <ToggleRow label="Manual refund" checked={refunds.manualRefund} disabled={!canEdit} onChange={(v) => setRefunds((r) => ({ ...r, manualRefund: v }))} />
                </div>
                <AdminLabel className="mt-4 block">
                  <span className="admin-config-text-muted text-xs font-bold uppercase tracking-wide">Refund timeout (hours)</span>
                  <AdminInput className="mt-1.5 w-full max-w-[10rem]" value={refunds.refundTimeoutHours} readOnly={!canEdit} onChange={(e) => setRefunds((r) => ({ ...r, refundTimeoutHours: e.target.value }))} />
                </AdminLabel>
              </PaySection>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <PaySection title="Taxes" description="VAT rates, fees, and tips.">
                <div className="grid gap-3 sm:grid-cols-2">
                  <AdminLabel>
                    <span className="admin-config-text-muted text-xs font-bold uppercase tracking-wide">VAT rates (%)</span>
                    <AdminInput className="mt-1.5" value={taxes.vatStandard} readOnly={!canEdit} onChange={(e) => setTaxes((t) => ({ ...t, vatStandard: e.target.value }))} />
                  </AdminLabel>
                  <AdminLabel>
                    <span className="admin-config-text-muted text-xs font-bold uppercase tracking-wide">Tax classes</span>
                    <AdminInput className="mt-1.5" placeholder="Standard, reduced…" readOnly={!canEdit} />
                  </AdminLabel>
                  <AdminLabel>
                    <span className="admin-config-text-muted text-xs font-bold uppercase tracking-wide">Service fee</span>
                    <AdminInput className="mt-1.5" value={taxes.serviceFee} readOnly={!canEdit} onChange={(e) => setTaxes((t) => ({ ...t, serviceFee: e.target.value }))} />
                  </AdminLabel>
                  <AdminLabel>
                    <span className="admin-config-text-muted text-xs font-bold uppercase tracking-wide">Delivery fee</span>
                    <AdminInput className="mt-1.5" value={taxes.deliveryFee} readOnly={!canEdit} onChange={(e) => setTaxes((t) => ({ ...t, deliveryFee: e.target.value }))} />
                  </AdminLabel>
                </div>
                <div className="mt-4">
                  <ToggleRow label="Tips enabled" checked={taxes.tipsEnabled} disabled={!canEdit} onChange={(v) => setTaxes((t) => ({ ...t, tipsEnabled: v }))} />
                </div>
              </PaySection>

              <PaySection title="Payouts" description="Settlement account and payout schedule.">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="admin-payments-kv">
                    <p className="admin-payments-kv-label">Next payout</p>
                    <p className="admin-payments-kv-value admin-payments-kv-value--subtle">—</p>
                  </div>
                  <div className="admin-payments-kv">
                    <p className="admin-payments-kv-label">Previous payouts</p>
                    <p className="admin-payments-kv-value">0</p>
                  </div>
                </div>
                <div className="mt-4">
                  <AdminEmptyState>Connect Stripe or Swish to view bank account and settlement history.</AdminEmptyState>
                </div>
                <AdminBtnPrimary className="mt-4" type="button" disabled={!canEdit}>
                  Link bank account
                </AdminBtnPrimary>
              </PaySection>
            </div>

            <PaySection className="mt-5" title="Transactions" description="Live breakdown by payment state.">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {(["Successful", "Pending", "Refunded", "Failed", "Disputed"] as const).map((label) => (
                  <div key={label} className="admin-payments-txn-tile">
                    <p className="admin-payments-kv-label">{label}</p>
                    <p className="admin-payments-kv-value mt-1">0</p>
                  </div>
                ))}
              </div>
              <p className="admin-config-text-subtle mt-4 text-sm">Transaction history will populate when payment providers are connected.</p>
            </PaySection>

            <PaySection className="mt-5" title="Payment security" description="Webhooks, API health, and fraud monitoring.">
              <ul className="admin-payments-security-list">
                <li className="admin-payments-security-row">
                  <span className="font-semibold admin-config-text">Webhook status</span>
                  <PayChip tone="muted">Not configured</PayChip>
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
    </AdminPanel>
  );
}
