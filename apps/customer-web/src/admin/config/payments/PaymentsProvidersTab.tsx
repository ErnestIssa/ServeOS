import { useState } from "react";
import type {
  PaymentProviderEnvReady,
  PaymentWebhookHealth,
  VenuePaymentPlatformSnapshot,
  VenuePaymentSettings
} from "../../../api";
import { AdminBtnPrimary, AdminBtnSecondary } from "../../AdminUi";
import { ConfigSectionSpinner } from "../configLoadingUi";
import { PayChip, PaySection } from "./paymentsShared";
import { formatWhen, maskAccountId } from "./paymentsUiHelpers";

type Props = {
  settings: VenuePaymentSettings;
  paymentPlatform: VenuePaymentPlatformSnapshot | null;
  webhookHealth: PaymentWebhookHealth | null;
  envReady: PaymentProviderEnvReady | null;
  canEdit: boolean;
  connectingManaged?: boolean;
  onOpenProvider: (p: "stripe" | "swish" | "terminals") => void;
  onConnectPayments: () => void;
  onContinueOnboarding: () => void;
  onSyncAccount: () => void;
  onConnectAdvanced: (p: "stripe" | "swish") => void;
  onChooseMethods: () => void;
};

function accountStateLabel(state: string | undefined): string {
  if (!state) return "Not connected";
  const map: Record<string, string> = {
    NOT_STARTED: "Not connected",
    IN_PROGRESS: "In progress",
    ACTION_REQUIRED: "Action needed",
    UNDER_REVIEW: "Under review",
    CONNECTED: "Connected",
    ACTIVE: "Active",
    RESTRICTED: "Restricted",
    REJECTED: "Rejected",
    DISABLED: "Disabled"
  };
  return map[state] ?? state.replace(/_/g, " ").toLowerCase();
}

function accountStateTone(state: string | undefined): "success" | "warning" | "danger" | "muted" {
  if (state === "ACTIVE" || state === "CONNECTED") return "success";
  if (state === "ACTION_REQUIRED" || state === "IN_PROGRESS" || state === "UNDER_REVIEW") return "warning";
  if (state === "RESTRICTED" || state === "REJECTED" || state === "DISABLED") return "danger";
  return "muted";
}

