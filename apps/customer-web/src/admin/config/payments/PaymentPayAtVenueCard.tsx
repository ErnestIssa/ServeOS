import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { VenuePaymentSettings } from "../../../api";
import { AdminInput } from "../../AdminUi";
import { PaymentExpandSelect, PaymentInfoTip, PaymentSwitch, type PaymentSelectOption } from "./paymentsFormControls";
import { ADVANCED_RULES, type AdvancedRuleKey } from "./PaymentAdvancedRulesDrawer";
import { PAY_AT_VENUE_TIMING_OPTIONS } from "./paymentsUiHelpers";

type PayAtVenue = NonNullable<VenuePaymentSettings["payAtVenue"]>;
type ChannelKey = keyof PayAtVenue["channels"];
type SettlementKey = keyof PayAtVenue["settlementMethods"];

const TIMING_OPTIONS: PaymentSelectOption[] = PAY_AT_VENUE_TIMING_OPTIONS.map((opt) => ({
  value: opt.value,
  label: opt.label,
  hint: opt.hint
}));

const TIMING_HELPER: Record<PayAtVenue["timing"], string> = {
  before_served: "Payment is requested before food leaves the pass for the table.",
  when_ready: "Payment is requested when the order is marked ready for the guest.",
  when_bill_requested:
    "Payment is requested when a customer or staff member asks to settle the bill.",
  after_completed: "Payment is requested after the visit or order is marked completed."
};

const CHANNELS: Array<{ key: ChannelKey; label: string; tip: string }> = [
  {
    key: "qrOrders",
    label: "QR orders",
    tip: "Customers order from a table QR code."
  },
  {
    key: "walkIns",
    label: "Walk-ins",
    tip: "Orders created for in-person guests without a reservation."
  },
  {
    key: "staffCreated",
    label: "Staff-created orders",
    tip: "Tickets opened by staff on the floor or POS."
  },
  {
    key: "reservations",
    label: "Reservations",
    tip: "Booked covers that settle at the venue."
  },
  {
    key: "delivery",
    label: "Delivery",
    tip: "Delivery tickets that still settle in person or on handoff."
  }
];

const SETTLEMENTS: Array<{ key: SettlementKey; label: string; tip: string }> = [
  { key: "cash", label: "Cash", tip: "Staff collect cash and mark the check paid." },
  {
    key: "cardTerminal",
    label: "Card terminal",
    tip: "In-person card via a connected or external terminal."
  },
  { key: "swish", label: "Swish", tip: "Guest pays with Swish while still at the venue." },
  { key: "other", label: "Other", tip: "A custom settlement method your team confirms." }
];

const TERMINAL_MODE_OPTIONS: PaymentSelectOption[] = [
  {
    value: "connected",
    label: "Select terminal / integration",
    hint: "Use a linked card terminal or payment integration."
  },
  {
    value: "external_manual",
    label: "Use external terminal — staff confirms payment manually",
    hint: "Staff takes payment on a separate device, then confirms in ServeOS."
  }
];

function CheckOption({
  label,
  tipId,
  tipBody,
  checked,
  disabled,
  onToggle
}: {
  label: string;
  tipId: string;
  tipBody: string;
  checked: boolean;
  disabled?: boolean;
  onToggle: (next: boolean) => void;
}) {
  return (
    <label
      className={`admin-payments-venue-check${checked ? " is-on" : ""}${disabled ? " is-disabled" : ""}`}
    >
      <input
        type="checkbox"
        className="admin-payments-venue-check-input"
        checked={checked}
        disabled={disabled}
        onChange={(e) => {
          if (disabled) return;
          onToggle(e.target.checked);
        }}
      />
      <span className="admin-payments-venue-check-box" aria-hidden>
        {checked ? "✓" : ""}
      </span>
      <span className="admin-payments-venue-check-label">{label}</span>
      <PaymentInfoTip tipId={tipId} body={tipBody} />
    </label>
  );
}

