import type { PaymentWebhookHealth, VenuePaymentSettings } from "../../../api";
import { AdminBtnSecondary } from "../../AdminUi";
import { MenuPageModalShell, ProfileModalFooter } from "../menu/menuPageModalShell";
import { PayChip } from "./paymentsShared";
import { formatWhen, maskAccountId } from "./paymentsUiHelpers";

type Props = {
  open: boolean;
  provider: "stripe" | "swish" | "terminals" | null;
  settings: VenuePaymentSettings | null;
  webhookHealth: PaymentWebhookHealth | null;
  canEdit: boolean;
  onClose: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
};

export function PaymentProviderDetailModal({
  open,
  provider,
  settings,
  webhookHealth,
  canEdit,
  onClose,
  onConnect,
  onDisconnect
}: Props) {
  const stripe = settings?.providers.stripe;
  const swish = settings?.providers.swish;

  const title =
    provider === "stripe" ? "Stripe" : provider === "swish" ? "Swish" : provider === "terminals" ? "Card terminals" : "Provider";

  const connected =
    provider === "stripe"
      ? Boolean(stripe?.connected)
      : provider === "swish"
        ? Boolean(swish?.connected)
        : Boolean(settings?.methods.cardTerminal);

  const account =
    provider === "stripe"
      ? maskAccountId(stripe?.accountId)
      : provider === "swish"
        ? maskAccountId(swish?.merchantId)
        : settings?.methods.cardTerminal
          ? "2 terminals"
          : "—";

  return (
    <MenuPageModalShell
      open={open}
      onClose={onClose}
      title={title}
      description="Connection details — secret keys are never shown."
      titleId="payment-provider-detail"
      maxWidthClass="max-w-lg"
    >
      <div className="grid gap-3">
        <div className="admin-payments-kv">
          <span>Connection</span>
          <PayChip tone={connected ? "success" : "warning"}>{connected ? "Connected" : "Not connected"}</PayChip>
        </div>
        <div className="admin-payments-kv">
          <span>Account</span>
          <strong>{account}</strong>
        </div>
        {provider === "stripe" || provider === "swish" ? (
          <div className="admin-payments-kv">
            <span>Environment</span>
            <strong>
              {(provider === "stripe" ? stripe?.environment : swish?.environment) === "production"
                ? "Production"
                : "Sandbox"}
            </strong>
          </div>
        ) : null}
        <div className="admin-payments-capability-list">
          <p className="text-xs font-bold uppercase tracking-wide admin-config-text-muted">Capabilities</p>
          <ul>
            <li>✓ Payments</li>
            <li>✓ Refunds</li>
            <li>✓ Webhooks</li>
          </ul>
        </div>
        {webhookHealth ? (
          <div className="admin-payments-kv">
            <span>Last webhook</span>
            <strong>{formatWhen(webhookHealth.lastEventAt)}</strong>
          </div>
        ) : null}
        {webhookHealth ? (
          <div className="admin-payments-kv">
            <span>Webhook health</span>
            <PayChip tone={webhookHealth.status === "healthy" ? "success" : "warning"}>
              {webhookHealth.status === "healthy" ? "Healthy" : webhookHealth.status}
            </PayChip>
          </div>
        ) : null}
        {canEdit && (provider === "stripe" || provider === "swish") ? (
          <div className="flex flex-wrap gap-2 pt-2">
            {connected ? (
              <AdminBtnSecondary type="button" onClick={onDisconnect}>
                Disconnect
              </AdminBtnSecondary>
            ) : (
              <AdminBtnSecondary type="button" onClick={onConnect}>
                Connect
              </AdminBtnSecondary>
            )}
          </div>
        ) : null}
      </div>
      <ProfileModalFooter cancelLabel="Close" confirmLabel="Done" onCancel={onClose} onConfirm={onClose} />
    </MenuPageModalShell>
  );
}
