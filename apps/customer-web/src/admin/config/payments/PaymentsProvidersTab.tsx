import { useState } from "react";
import type {
  PaymentLogRow,
  PaymentProviderEnvReady,
  PaymentWebhookHealth,
  VenuePaymentAccount,
  VenuePaymentCapability,
  VenuePaymentPlatformSnapshot,
  VenuePaymentSettings
} from "../../../api";
import { ConfigSectionSpinner } from "../configLoadingUi";
import { PaymentInfoTip, PaymentMethodGlyph, PaymentSelectChevron } from "./paymentsFormControls";
import { PaySection } from "./paymentsShared";
import { formatClock, formatWhen, maskAccountId } from "./paymentsUiHelpers";
import type { PaymentProviderDetailKey } from "./PaymentProviderDetailModal";
import { PaymentProviderLogsDrawer, PaymentProviderMethodsDrawer } from "./PaymentProviderPreviewDrawers";

type Props = {
  settings: VenuePaymentSettings;
  paymentPlatform: VenuePaymentPlatformSnapshot | null;
  webhookHealth: PaymentWebhookHealth | null;
  envReady: PaymentProviderEnvReady | null;
  logs?: PaymentLogRow[];
  logSource?: "live" | "demo";
  canEdit: boolean;
  connectingManaged?: boolean;
  onOpenProvider: (p: PaymentProviderDetailKey) => void;
  onConnectPayments: () => void;
  onContinueOnboarding: () => void;
  onSyncAccount: () => void;
  onConnectAdvanced: (p: "stripe" | "swish") => void;
  onDisconnectAdvanced: (p: "stripe" | "swish") => void;
  onManageTerminals: () => void;
};

const CAPABILITY_ROWS: Array<{ id: string; label: string; iconKey: string; unavailable: string }> = [
  { id: "card_payments", label: "Cards", iconKey: "visa", unavailable: "not available for this account" },
  { id: "apple_pay", label: "Apple Pay", iconKey: "applePay", unavailable: "not available for this account" },
  { id: "google_pay", label: "Google Pay", iconKey: "googlePay", unavailable: "not available for this account" },
  { id: "transfers", label: "Payouts", iconKey: "bankTransfer", unavailable: "not available for this account" },
  { id: "klarna", label: "Klarna", iconKey: "klarnaPayNow", unavailable: "not available for this account" },
  { id: "terminal", label: "Card terminals", iconKey: "cardTerminal", unavailable: "not connected" }
];

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

function isCapActive(cap: VenuePaymentCapability | undefined) {
  if (!cap) return false;
  return cap.normalizedStatus === "active" || cap.providerStatus === "active";
}

function findCap(account: VenuePaymentAccount | null, id: string) {
  return account?.capabilities?.find((c) => c.id === id);
}

function healthCopy(status: PaymentWebhookHealth["status"] | undefined) {
  if (status === "failing") {
    return "Some payment operations may be affected. Check payment logs for failed provider events.";
  }
  if (status === "degraded") {
    return "Some provider events are delayed. Payments may still continue processing normally.";
  }
  if (status === "healthy") {
    return "Connection is healthy. Provider events are arriving normally.";
  }
  return "Status will appear once ServeOS has checked this connection.";
}

function healthLabel(status: PaymentWebhookHealth["status"] | undefined) {
  if (status === "failing") return "Down";
  if (status === "degraded") return "Degraded";
  if (status === "healthy") return "Healthy";
  return "Unknown";
}

