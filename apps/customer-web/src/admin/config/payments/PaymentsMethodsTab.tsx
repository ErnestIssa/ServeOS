import type { VenuePaymentSettings } from "../../../api";
import { PayChip, PaySection, ToggleRow } from "./paymentsShared";
import { methodLabel } from "./paymentsUiHelpers";

type Props = {
  settings: VenuePaymentSettings;
  canEdit: boolean;
  onToggle: (key: string, enabled: boolean) => void;
  onConfigure: (key: string) => void;
};

const VENUE_METHODS = ["payAtVenue", "cash", "cardTerminal", "swish"] as const;
const APP_METHODS = ["card", "applePay", "googlePay", "swish"] as const;
const FUTURE_METHODS = ["giftCards", "restaurantCredit", "loyaltyBalance"] as const;

function MethodCard({
  methodKey,
  enabled,
  canEdit,
  onToggle,
  onConfigure
}: {
  methodKey: string;
  enabled: boolean;
  canEdit: boolean;
  onToggle: (v: boolean) => void;
  onConfigure: () => void;
}) {
  return (
    <div className="admin-payments-method-card">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold admin-config-text">{methodLabel(methodKey)}</p>
          <PayChip tone={enabled ? "success" : "muted"}>{enabled ? "ON" : "OFF"}</PayChip>
        </div>
        <button type="button" className="admin-payments-link-btn mt-1" onClick={onConfigure}>
          Configure
        </button>
      </div>
      <input
        type="checkbox"
        className="admin-payments-toggle-input"
        checked={enabled}
        disabled={!canEdit}
        onChange={(e) => onToggle(e.target.checked)}
        aria-label={`${methodLabel(methodKey)} enabled`}
      />
    </div>
  );
}

export function PaymentsMethodsTab({ settings, canEdit, onToggle, onConfigure }: Props) {
  return (
    <div className="admin-payments-tab-stack">
      <PaySection title="Pay at venue" description="How guests settle when they scan, order, eat, and pay in the restaurant.">
        <div className="admin-payments-method-grid">
          {VENUE_METHODS.map((key) => (
            <MethodCard
              key={key}
              methodKey={key}
              enabled={Boolean(settings.methods[key])}
              canEdit={canEdit}
              onToggle={(v) => onToggle(key, v)}
              onConfigure={() => onConfigure(key)}
            />
          ))}
        </div>
      </PaySection>

      <PaySection title="Pay in app" description="Online methods for QR and mobile checkout.">
        <div className="admin-payments-method-grid">
          {APP_METHODS.map((key) => (
            <MethodCard
              key={`app-${key}`}
              methodKey={key}
              enabled={Boolean(settings.methods[key])}
              canEdit={canEdit}
              onToggle={(v) => onToggle(key, v)}
              onConfigure={() => onConfigure(key)}
            />
          ))}
        </div>
      </PaySection>

      <PaySection title="Future methods" description="Ready in policy — wiring ships with loyalty / credit products.">
        <div className="grid gap-2">
          {FUTURE_METHODS.map((key) => (
            <ToggleRow
              key={key}
              label={methodLabel(key)}
              description="Policy toggle only"
              checked={Boolean(settings.methods[key])}
              disabled={!canEdit}
              onChange={(v) => onToggle(key, v)}
            />
          ))}
        </div>
      </PaySection>
    </div>
  );
}
