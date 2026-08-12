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
  onVerify: () => void;
};

export function PaymentProviderDetailModal({
  open,
  provider,
  settings,
  webhookHealth,
  canEdit,
  onClose,
  onConnect,
  onDisconnect,
  onVerify
}: Props) {
  const stripe = settings?.providers.stripe;
  const swish = settings?.providers.swish;
  const terminalsConn = settings?.providerConnections?.terminals;
  const stripeConn = settings?.providerConnections?.stripe;
  const swishConn = settings?.providerConnections?.swish;

  const title =
    provider === "stripe"
      ? "Card / Stripe adapter"
      : provider === "swish"
        ? "Swish adapter"
        : provider === "terminals"
          ? "Card terminals"
          : "Provider";

  const connected =
    provider === "stripe"
      ? Boolean(stripe?.connected || stripeConn?.connected)
      : provider === "swish"
        ? Boolean(swish?.connected || swishConn?.connected)
        : Boolean(terminalsConn?.connected || (stripe?.connected && settings?.methods.cardTerminal));

  const account =
    provider === "stripe"
      ? maskAccountId(stripe?.accountId || stripeConn?.publicAccountId)
      : provider === "swish"
        ? maskAccountId(swish?.merchantId || swishConn?.publicMerchantId)
        : terminalsConn?.publicAccountId
          ? maskAccountId(terminalsConn.publicAccountId)
          : connected
            ? "Linked via card adapter"
            : "—";

  const verificationStatus =
    provider === "stripe"
      ? stripe?.verificationStatus || stripeConn?.verificationStatus
      : provider === "swish"
        ? swish?.verificationStatus || swishConn?.verificationStatus
        : terminalsConn?.verificationStatus || stripe?.verificationStatus;

  const environment =
    provider === "stripe"
      ? stripe?.environment || stripeConn?.environment
      : provider === "swish"
        ? swish?.environment || swishConn?.environment
        : terminalsConn?.environment || stripe?.environment;

  const health =
    provider === "stripe"
      ? stripe?.health || stripeConn?.health
      : provider === "swish"
        ? swish?.health || swishConn?.health
        : terminalsConn?.health || stripe?.health;

  const secretFlags =
    provider === "stripe"
      ? stripeConn
      : provider === "swish"
        ? swishConn
        : terminalsConn;

  return (
    <MenuPageModalShell
      open={open}
      onClose={onClose}
      title={title}
      description="Connection details from the ServeOS adapter — secrets are never shown after save."
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
        {provider === "stripe" || provider === "swish" || provider === "terminals" ? (
          <div className="admin-payments-kv">
            <span>Environment</span>
            <strong>{environment === "production" ? "Production" : connected ? "Sandbox" : "—"}</strong>
          </div>
        ) : null}
        <div className="admin-payments-kv">
          <span>Verification</span>
          <PayChip
            tone={
              verificationStatus === "verified" ? "success" : verificationStatus === "failed" ? "danger" : "muted"
            }
          >
            {verificationStatus ?? "unverified"}
          </PayChip>
        </div>
        <div className="admin-payments-kv">
          <span>Health</span>
          <strong>{health ?? "unknown"}</strong>
        </div>
        {secretFlags ? (
          <div className="admin-payments-capability-list">
            <p className="text-xs font-bold uppercase tracking-wide admin-config-text-muted">Credentials</p>
            <ul>
              <li>{secretFlags.hasApiSecret ? "API secret configured" : "API secret not configured"}</li>
              <li>
                {secretFlags.hasCertificate ? "Certificate configured" : "Certificate not configured"}
              </li>
              <li>
                {secretFlags.hasWebhookSecret ? "Webhook secret configured" : "Webhook secret not configured"}
              </li>
            </ul>
          </div>
        ) : null}
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
        {canEdit ? (
          <div className="flex flex-wrap gap-2 pt-2">
            {provider === "stripe" || provider === "swish" ? (
              connected ? (
                <>
                  <AdminBtnSecondary type="button" onClick={onVerify}>
                    Re-verify
                  </AdminBtnSecondary>
                  <AdminBtnSecondary type="button" onClick={onDisconnect}>
                    Disconnect
                  </AdminBtnSecondary>
                </>
              ) : (
                <AdminBtnSecondary type="button" onClick={onConnect}>
                  Connect
                </AdminBtnSecondary>
              )
            ) : connected ? (
              <AdminBtnSecondary type="button" onClick={onVerify}>
                Re-verify
              </AdminBtnSecondary>
            ) : (
              <p className="admin-config-text-subtle text-sm">
                Connect and verify the card adapter, then enable Card terminal from Methods setup.
              </p>
            )}
          </div>
        ) : null}
      </div>
      <ProfileModalFooter cancelLabel="Close" confirmLabel="Done" onCancel={onClose} onConfirm={onClose} />
    </MenuPageModalShell>
  );
}
