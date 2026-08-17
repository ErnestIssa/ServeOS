import type {
  PaymentWebhookHealth,
  VenuePaymentAccount,
  VenuePaymentSettings
} from "../../../api";
import { DetailsDrawerShell } from "../menu/detailsDrawerUi";
import { PaymentInfoTip } from "./paymentsFormControls";
import { formatWhen, maskAccountId } from "./paymentsUiHelpers";

export type PaymentProviderDetailKey = "managed" | "stripe" | "swish" | "terminals";

type Props = {
  open: boolean;
  provider: PaymentProviderDetailKey | null;
  settings: VenuePaymentSettings | null;
  account?: VenuePaymentAccount | null;
  webhookHealth: PaymentWebhookHealth | null;
  canEdit: boolean;
  connecting?: boolean;
  showContinueOnboarding?: boolean;
  onClose: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onVerify: () => void;
  onContinueOnboarding?: () => void;
  onManageTerminals?: () => void;
};

function DetailRow({
  label,
  value,
  tipId,
  tipBody
}: {
  label: string;
  value: string;
  tipId?: string;
  tipBody?: string;
}) {
  return (
    <div className="admin-payments-provider-detail-row">
      <span className="admin-payments-provider-detail-label">
        {label}
        {tipId && tipBody ? <PaymentInfoTip tipId={tipId} body={tipBody} /> : null}
      </span>
      <strong>{value}</strong>
    </div>
  );
}

