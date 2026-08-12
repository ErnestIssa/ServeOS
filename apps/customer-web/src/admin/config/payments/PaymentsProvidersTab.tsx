import type { PaymentProviderEnvReady, PaymentWebhookHealth, VenuePaymentSettings } from "../../../api";
import { AdminBtnSecondary } from "../../AdminUi";
import { ConfigSectionSpinner } from "../configLoadingUi";
import { PayChip, PaySection } from "./paymentsShared";
import { formatWhen, maskAccountId } from "./paymentsUiHelpers";

type Props = {
  settings: VenuePaymentSettings;
  webhookHealth: PaymentWebhookHealth | null;
  envReady: PaymentProviderEnvReady | null;
  canEdit: boolean;
  onOpenProvider: (p: "stripe" | "swish" | "terminals") => void;
  onConnect: (p: "stripe" | "swish") => void;
};

export function PaymentsProvidersTab({
  settings,
  webhookHealth,
  envReady,
  canEdit,
  onOpenProvider,
  onConnect
}: Props) {
  const stripe = settings.providers.stripe;
  const swish = settings.providers.swish;

  return (
    <div className="admin-payments-tab-stack">
      <PaySection title="Payment providers" description="Connect venue acquirers. Secret keys stay in environment variables.">
        <div className="admin-payments-provider-list">
          <div className="admin-payments-provider-row is-clickable">
            <button type="button" className="admin-payments-provider-main" onClick={() => onOpenProvider("stripe")}>
              <p className="font-semibold admin-config-text">Stripe</p>
              <p className="admin-config-text-subtle text-xs mt-0.5">
                {stripe.connected ? maskAccountId(stripe.accountId) : "Card, Apple Pay, Google Pay"}
              </p>
            </button>
            <div className="flex items-center gap-2">
              <PayChip tone={stripe.connected ? "success" : "warning"}>
                {stripe.connected ? "Connected" : "Not connected"}
              </PayChip>
              {!stripe.connected && canEdit ? (
                <AdminBtnSecondary type="button" onClick={() => onConnect("stripe")}>
                  Connect
                </AdminBtnSecondary>
              ) : null}
            </div>
          </div>

          <div className="admin-payments-provider-row is-clickable">
            <button type="button" className="admin-payments-provider-main" onClick={() => onOpenProvider("swish")}>
              <p className="font-semibold admin-config-text">Swish</p>
              <p className="admin-config-text-subtle text-xs mt-0.5">
                {swish.connected ? maskAccountId(swish.merchantId) : "Swedish mobile payments"}
              </p>
            </button>
            <div className="flex items-center gap-2">
              <PayChip tone={swish.connected ? "success" : "warning"}>
                {swish.connected ? "Connected" : "Not connected"}
              </PayChip>
              {!swish.connected && canEdit ? (
                <AdminBtnSecondary type="button" onClick={() => onConnect("swish")}>
                  Connect
                </AdminBtnSecondary>
              ) : null}
            </div>
          </div>

          <div className="admin-payments-provider-row is-clickable">
            <button type="button" className="admin-payments-provider-main" onClick={() => onOpenProvider("terminals")}>
              <p className="font-semibold admin-config-text">Card terminals</p>
              <p className="admin-config-text-subtle text-xs mt-0.5">In-venue card present payments</p>
            </button>
            <PayChip tone={settings.methods.cardTerminal ? "success" : "muted"}>
              {settings.methods.cardTerminal ? "2 connected" : "Not connected"}
            </PayChip>
          </div>
        </div>
        {envReady ? (
          <p className="admin-config-text-subtle text-xs mt-3">
            Env readiness · Stripe {envReady.stripe ? "ready" : "pending keys"} · Swish{" "}
            {envReady.swish ? "ready" : "pending keys"} · Webhooks {envReady.webhook ? "ready" : "pending secret"}
          </p>
        ) : null}
      </PaySection>

      <PaySection title="Webhook health" description="Provider events are authoritative — never trust the browser for payment success.">
        {webhookHealth ? (
          <div className="grid gap-3">
            <div className="admin-payments-money-grid admin-payments-money-grid--compact">
              <div className="admin-payments-money-tile">
                <p className="admin-payments-money-tile-label">Status</p>
                <p className="admin-payments-money-tile-value capitalize">{webhookHealth.status}</p>
              </div>
              <div className="admin-payments-money-tile">
                <p className="admin-payments-money-tile-label">Last event</p>
                <p className="admin-payments-money-tile-value text-base">{formatWhen(webhookHealth.lastEventAt)}</p>
              </div>
              <div className="admin-payments-money-tile">
                <p className="admin-payments-money-tile-label">Events today</p>
                <p className="admin-payments-money-tile-value">{webhookHealth.eventsToday.toLocaleString()}</p>
              </div>
              <div className="admin-payments-money-tile">
                <p className="admin-payments-money-tile-label">Failed</p>
                <p className="admin-payments-money-tile-value">{webhookHealth.failed}</p>
              </div>
              <div className="admin-payments-money-tile">
                <p className="admin-payments-money-tile-label">Retrying</p>
                <p className="admin-payments-money-tile-value">{webhookHealth.retrying}</p>
              </div>
            </div>
            <ul className="admin-payments-event-list">
              {webhookHealth.recentEvents.map((ev) => (
                <li key={ev.id}>
                  <code>{ev.type}</code>
                  <span>{formatWhen(ev.at)}</span>
                  <PayChip tone={ev.ok ? "success" : "danger"}>{ev.ok ? "OK" : "Failed"}</PayChip>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <ConfigSectionSpinner label="Loading webhook health" />
        )}
      </PaySection>
    </div>
  );
}