type Props = {
  payAtVenue: PayAtVenue;
  canEdit: boolean;
  advancedRule: AdvancedRuleKey | null;
  onOpenAdvanced: (key: AdvancedRuleKey) => void;
  onRequestEnabled: (enabled: boolean) => void;
  onRequestTiming: (timing: PayAtVenue["timing"]) => void;
  onRequestChannel: (key: ChannelKey, on: boolean) => void;
  onRequestSettlement: (key: SettlementKey, on: boolean) => void;
  onRequestCardTerminalMode: (mode: NonNullable<PayAtVenue["cardTerminal"]>["mode"]) => void;
  onRequestOtherLabel: (label: string) => void;
  onRequestOtherStaffConfirm: (requireStaffConfirmation: boolean) => void;
};

export function PaymentPayAtVenueCard({
  payAtVenue,
  canEdit,
  advancedRule,
  onOpenAdvanced,
  onRequestEnabled,
  onRequestTiming,
  onRequestChannel,
  onRequestSettlement,
  onRequestCardTerminalMode,
  onRequestOtherLabel,
  onRequestOtherStaffConfirm
}: Props) {
  const enabled = payAtVenue.enabled;
  const cardTerminalOn = payAtVenue.settlementMethods.cardTerminal;
  const otherOn = payAtVenue.settlementMethods.other;
  const cardTerminal = payAtVenue.cardTerminal ?? { mode: "external_manual" as const };
  const other = payAtVenue.other ?? { label: "", requireStaffConfirmation: true };
  const [otherLabelDraft, setOtherLabelDraft] = useState(other.label);

  useEffect(() => {
    setOtherLabelDraft(other.label);
  }, [other.label]);

  return (
    <section id="rules-pay-at-venue" className="admin-payments-venue-card">
      <header className="admin-payments-venue-card-head">
        <button
          type="button"
          className={`admin-payments-venue-enable${enabled ? " is-on" : ""}${!canEdit ? " is-disabled" : ""}`}
          disabled={!canEdit}
          aria-pressed={enabled}
          onClick={() => {
            if (!canEdit) return;
            onRequestEnabled(!enabled);
          }}
        >
          <span className="admin-payments-venue-enable-copy">
            <span className="admin-payments-venue-enable-title">Enable Pay at venue</span>
            <span className="admin-payments-venue-enable-desc">
              Allow customers to order now and settle their bill later at the restaurant.
            </span>
          </span>
          <span className={`admin-payments-switch-track${enabled ? " is-on" : ""}`} aria-hidden>
            <span className="admin-payments-switch-thumb" />
          </span>
        </button>
      </header>

      <div
        className={`admin-payments-venue-card-body${enabled ? " is-open" : ""}`}
        aria-hidden={!enabled}
        {...(enabled ? {} : ({ inert: "" } as Record<string, string>))}
      >
        <div className="admin-payments-venue-card-body-clip">
          <div className="admin-payments-venue-card-panels">
              <div className="admin-payments-venue-panel">
                <p className="admin-payments-venue-panel-kicker">Settlement timing</p>
                <PaymentExpandSelect
                  label="When should payment be requested?"
                  value={payAtVenue.timing}
                  options={TIMING_OPTIONS}
                  disabled={!canEdit}
                  onRequestChange={(next) => onRequestTiming(next as PayAtVenue["timing"])}
                />
                <p className="admin-payments-venue-helper">{TIMING_HELPER[payAtVenue.timing]}</p>
              </div>

              <div className="admin-payments-venue-panel">
                <p className="admin-payments-venue-panel-kicker">Available for</p>
                <p className="admin-payments-venue-panel-desc">
                  Select the order types that can use this payment flow.
                </p>
                <div className="admin-payments-venue-check-grid" role="group" aria-label="Available for">
                  {CHANNELS.map((channel) => (
                    <CheckOption
                      key={channel.key}
                      label={channel.label}
                      tipId={`pay-at-venue-channel-${channel.key}`}
                      tipBody={channel.tip}
                      checked={payAtVenue.channels[channel.key]}
                      disabled={!canEdit}
                      onToggle={(on) => onRequestChannel(channel.key, on)}
                    />
                  ))}
                </div>
              </div>

              <div className="admin-payments-venue-panel">
                <p className="admin-payments-venue-panel-kicker">Settlement methods</p>
                <p className="admin-payments-venue-panel-desc">Accepted ways guests can settle at the venue.</p>
                <div
                  className="admin-payments-venue-check-grid"
                  role="group"
                  aria-label="Accepted settlement methods"
                >
                  {SETTLEMENTS.map((method) => (
                    <CheckOption
                      key={method.key}
                      label={method.label}
                      tipId={`pay-at-venue-method-${method.key}`}
                      tipBody={method.tip}
                      checked={payAtVenue.settlementMethods[method.key]}
                      disabled={!canEdit}
                      onToggle={(on) => onRequestSettlement(method.key, on)}
                    />
                  ))}
                </div>

                <AnimatePresence initial={false}>
                  {cardTerminalOn ? (
                    <motion.div
                      key="card-terminal-extra"
                      className="admin-payments-venue-reveal"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <p className="admin-payments-venue-reveal-title">Terminal</p>
                      <PaymentExpandSelect
                        label="How card payments are confirmed"
                        value={cardTerminal.mode}
                        options={TERMINAL_MODE_OPTIONS}
                        disabled={!canEdit}
                        onRequestChange={(next) =>
                          onRequestCardTerminalMode(next as NonNullable<PayAtVenue["cardTerminal"]>["mode"])
                        }
                      />
                      <p className="admin-payments-venue-helper">
                        {cardTerminal.mode === "connected"
                          ? "ServeOS will route card settlement through a linked terminal or integration when available."
                          : "Staff take payment on an external terminal, then confirm the payment in ServeOS."}
                      </p>
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                <AnimatePresence initial={false}>
                  {otherOn ? (
                    <motion.div
                      key="other-extra"
                      className="admin-payments-venue-reveal"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <p className="admin-payments-venue-reveal-title">Other payment method</p>
                      <label className="admin-payments-venue-field">
                        <span className="admin-payments-venue-field-label">Method name</span>
                        <AdminInput
                          value={otherLabelDraft}
                          disabled={!canEdit}
                          placeholder="e.g. Invoice, voucher, house account"
                          onChange={(e) => setOtherLabelDraft(e.target.value)}
                          onBlur={() => {
                            if (otherLabelDraft.trim() === other.label.trim()) return;
                            onRequestOtherLabel(otherLabelDraft.trim());
                          }}
                        />
                      </label>
                      <PaymentSwitch
                        label="Require staff confirmation"
                        description="Staff must confirm before this method closes the check."
                        checked={other.requireStaffConfirmation}
                        disabled={!canEdit}
                        onRequestChange={onRequestOtherStaffConfirm}
                      />
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </div>
        </div>
      </div>

      <div className="admin-payments-venue-advanced">
        <p className="admin-payments-venue-panel-kicker">Manage Advanced Payment Rules</p>
        <div className="admin-payments-venue-advanced-row" role="group" aria-label="Advanced payment rules">
          {ADVANCED_RULES.map((rule) => (
            <button
              key={rule.key}
              type="button"
              className={`admin-payments-venue-advanced-btn${advancedRule === rule.key ? " is-active" : ""}`}
              onClick={() => onOpenAdvanced(rule.key)}
            >
              <span className="admin-payments-venue-advanced-btn-title">{rule.title}</span>
              <span className="admin-payments-venue-advanced-btn-desc">{rule.description}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

export const PAY_AT_VENUE_CHANNEL_OPTIONS = CHANNELS;
export const PAY_AT_VENUE_SETTLEMENT_OPTIONS = SETTLEMENTS;