export function PaymentProviderDetailModal({
  open,
  provider,
  settings,
  account,
  webhookHealth,
  canEdit,
  connecting = false,
  showContinueOnboarding = false,
  onClose,
  onConnect,
  onDisconnect,
  onVerify,
  onContinueOnboarding,
  onManageTerminals
}: Props) {
  const stripe = settings?.providers.stripe;
  const swish = settings?.providers.swish;
  const terminalsConn = settings?.providerConnections?.terminals;
  const stripeConn = settings?.providerConnections?.stripe;
  const swishConn = settings?.providerConnections?.swish;

  const title =
    provider === "managed"
      ? "Stripe"
      : provider === "stripe"
        ? "Own Stripe account"
        : provider === "swish"
          ? "Own Swish agreement"
          : provider === "terminals"
            ? "Card terminals"
            : "Provider";

  const subtitle =
    provider === "managed"
      ? "ServeOS-managed connection for this venue."
      : provider === "stripe"
        ? "Your own Stripe account, used instead of ServeOS-managed payments."
        : provider === "swish"
          ? "Your own Swish merchant agreement."
          : "In-person card hardware for this venue.";

  const connected =
    provider === "managed"
      ? Boolean(
          account?.chargesEnabled ||
            account?.onboardingState === "ACTIVE" ||
            account?.onboardingState === "CONNECTED"
        )
      : provider === "stripe"
        ? Boolean(stripe?.connected || stripeConn?.connected)
        : provider === "swish"
          ? Boolean(swish?.connected || swishConn?.connected)
          : Boolean(terminalsConn?.connected || (stripe?.connected && settings?.methods.cardTerminal));

  const accountId =
    provider === "managed"
      ? maskAccountId(account?.providerAccountId)
      : provider === "stripe"
        ? maskAccountId(stripe?.accountId || stripeConn?.publicAccountId)
        : provider === "swish"
          ? maskAccountId(swish?.merchantId || swishConn?.publicMerchantId)
          : terminalsConn?.publicAccountId
            ? maskAccountId(terminalsConn.publicAccountId)
            : connected
              ? "Linked via card adapter"
              : "—";

  const verificationStatus =
    provider === "managed"
      ? account?.onboardingState ?? "—"
      : provider === "stripe"
        ? stripe?.verificationStatus || stripeConn?.verificationStatus
        : provider === "swish"
          ? swish?.verificationStatus || swishConn?.verificationStatus
          : terminalsConn?.verificationStatus || stripe?.verificationStatus;

  const environment =
    provider === "managed"
      ? account?.environment
      : provider === "stripe"
        ? stripe?.environment || stripeConn?.environment
        : provider === "swish"
          ? swish?.environment || swishConn?.environment
          : terminalsConn?.environment || stripe?.environment;

  const health =
    provider === "managed"
      ? account?.chargesEnabled && account?.payoutsEnabled
        ? "ready"
        : "setup needed"
      : provider === "stripe"
        ? stripe?.health || stripeConn?.health
        : provider === "swish"
          ? swish?.health || swishConn?.health
          : terminalsConn?.health || stripe?.health;

  const secretFlags =
    provider === "stripe" ? stripeConn : provider === "swish" ? swishConn : provider === "terminals" ? terminalsConn : null;

  const footerActions = canEdit ? (
    <>
      {provider === "managed" ? (
        <>
          <button
            type="button"
            className="admin-profile-modal-btn admin-profile-modal-btn--ghost"
            disabled={connecting}
            onClick={onVerify}
          >
            {connecting ? "Refreshing…" : "Refresh status"}
          </button>
          {showContinueOnboarding && onContinueOnboarding ? (
            <button
              type="button"
              className="admin-profile-modal-btn admin-profile-modal-btn--primary"
              disabled={connecting}
              onClick={onContinueOnboarding}
            >
              Continue setup
            </button>
          ) : null}
        </>
      ) : null}
      {provider === "stripe" || provider === "swish" ? (
        connected ? (
          <>
            <button
              type="button"
              className="admin-profile-modal-btn admin-profile-modal-btn--ghost"
              disabled={connecting}
              onClick={onVerify}
            >
              Re-verify
            </button>
            <button
              type="button"
              className="admin-profile-modal-btn admin-profile-modal-btn--ghost"
              disabled={connecting}
              onClick={onDisconnect}
            >
              Disconnect
            </button>
          </>
        ) : (
          <button
            type="button"
            className="admin-profile-modal-btn admin-profile-modal-btn--primary"
            onClick={onConnect}
          >
            Connect
          </button>
        )
      ) : null}
      {provider === "terminals" ? (
        <button
          type="button"
          className="admin-profile-modal-btn admin-profile-modal-btn--primary"
          onClick={() => {
            onClose();
            onManageTerminals?.();
          }}
        >
          Manage terminals
        </button>
      ) : null}
    </>
  ) : null;

  return (
    <DetailsDrawerShell
      open={open}
      entityKey={provider}
      kicker="Providers"
      title={title}
      subtitle={subtitle}
      closeLabel={`Close ${title}`}
      onClose={onClose}
      footer={
        <div className="admin-payments-rule-footer">
          <button type="button" className="admin-profile-modal-btn admin-profile-modal-btn--ghost" onClick={onClose}>
            Close
          </button>
          {footerActions}
        </div>
      }
    >
      <div className="admin-payments-provider-detail">
        <DetailRow
          label="Connection"
          value={connected ? "Connected" : "Not connected"}
          tipId={`provider-conn-${provider ?? "none"}`}
          tipBody="Whether ServeOS can use this account to process or confirm payments."
        />
        <DetailRow
          label="Account"
          value={accountId || "—"}
          tipId={`provider-acct-${provider ?? "none"}`}
          tipBody="Masked account reference. Full credentials are never shown after save."
        />
        <DetailRow
          label="Environment"
          value={environment === "production" ? "Production" : connected || account ? "Sandbox" : "—"}
        />
        {provider === "managed" ? (
          <>
            <DetailRow
              label="Charges"
              value={account?.chargesEnabled ? "Ready" : "Not ready"}
              tipId="provider-managed-charges"
              tipBody="Ready means the provider can take guest payments for this venue."
            />
            <DetailRow
              label="Payouts"
              value={account?.payoutsEnabled ? "Ready" : "Not ready"}
              tipId="provider-managed-payouts"
              tipBody="Ready means settled funds can be paid out to the venue bank account."
            />
            <DetailRow label="Last sync" value={formatWhen(account?.lastProviderSyncAt)} />
          </>
        ) : (
          <>
            <DetailRow label="Verification" value={String(verificationStatus ?? "unverified")} />
            <DetailRow label="Health" value={String(health ?? "unknown")} />
          </>
        )}
        {secretFlags ? (
          <div className="admin-payments-provider-detail-secrets">
            <p className="admin-payments-venue-panel-kicker">
              Credentials
              <PaymentInfoTip
                tipId="provider-secrets-tip"
                body="ServeOS stores whether a secret exists, never the secret itself."
              />
            </p>
            <ul>
              <li>{secretFlags.hasApiSecret ? "API secret configured" : "API secret not configured"}</li>
              <li>{secretFlags.hasCertificate ? "Certificate configured" : "Certificate not configured"}</li>
              <li>
                {secretFlags.hasWebhookSecret ? "Webhook secret configured" : "Webhook secret not configured"}
              </li>
            </ul>
          </div>
        ) : null}
        {webhookHealth ? (
          <DetailRow label="Last provider event" value={formatWhen(webhookHealth.lastEventAt)} />
        ) : null}
      </div>
    </DetailsDrawerShell>
  );
}