export function PaymentsProvidersTab({
  settings,
  paymentPlatform,
  webhookHealth,
  envReady,
  canEdit,
  connectingManaged = false,
  onOpenProvider,
  onConnectPayments,
  onContinueOnboarding,
  onSyncAccount,
  onConnectAdvanced,
  onChooseMethods
}: Props) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const account = paymentPlatform?.primaryAccount ?? null;
  const next = paymentPlatform?.nextAction;
  const stripe = settings.providers.stripe;
  const swish = settings.providers.swish;
  const terminalsConnected = Boolean(
    settings.providerConnections?.terminals?.connected ||
      (settings.providers.stripe.connected && settings.methods.cardTerminal)
  );

  const activeCaps = (account?.capabilities ?? []).filter(
    (c) => c.normalizedStatus === "active" || c.providerStatus === "active"
  );
  const isReady =
    account?.onboardingState === "ACTIVE" ||
    account?.onboardingState === "CONNECTED" ||
    Boolean(account?.chargesEnabled);

  return (
    <div className="admin-payments-tab-stack">
      <PaySection
        title="Payments for this venue"
        description="Customer payments go to this venue’s bank account. Connect once, then choose which methods guests can use."
      >
        <div className="admin-payments-managed-card">
          <div className="admin-payments-managed-card-head">
            <div>
              <p className="font-semibold admin-config-text">Connect payments</p>
              <p className="admin-config-text-subtle text-xs mt-0.5">
                Recommended · Cards, Apple Pay, Google Pay, and more as your account allows
              </p>
            </div>
            <PayChip tone={accountStateTone(account?.onboardingState)}>
              {accountStateLabel(account?.onboardingState)}
            </PayChip>
          </div>

          {!account ? (
            <p className="admin-config-text-subtle text-sm mt-3">
              You will verify your business with the payment provider. ServeOS does not hold guest funds.
            </p>
          ) : (
            <div className="admin-payments-kv-grid mt-3">
              <div className="admin-payments-kv">
                <span>Account</span>
                <strong>{maskAccountId(account.providerAccountId) || account.displayName || "—"}</strong>
              </div>
              <div className="admin-payments-kv">
                <span>Charges</span>
                <strong>{account.chargesEnabled ? "Ready" : "Not ready"}</strong>
              </div>
              <div className="admin-payments-kv">
                <span>Payouts</span>
                <strong>{account.payoutsEnabled ? "Ready" : "Not ready"}</strong>
              </div>
            </div>
          )}

          {next?.reason ? <p className="admin-config-text-subtle text-sm mt-3">{next.reason}</p> : null}

          {activeCaps.length ? (
            <div className="admin-payments-capability-chips mt-3">
              {activeCaps.map((cap) => (
                <PayChip key={cap.id} tone="success">
                  {cap.label}
                </PayChip>
              ))}
            </div>
          ) : null}

          {canEdit ? (
            <div className="flex flex-wrap gap-2 mt-4">
              {next?.type === "CONNECT_PAYMENTS" || !account ? (
                <AdminBtnPrimary type="button" disabled={connectingManaged} onClick={onConnectPayments}>
                  {connectingManaged ? "Starting…" : "Connect payments"}
                </AdminBtnPrimary>
              ) : null}
              {next?.type === "CONTINUE_ONBOARDING" || next?.type === "REFRESH_ACCOUNT" ? (
                <>
                  <AdminBtnPrimary type="button" disabled={connectingManaged} onClick={onContinueOnboarding}>
                    {next.label || "Continue setup"}
                  </AdminBtnPrimary>
                  <AdminBtnSecondary type="button" disabled={connectingManaged} onClick={onSyncAccount}>
                    Refresh status
                  </AdminBtnSecondary>
                </>
              ) : null}
              {next?.type === "ENABLE_METHODS" || (isReady && next?.type === "NONE") ? (
                <>
                  <AdminBtnPrimary type="button" onClick={onChooseMethods}>
                    Choose payment methods
                  </AdminBtnPrimary>
                  <AdminBtnSecondary type="button" disabled={connectingManaged} onClick={onSyncAccount}>
                    Refresh status
                  </AdminBtnSecondary>
                </>
              ) : null}
              {account && next?.type === "NONE" && !isReady ? (
                <AdminBtnSecondary type="button" disabled={connectingManaged} onClick={onSyncAccount}>
                  Refresh status
                </AdminBtnSecondary>
              ) : null}
            </div>
          ) : null}
        </div>
      </PaySection>

      <PaySection title="Payment events" description="Recent provider updates for this venue.">
        {webhookHealth ? (
          <div className="admin-payments-webhook-compact">
            <div className="admin-payments-webhook-compact-row">
              <span>
                Status · <strong className="capitalize">{webhookHealth.status}</strong>
              </span>
              <span>Last · {formatWhen(webhookHealth.lastEventAt)}</span>
              <span>Today · {webhookHealth.eventsToday.toLocaleString()}</span>
              {webhookHealth.failed > 0 ? (
                <PayChip tone="danger">{webhookHealth.failed} failed</PayChip>
              ) : (
                <PayChip tone="success">Healthy</PayChip>
              )}
            </div>
            {(webhookHealth.recentEvents?.length ?? 0) > 0 ? (
              <ul className="admin-payments-event-list admin-payments-event-list--compact">
                {webhookHealth.recentEvents.slice(0, 3).map((ev) => (
                  <li key={ev.id}>
                    <code>{ev.type}</code>
                    <span>{formatWhen(ev.at)}</span>
                    <PayChip tone={ev.ok ? "success" : "danger"}>{ev.ok ? "OK" : "Failed"}</PayChip>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="admin-config-text-subtle text-sm mt-2">No events yet.</p>
            )}
          </div>
        ) : (
          <ConfigSectionSpinner label="Loading payment events" />
        )}
      </PaySection>

      <details
        className="admin-payments-advanced-disclosure"
        open={advancedOpen}
        onToggle={(e) => setAdvancedOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary className="admin-payments-advanced-summary">
          Advanced options
          <span>Direct credentials · only if you already have your own provider account</span>
        </summary>
        <div className="admin-payments-advanced-body">
          <p className="admin-config-text-subtle text-sm mb-3">
            Prefer Connect payments above. Use this only to paste your own Stripe or Swish credentials.
          </p>
          <div className="admin-payments-provider-list">
            <div className="admin-payments-provider-row is-clickable">
              <button
                type="button"
                className="admin-payments-provider-main"
                onClick={() => onOpenProvider("stripe")}
              >
                <p className="font-semibold admin-config-text">Own Stripe account</p>
                <p className="admin-config-text-subtle text-xs mt-0.5">
                  {stripe.connected
                    ? `${maskAccountId(stripe.accountId)} · Connected`
                    : "Paste account ID and API key"}
                </p>
              </button>
              <div className="flex items-center gap-2">
                <PayChip tone={stripe.connected ? "success" : "muted"}>
                  {stripe.connected ? "Connected" : "Optional"}
                </PayChip>
                {!stripe.connected && canEdit ? (
                  <AdminBtnSecondary type="button" onClick={() => onConnectAdvanced("stripe")}>
                    Connect
                  </AdminBtnSecondary>
                ) : null}
              </div>
            </div>

            <div className="admin-payments-provider-row is-clickable">
              <button
                type="button"
                className="admin-payments-provider-main"
                onClick={() => onOpenProvider("swish")}
              >
                <p className="font-semibold admin-config-text">Own Swish agreement</p>
                <p className="admin-config-text-subtle text-xs mt-0.5">
                  {swish.connected
                    ? `${maskAccountId(swish.merchantId)} · Connected`
                    : "Merchant ID and certificate"}
                </p>
              </button>
              <div className="flex items-center gap-2">
                <PayChip tone={swish.connected ? "success" : "muted"}>
                  {swish.connected ? "Connected" : "Optional"}
                </PayChip>
                {!swish.connected && canEdit ? (
                  <AdminBtnSecondary type="button" onClick={() => onConnectAdvanced("swish")}>
                    Connect
                  </AdminBtnSecondary>
                ) : null}
              </div>
            </div>

            <div className="admin-payments-provider-row is-clickable">
              <button
                type="button"
                className="admin-payments-provider-main"
                onClick={() => onOpenProvider("terminals")}
              >
                <p className="font-semibold admin-config-text">Card terminals</p>
                <p className="admin-config-text-subtle text-xs mt-0.5">
                  {terminalsConnected
                    ? "Linked"
                    : "Available after card payments are active"}
                </p>
              </button>
              <PayChip tone={terminalsConnected ? "success" : "muted"}>
                {terminalsConnected ? "Connected" : "Not connected"}
              </PayChip>
            </div>
          </div>
          {envReady && !envReady.stripe ? (
            <p className="admin-config-text-subtle text-xs mt-3">
              Platform Stripe key is not configured — Connect may run in sandbox until it is.
            </p>
          ) : null}
        </div>
      </details>
    </div>
  );
}
