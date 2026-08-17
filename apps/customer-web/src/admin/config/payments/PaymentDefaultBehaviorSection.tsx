import { motion } from "framer-motion";
import type { VenuePaymentSettings } from "../../../api";
import { PaymentInfoTip } from "./paymentsFormControls";

export type PaymentBehaviorId = "before_prep" | "pay_at_venue" | "deposit";

type Rules = VenuePaymentSettings["rules"];
type FailedPayment = NonNullable<VenuePaymentSettings["failedPayment"]>;
type QrPolicy = NonNullable<VenuePaymentSettings["qrPolicy"]>;

type BehaviorCard = {
  id: PaymentBehaviorId;
  title: string;
  body: string;
  bestFor: string;
  recommended?: boolean;
};

const BEHAVIOR_CARDS: BehaviorCard[] = [
  {
    id: "before_prep",
    title: "Pay before preparation",
    body: "Customer pays online before the order is sent to the kitchen.",
    bestFor: "QR ordering, takeaway, counter orders",
    recommended: true
  },
  {
    id: "pay_at_venue",
    title: "Pay at venue",
    body: "Customer places the order first and pays at the restaurant.",
    bestFor: "Table service and traditional dine-in"
  },
  {
    id: "deposit",
    title: "Require a deposit",
    body: "Customer pays a deposit before the reservation or eligible order is confirmed.",
    bestFor: "Reservations, large parties, special events"
  }
];

export function resolvePaymentBehavior(rules: Rules): PaymentBehaviorId {
  if (rules.defaultPaymentMode === "PREPAY") return "before_prep";
  if (rules.depositRequired) return "deposit";
  return "pay_at_venue";
}

export function paymentBehaviorLabel(id: PaymentBehaviorId): string {
  return BEHAVIOR_CARDS.find((c) => c.id === id)?.title ?? id;
}

export function buildPaymentBehaviorPatch(
  behavior: PaymentBehaviorId,
  settings: VenuePaymentSettings
): Partial<VenuePaymentSettings> {
  const rules = settings.rules;
  const qr = settings.qrPolicy;
  const payAtVenue = settings.payAtVenue;

  if (behavior === "before_prep") {
    return {
      rules: {
        ...rules,
        defaultPaymentMode: "PREPAY",
        payBeforeOrder: true,
        payAfterMeal: false,
        depositRequired: false
      },
      qrPolicy: qr
        ? {
            ...qr,
            defaultPaymentMode: "PREPAY",
            requirePaymentBeforePrep: true
          }
        : undefined
    };
  }

  if (behavior === "deposit") {
    return {
      rules: {
        ...rules,
        defaultPaymentMode: "PAY_AT_VENUE",
        payBeforeOrder: false,
        payAfterMeal: false,
        depositRequired: true
      },
      qrPolicy: qr
        ? {
            ...qr,
            defaultPaymentMode: "PAY_AT_VENUE",
            requirePaymentBeforePrep: false
          }
        : undefined
    };
  }

  return {
    rules: {
      ...rules,
      defaultPaymentMode: "PAY_AT_VENUE",
      payBeforeOrder: false,
      payAfterMeal: true,
      depositRequired: false
    },
    payAtVenue: payAtVenue ? { ...payAtVenue, enabled: true } : undefined,
    qrPolicy: qr
      ? {
          ...qr,
          defaultPaymentMode: "PAY_AT_VENUE",
          requirePaymentBeforePrep: false
        }
      : undefined
  };
}

function OptionToggle({
  label,
  active,
  disabled,
  tipId,
  tipBody,
  onToggle,
  bare
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  tipId: string;
  tipBody: string;
  onToggle: () => void;
  bare?: boolean;
}) {
  return (
    <div
      className={`admin-payments-behavior-option${bare ? " is-bare" : ""}${active ? " is-active" : ""}${
        disabled ? " is-disabled" : ""
      }`}
    >
      <button
        type="button"
        className="admin-payments-behavior-option-btn"
        disabled={disabled}
        aria-pressed={active}
        onClick={() => {
          if (!disabled) onToggle();
        }}
      >
        <span className={`admin-payments-behavior-option-mark${active ? " is-on" : ""}`} aria-hidden />
        <span className="admin-payments-behavior-option-label">
          {label}
          <PaymentInfoTip tipId={tipId} body={tipBody} />
        </span>
      </button>
    </div>
  );
}

type ModeCardsProps = {
  settings: VenuePaymentSettings;
  canEdit: boolean;
  onRequestBehaviorChange: (behavior: PaymentBehaviorId) => void;
};

/** Mode radios — sit under Policy snapshot, stay in one row within that column. */
export function PaymentBehaviorModeCards({ settings, canEdit, onRequestBehaviorChange }: ModeCardsProps) {
  const selected = resolvePaymentBehavior(settings.rules);

  return (
    <div id="rules-default-mode" className="admin-payments-behavior-modes">
      <p className="admin-payments-behavior-sub">When should guests pay by default?</p>
      <div className="admin-payments-behavior-cards" role="radiogroup" aria-label="When should guests pay by default?">
        {BEHAVIOR_CARDS.map((card) => {
          const active = selected === card.id;
          return (
            <motion.button
              key={card.id}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={!canEdit}
              className={`admin-payments-behavior-card${active ? " is-selected" : ""}${
                !canEdit ? " is-disabled" : ""
              }`}
              onClick={() => {
                if (!canEdit || active) return;
                onRequestBehaviorChange(card.id);
              }}
              whileTap={canEdit ? { scale: 0.988 } : undefined}
              transition={{ type: "spring", stiffness: 480, damping: 34 }}
            >
              <span className={`admin-payments-behavior-radio${active ? " is-on" : ""}`} aria-hidden>
                <span className="admin-payments-behavior-radio-dot" />
              </span>
              <span className="admin-payments-behavior-card-main">
                <span className="admin-payments-behavior-card-title">{card.title}</span>
                {card.recommended ? <span className="admin-payments-behavior-badge">Recommended</span> : null}
              </span>
              <PaymentInfoTip
                tipId={`payment-behavior-tip-${card.id}`}
                body={`${card.body} Best for: ${card.bestFor}.`}
              />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

type PrepTogglesProps = {
  canEdit: boolean;
  failed: FailedPayment;
  qr: QrPolicy;
  onRequestFailedKitchenBlock: (blockKitchen: boolean) => void;
  onRequestQrPayBeforePrep: (requirePaymentBeforePrep: boolean) => void;
};

/** Borderless toggles — sit under the domain-completeness column. */
export function PaymentBehaviorPrepToggles({
  canEdit,
  failed,
  qr,
  onRequestFailedKitchenBlock,
  onRequestQrPayBeforePrep
}: PrepTogglesProps) {
  return (
    <div className="admin-payments-behavior-side">
      <OptionToggle
        bare
        label="Do not send order to kitchen if payment fails"
        tipId="payment-behavior-opt-block-kitchen"
        tipBody="Protects prep when a pay-first attempt fails."
        active={failed.blockKitchen}
        disabled={!canEdit}
        onToggle={() => onRequestFailedKitchenBlock(!failed.blockKitchen)}
      />
      <OptionToggle
        bare
        label="Require payment before preparation on QR"
        tipId="payment-behavior-opt-qr-prep"
        tipBody="QR sessions stay aligned with this default behavior."
        active={qr.requirePaymentBeforePrep}
        disabled={!canEdit}
        onToggle={() => onRequestQrPayBeforePrep(!qr.requirePaymentBeforePrep)}
      />
    </div>
  );
}