export function PaymentsProvidersTab({
  settings,
  paymentPlatform,
  webhookHealth,
  envReady,
  logs = [],
  logSource,
  canEdit,
  connectingManaged = false,
  onOpenProvider,
  onConnectPayments,
  onContinueOnboarding,
  onSyncAccount,
  onConnectAdvanced,
  onDisconnectAdvanced,
  onManageTerminals
}: Props) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [preview, setPreview] = useState<"methods" | "logs" | null>(null);
  const account = paymentPlatform?.primaryAccount ?? null;
  const next = paymentPlatform?.nextAction;
  const stripe = settings.providers.stripe;
  const swish = settings.providers.swish;
  const terminalsConnected = Boolean(
    settings.providerConnections?.terminals?.connected ||
      (settings.providers.stripe.connected && settings.methods.cardTerminal)
  );

  const isReady =
    account?.onboardingState === "ACTIVE" ||
    account?.onboardingState === "CONNECTED" ||
    Boolean(account?.chargesEnabled);
  const providerName =
    account?.displayName?.trim() ||
    (account?.provider ? account.provider.replace(/^./, (c) => c.toUpperCase()) : "Stripe");
  const needsConnect = !account || next?.type === "CONNECT_PAYMENTS";
  const needsContinue = next?.type === "CONTINUE_ONBOARDING" || next?.type === "REFRESH_ACCOUNT";
  const statusTone = isReady ? "success" : accountStateTone(account?.onboardingState);
  const statusLabel = isReady ? "Active" : accountStateLabel(account?.onboardingState);

  const capabilityRows = CAPABILITY_ROWS.map((row) => {
    const cap = findCap(account, row.id);
    const on = row.id === "terminal" ? isCapActive(cap) || terminalsConnected : isCapActive(cap);
    return { ...row, on };
  });

  return (
    <div className="admin-payments-tab-stack admin-payments-providers-stack">
      <p className="admin-payments-providers-lede">
        Connect and manage the services that process payments for this venue. Payment providers process payments
        and send payouts to your configured bank account.
      </p>

      <div className="admin-payments-providers-pair">
        <article className={`admin-payments-provider-hero${isReady ? " is-ready" : ""}`}>
          <div className="admin-payments-compact-card-head">
            <p className="admin-payments-venue-panel-kicker">Primary payment provider</p>
            <PaymentInfoTip
              tipId="providers-primary-tip"
              body="This is the main connection ServeOS uses to charge guests and send payouts to the venue."
            />
          </div>
          <div className="admin-payments-provider-hero-head">
            <div className="min-w-0">
              <p className="admin-payments-provider-hero-name">{providerName}</p>
              {account ? (
                <p className="admin-payments-provider-hero-meta">
                  Account {maskAccountId(account.providerAccountId) || "••••"}
                </p>
              ) : (
                <p className="admin-payments-provider-hero-meta">
                  Accept cards, Apple Pay, Google Pay and other supported payment methods.
                </p>
              )}
            </div>
            {account && !needsConnect ? (
              <span className={`admin-payments-provider-status is-${statusTone}`}>
                <span className="admin-payments-provider-status-dot" aria-hidden />
                {statusLabel}
              </span>
            ) : null}
          </div>

          {account ? (
            <ul className="admin-payments-provider-checks">
              <li className={account.chargesEnabled ? "is-on" : "is-off"}>
                {account.chargesEnabled ? "Charges ready" : "Charges not ready"}
              </li>
              <li className={account.payoutsEnabled ? "is-on" : "is-off"}>
                {account.payoutsEnabled ? "Payouts ready" : "Payouts not ready"}
              </li>
            </ul>
          ) : null}

          <p className="admin-payments-provider-hero-copy">
            {isReady
              ? "Connected and ready to process payments."
              : next?.reason ||
                (needsContinue
                  ? "Finish provider setup so this venue can accept live payments."
                  : "Connect Stripe to process guest payments for this venue.")}
          </p>

          {canEdit ? (
            <div className="admin-payments-provider-actions">
              {needsConnect ? (
                <button
                  type="button"
                  className="admin-profile-modal-btn admin-profile-modal-btn--primary"
                  disabled={connectingManaged}
                  onClick={onConnectPayments}
                >
                  {connectingManaged ? "Starting…" : "Connect Stripe"}
                </button>
              ) : null}
              {needsContinue ? (
                <button
                  type="button"
                  className="admin-profile-modal-btn admin-profile-modal-btn--primary"
                  disabled={connectingManaged}
                  onClick={onContinueOnboarding}
                >
                  {next?.label || "Continue setup"}
                </button>
              ) : null}
              {account ? (
                <button
                  type="button"
                  className="admin-profile-modal-btn admin-profile-modal-btn--ghost"
                  onClick={() => onOpenProvider("managed")}
                >
                  Manage connection
                </button>
              ) : null}
            </div>
          ) : null}
        </article>

        <article className="admin-payments-provider-hero">
          <div className="admin-payments-compact-card-head">
            <p className="admin-payments-venue-panel-kicker">Provider capabilities</p>
            <PaymentInfoTip
              tipId="providers-caps-tip"
              body="This list is what the provider account can do. Payment methods is where you choose what customers can use."
            />
          </div>
          <p className="admin-payments-provider-hero-meta">Available through your connected provider</p>
          <ul className="admin-payments-cap-grid">
            {capabilityRows.map((row) => (
              <li key={row.id} className={`admin-payments-cap-item${row.on ? " is-on" : "is-off"}`}>
                <PaymentMethodGlyph methodKey={row.iconKey} />
                <span>
                  {row.label}
                  {!row.on ? <span className="admin-payments-cap-note"> {row.unavailable}</span> : null}
                </span>
              </li>
            ))}
          </ul>
          <div className="admin-payments-provider-actions">
            <button
              type="button"
              className="admin-profile-modal-btn admin-profile-modal-btn--ghost"
              onClick={() => setPreview("methods")}
            >
              View payment methods
            </button>
          </div>
        </article>

        <article className="admin-payments-provider-hero">
          <div className="admin-payments-compact-card-head">
            <p className="admin-payments-venue-panel-kicker">Connection health</p>
            <PaymentInfoTip
              tipId="providers-health-tip"
              body="Health reflects provider events reaching ServeOS, not whether a guest can tap pay right now."
            />
          </div>
          {webhookHealth ? (
            <>
              <div className="admin-payments-provider-hero-head">
                <p
                  className={`admin-payments-provider-status is-${
                    webhookHealth.status === "healthy"
                      ? "success"
                      : webhookHealth.status === "failing"
                        ? "danger"
                        : "warning"
                  }`}
                >
                  <span className="admin-payments-provider-status-dot" aria-hidden />
                  {healthLabel(webhookHealth.status)}
                </p>
              </div>
              <p className="admin-payments-provider-hero-copy">{healthCopy(webhookHealth.status)}</p>
              <dl className="admin-payments-health-meta">
                <div>
                  <dt>Last checked</dt>
                  <dd>{formatWhen(webhookHealth.lastEventAt)}</dd>
                </div>
                <div>
                  <dt>Today</dt>
                  <dd>
                    {webhookHealth.eventsToday.toLocaleString("sv-SE")} events
                    {webhookHealth.failed > 0 ? ` · ${webhookHealth.failed} failures` : ""}
                  </dd>
                </div>
              </dl>
              <div className="admin-payments-provider-actions">
                {canEdit ? (
                  <button
                    type="button"
                    className="admin-profile-modal-btn admin-profile-modal-btn--ghost"
                    disabled={connectingManaged}
                    onClick={onSyncAccount}
                  >
                    Refresh status
                  </button>
                ) : null}
                <button
                  type="button"
                  className="admin-profile-modal-btn admin-profile-modal-btn--ghost"
                  onClick={() => setPreview("logs")}
                >
                  View payment logs
                </button>
              </div>
            </>
          ) : (
            <ConfigSectionSpinner label="Loading connection health" />
          )}
        </article>
      </div>

      <PaySection
        title="Recent provider activity"
        action={
          <PaymentInfoTip
            tipId="providers-activity-tip"
            body="A short preview of the latest provider events. The full technical history lives in Payment logs."
          />
        }
        borderless
      >
        {webhookHealth ? (
          webhookHealth.recentEvents.length > 0 ? (
            <ul className="admin-payments-activity-list">
              {webhookHealth.recentEvents.slice(0, 5).map((ev) => (
                <li key={ev.id} className={ev.ok ? undefined : "is-failed"}>
                  <code>{ev.type}</code>
                  <span>{formatClock(ev.at)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="admin-payments-providers-empty">No provider events yet.</p>
          )
        ) : (
          <ConfigSectionSpinner label="Loading provider activity" />
        )}
        <button type="button" className="admin-payments-providers-link" onClick={() => setPreview("logs")}>
          View all logs →
        </button>
      </PaySection>

      <PaySection
        title="Advanced connections"
        description="Use your own payment provider accounts instead of ServeOS-managed payments."
        action={
          <PaymentInfoTip
            tipId="providers-advanced-tip"
            body="Own-account connections are for venues that already have Stripe or Swish. ServeOS-managed payments are the simplest setup."
          />
        }
        className="admin-payments-providers-isolated"
        borderless
      >
        <p className="admin-payments-providers-note">
          ServeOS-managed payments are recommended for the simplest setup.
        </p>
        <button
          type="button"
          className="admin-payments-providers-advanced-toggle"
          aria-expanded={advancedOpen}
          onClick={() => setAdvancedOpen((v) => !v)}
        >
          {advancedOpen ? "Hide advanced connections" : "Show advanced connections"}
          <PaymentSelectChevron open={advancedOpen} />
        </button>
        <div className={`admin-payments-adv-reveal${advancedOpen ? " is-open" : ""}`}>
          <div className="admin-payments-adv-reveal-inner">
            <div className="admin-payments-adv-grid">
              <article className="admin-payments-adv-card">
                <div className="admin-payments-adv-card-head">
                  <div>
                    <p className="admin-payments-adv-card-title">Stripe</p>
                    <p className="admin-payments-adv-card-desc">Your own Stripe account</p>
                  </div>
                  <span className={`admin-payments-provider-status is-${stripe.connected ? "success" : "muted"}`}>
                    <span className="admin-payments-provider-status-dot" aria-hidden />
                    {stripe.connected ? "Connected" : "Not connected"}
                  </span>
                </div>
                <p className="admin-payments-adv-card-id">
                  {stripe.connected ? maskAccountId(stripe.accountId) : "Connect an existing Stripe account."}
                </p>
                <div className="admin-payments-provider-actions">
                  {stripe.connected ? (
                    <>
                      <button
                        type="button"
                        className="admin-profile-modal-btn admin-profile-modal-btn--ghost"
                        onClick={() => onOpenProvider("stripe")}
                      >
                        Manage
                      </button>
                      {canEdit ? (
                        <button
                          type="button"
                          className="admin-profile-modal-btn admin-profile-modal-btn--ghost"
                          onClick={() => onDisconnectAdvanced("stripe")}
                        >
                          Disconnect
                        </button>
                      ) : null}
                    </>
                  ) : canEdit ? (
                    <button
                      type="button"
                      className="admin-profile-modal-btn admin-profile-modal-btn--ghost"
                      onClick={() => onConnectAdvanced("stripe")}
                    >
                      Connect
                    </button>
                  ) : null}
                </div>
              </article>

              <article className="admin-payments-adv-card">
                <div className="admin-payments-adv-card-head">
                  <div>
                    <p className="admin-payments-adv-card-title">Swish</p>
                    <p className="admin-payments-adv-card-desc">Your own Swish agreement</p>
                  </div>
                  <span className={`admin-payments-provider-status is-${swish.connected ? "success" : "muted"}`}>
                    <span className="admin-payments-provider-status-dot" aria-hidden />
                    {swish.connected ? "Connected" : "Not connected"}
                  </span>
                </div>
                <p className="admin-payments-adv-card-id">
                  {swish.connected ? maskAccountId(swish.merchantId) : "Connect an existing Swish merchant agreement."}
                </p>
                <div className="admin-payments-provider-actions">
                  {swish.connected ? (
                    <>
                      <button
                        type="button"
                        className="admin-profile-modal-btn admin-profile-modal-btn--ghost"
                        onClick={() => onOpenProvider("swish")}
                      >
                        Manage
                      </button>
                      {canEdit ? (
                        <button
                          type="button"
                          className="admin-profile-modal-btn admin-profile-modal-btn--ghost"
                          onClick={() => onDisconnectAdvanced("swish")}
                        >
                          Disconnect
                        </button>
                      ) : null}
                    </>
                  ) : canEdit ? (
                    <button
                      type="button"
                      className="admin-profile-modal-btn admin-profile-modal-btn--ghost"
                      onClick={() => onConnectAdvanced("swish")}
                    >
                      Connect
                    </button>
                  ) : null}
                </div>
              </article>
              {envReady && !envReady.stripe ? (
                <p className="admin-payments-providers-empty">
                  Platform Stripe is not configured yet — Connect may run in sandbox until it is.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </PaySection>

      <PaySection
        title="Card terminals"
        action={
          <PaymentInfoTip
            tipId="providers-terminals-tip"
            body="Terminals are in-person card hardware. Setup lives with Devices, not with customer-facing payment methods."
          />
        }
        className="admin-payments-providers-isolated"
        borderless
      >
        <div className="admin-payments-terminal-card">
          <p className="admin-payments-terminal-title">
            {terminalsConnected ? "Terminals connected" : "No terminals connected."}
          </p>
          <p className="admin-payments-terminal-copy">
            {terminalsConnected
              ? "In-person card payments can use a linked terminal."
              : "Connect a supported terminal to accept in-person card payments."}
          </p>
          <button type="button" className="admin-payments-providers-link" onClick={onManageTerminals}>
            Manage terminals →
          </button>
        </div>
      </PaySection>

      <PaymentProviderMethodsDrawer
        open={preview === "methods"}
        settings={settings}
        onClose={() => setPreview(null)}
      />
      <PaymentProviderLogsDrawer
        open={preview === "logs"}
        logs={logs}
        source={logSource}
        onClose={() => setPreview(null)}
      />
    </div>
  );
}
