import { useEffect, useState, type ReactNode } from "react";
import type { VenuePaymentSettings } from "../../../api";
import { AdminInput } from "../../AdminUi";
import { ADMIN_VENUE_CONTROL_HASH } from "../../adminTopHashes";
import { DetailsDrawerShell } from "../menu/detailsDrawerUi";
import {
  PaymentExpandSelect,
  PaymentInfoTip,
  PaymentSwitch,
  type PaymentSelectOption
} from "./paymentsFormControls";
import {
  centsToKronor,
  formatKronorLabel,
  formatKronorWithUnit,
  kronorDraftToCents,
  parseKronorInput
} from "./paymentsUiHelpers";

export const ADVANCED_RULES = [
  {
    key: "qr",
    title: "QR payment policy",
    description: "How table QR guests order, pay, and when the kitchen starts."
  },
  {
    key: "splits",
    title: "Split payments",
    description: "Let a table share one bill in the way that feels natural."
  },
  {
    key: "tips",
    title: "Tips",
    description: "Suggested amounts, custom tips, and when guests are asked."
  },
  {
    key: "failed",
    title: "Failed payment behavior",
    description: "What happens if a payment doesn’t go through."
  },
  {
    key: "refunds",
    title: "Refund permissions",
    description: "Control how much each role can refund without requiring approval."
  },
  {
    key: "tax",
    title: "Price display",
    description: "Choose how prices are shown to guests."
  }
] as const;

export type AdvancedRuleKey = (typeof ADVANCED_RULES)[number]["key"];

export const ADVANCED_RULE_BY_SECTION: Record<string, AdvancedRuleKey> = {
  "rules-qr": "qr",
  "rules-splits": "splits",
  "rules-tips": "tips",
  "rules-failed": "failed",
  "rules-refunds": "refunds",
  "rules-tax": "tax"
};

const CASH_TIPS_OPTIONS: PaymentSelectOption[] = [
  {
    value: "track_manually",
    label: "Track cash tips",
    hint: "Your team notes cash tips so they still show in reporting."
  },
  {
    value: "ignore",
    label: "Don’t track cash tips",
    hint: "Cash tips stay off ServeOS reports."
  }
];

const TIP_PRESETS = [10, 12, 15, 18, 20, 25] as const;
const TIP_PRESET_SET = new Set<number>(TIP_PRESETS);

function isTipPreset(n: number) {
  return TIP_PRESET_SET.has(n);
}

function parseTipPercent(raw: string): number | null {
  const n = Number(String(raw).trim().replace("%", "").replace(",", "."));
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  if (rounded < 1 || rounded > 100) return null;
  return rounded;
}

const PRICE_DISPLAY_OPTIONS = [
  {
    includeTax: true,
    title: "Prices include tax",
    body: "Guests see the final price they will pay.",
    example: [
      { label: "Menu price", value: "150 kr" },
      { label: "Amount paid", value: "150 kr" }
    ]
  },
  {
    includeTax: false,
    title: "Prices exclude tax",
    body: "Tax is calculated and shown separately at checkout.",
    example: [
      { label: "Menu price", value: "120 kr" },
      { label: "Tax", value: "30 kr" },
      { label: "Amount paid", value: "150 kr" }
    ]
  }
] as const;

function customTipFromList(percents: number[]) {
  return percents.find((n) => !isTipPreset(n)) ?? null;
}

const SPLIT_OPTIONS = [
  {
    key: "allowCustomerSelfSplit" as const,
    label: "Guests can split themselves",
    tip: "Guests at the table can divide the bill without waiting for staff."
  },
  {
    key: "allowStaffSplit" as const,
    label: "Staff can split a bill",
    tip: "Your team can split a check from the floor when guests ask."
  },
  {
    key: "allowEqualSplit" as const,
    label: "Split evenly",
    tip: "Divide the total equally between people at the table."
  },
  {
    key: "allowItemBasedSplit" as const,
    label: "Split by items",
    tip: "Each person pays for the dishes they ordered."
  },
  {
    key: "allowCustomAmount" as const,
    label: "Split by custom amounts",
    tip: "Guests can pay any amounts that add up to the bill."
  }
];

type QrPolicy = NonNullable<VenuePaymentSettings["qrPolicy"]>;
type Splits = NonNullable<VenuePaymentSettings["splits"]>;
type Tips = NonNullable<VenuePaymentSettings["tips"]>;
type FailedPayment = NonNullable<VenuePaymentSettings["failedPayment"]>;
type RefundLimits = NonNullable<VenuePaymentSettings["refundLimits"]>;

type PendingConfirm = {
  title: string;
  copy: string;
  confirmLabel: string;
  danger?: boolean;
  apply: () => void;
};

function RulePanel({
  kicker,
  tipId,
  tipBody,
  children
}: {
  kicker: string;
  tipId?: string;
  tipBody?: string;
  children: ReactNode;
}) {
  return (
    <div className="admin-payments-rule-panel">
      <div className="admin-payments-rule-panel-head">
        <p className="admin-payments-venue-panel-kicker">{kicker}</p>
        {tipId && tipBody ? <PaymentInfoTip tipId={tipId} body={tipBody} /> : null}
      </div>
      <div className="admin-payments-rule-panel-body">{children}</div>
    </div>
  );
}

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

function RefundRoleCard({ role, children }: { role: string; children: ReactNode }) {
  return (
    <section className="admin-payments-refund-role">
      <p className="admin-payments-refund-role-kicker">{role}</p>
      {children}
    </section>
  );
}

function RefundKronorField({
  label,
  value,
  disabled,
  helper,
  onChange
}: {
  label: string;
  value: string;
  disabled?: boolean;
  helper: string;
  onChange: (next: string) => void;
}) {
  return (
    <label className="admin-payments-refund-field">
      <span className="admin-payments-refund-field-label">{label}</span>
      <span className="admin-payments-refund-input-wrap">
        <AdminInput
          inputMode="numeric"
          disabled={disabled}
          value={value}
          aria-label={label}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => {
            const parsed = parseKronorInput(value);
            if (parsed != null) onChange(formatKronorLabel(parsed));
          }}
        />
        <span className="admin-payments-refund-suffix">kr</span>
      </span>
      <span className="admin-payments-refund-helper">{helper}</span>
    </label>
  );
}

function PriceDisplayCard({
  title,
  body,
  example,
  selected,
  disabled,
  onSelect
}: {
  title: string;
  body: string;
  example: ReadonlyArray<{ label: string; value: string }>;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      className={`admin-payments-price-card${selected ? " is-selected" : ""}${disabled ? " is-disabled" : ""}`}
      onClick={() => {
        if (!disabled) onSelect();
      }}
    >
      <span className={`admin-payments-behavior-radio${selected ? " is-on" : ""}`} aria-hidden>
        <span className="admin-payments-behavior-radio-dot" />
      </span>
      <span className="admin-payments-price-card-copy">
        <span className="admin-payments-price-card-title">{title}</span>
        <span className="admin-payments-price-card-body">{body}</span>
        {selected ? (
          <span className="admin-payments-price-example">
            <span className="admin-payments-price-example-kicker">Example</span>
            {example.map((row) => (
              <span key={row.label} className="admin-payments-price-example-row">
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </span>
            ))}
          </span>
        ) : null}
      </span>
    </button>
  );
}

function CustomTipAmount({
  percents,
  disabled,
  onRequestConfirm,
  onApply
}: {
  percents: number[];
  disabled?: boolean;
  onRequestConfirm: (pending: PendingConfirm) => void;
  onApply: (next: number[], message: string) => void;
}) {
  const persisted = customTipFromList(percents);
  const [held, setHeld] = useState<number | null>(persisted);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const customValue = persisted ?? held;
  const selected = persisted != null;

  useEffect(() => {
    if (persisted != null) setHeld(persisted);
  }, [persisted]);

  const presetsSelected = percents.filter(isTipPreset);

  const commit = (raw: string) => {
    const pct = parseTipPercent(raw);
    if (pct == null) return;

    if (isTipPreset(pct)) {
      const next = [...new Set([...presetsSelected, pct])].sort((a, b) => a - b);
      const same =
        next.length === percents.length && next.every((n) => percents.includes(n));
      setDraft("");
      setEditing(false);
      if (!same) {
        onApply(next, `${pct}% tip selected.`);
        setHeld(null);
      }
      return;
    }

    if (customValue === pct) {
      setDraft("");
      setEditing(false);
      if (!selected) {
        onRequestConfirm({
          title: "",
          copy: `${pct}% will appear as a suggested tip.`,
          confirmLabel: "Select",
          apply: () => {
            onApply([...new Set([...presetsSelected, pct])].sort((a, b) => a - b), `${pct}% tip selected.`);
            setHeld(pct);
          }
        });
      }
      return;
    }

    const replacing = customValue != null;
    onRequestConfirm({
      title: "",
      copy: replacing
        ? `Custom suggestion will change from ${customValue}% to ${pct}%.`
        : `${pct}% will be added as your custom suggestion.`,
      confirmLabel: replacing ? "Change" : "Add",
      apply: () => {
        onApply([...new Set([...presetsSelected, pct])].sort((a, b) => a - b), `${pct}% custom tip saved.`);
        setHeld(pct);
        setDraft("");
        setEditing(false);
      }
    });
  };

  const showComposer = customValue == null || editing;

  return (
    <div className="admin-payments-custom-tip">
      <p className="admin-payments-custom-tip-kicker">Custom amount</p>
      {showComposer ? (
        <div className="admin-payments-custom-tip-row">
          <label className="admin-payments-custom-tip-field">
            <AdminInput
              inputMode="decimal"
              aria-label="Custom tip percent"
              placeholder="e.g. 8"
              value={draft}
              disabled={disabled}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                commit(draft);
              }}
            />
            <span className="admin-payments-custom-tip-suffix" aria-hidden>
              %
            </span>
          </label>
          <button
            type="button"
            className="admin-payments-custom-tip-btn is-primary"
            disabled={disabled || parseTipPercent(draft) == null}
            onClick={() => commit(draft)}
          >
            {editing ? "Save" : "Add"}
          </button>
          {editing ? (
            <button
              type="button"
              className="admin-payments-custom-tip-btn"
              disabled={disabled}
              onClick={() => {
                setEditing(false);
                setDraft("");
              }}
            >
              Cancel
            </button>
          ) : null}
        </div>
      ) : (
        <div className="admin-payments-custom-tip-row">
          <label
            className={`admin-payments-venue-check admin-payments-custom-tip-chip${selected ? " is-on" : ""}${
              disabled ? " is-disabled" : ""
            }`}
          >
            <input
              type="checkbox"
              className="admin-payments-venue-check-input"
              checked={selected}
              disabled={disabled}
              onChange={(e) => {
                if (disabled || customValue == null) return;
                const on = e.target.checked;
                onRequestConfirm({
                  title: "",
                  copy: on
                    ? `${customValue}% will appear as a suggested tip.`
                    : `${customValue}% will be unselected. You can select it again, edit it, or remove it.`,
                  confirmLabel: on ? "Select" : "Unselect",
                  apply: () => {
                    onApply(
                      on
                        ? [...new Set([...presetsSelected, customValue])].sort((a, b) => a - b)
                        : presetsSelected,
                      on ? `${customValue}% tip selected.` : `${customValue}% tip unselected.`
                    );
                    setHeld(customValue);
                  }
                });
              }}
            />
            <span className="admin-payments-venue-check-box" aria-hidden>
              {selected ? "✓" : ""}
            </span>
            <span className="admin-payments-venue-check-label">{customValue}%</span>
            <PaymentInfoTip
              tipId="adv-tip-custom"
              body="Your extra suggested amount. Select it, edit the number, or remove it to add a different one."
            />
          </label>
          <button
            type="button"
            className="admin-payments-custom-tip-btn"
            disabled={disabled}
            onClick={() => {
              setDraft(customValue != null ? String(customValue) : "");
              setEditing(true);
            }}
          >
            Edit
          </button>
          <button
            type="button"
            className="admin-payments-custom-tip-btn is-danger"
            disabled={disabled}
            onClick={() => {
              if (customValue == null) return;
              onRequestConfirm({
                title: "",
                copy: `${customValue}% will be removed. You can add a new custom amount after that.`,
                confirmLabel: "Remove",
                danger: true,
                apply: () => {
                  onApply(presetsSelected, `${customValue}% custom tip removed.`);
                  setHeld(null);
                  setDraft("");
                  setEditing(false);
                }
              });
            }}
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}

function DrawerConfirm({
  pending,
  onCancel,
  onConfirm
}: {
  pending: PendingConfirm;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="admin-payments-drawer-confirm">
      <div className="admin-payments-drawer-confirm-card" role="dialog" aria-modal="true">
        <p className="admin-payments-drawer-confirm-copy">{pending.copy}</p>
        <div className="admin-payments-drawer-confirm-actions">
          <button type="button" className="admin-payments-drawer-confirm-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={`admin-payments-drawer-confirm-ok${pending.danger ? " is-danger" : ""}`}
            onClick={onConfirm}
          >
            {pending.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

type Props = {
  ruleKey: AdvancedRuleKey | null;
  open: boolean;
  canEdit: boolean;
  qr: QrPolicy;
  splits: Splits;
  tips: Tips;
  failed: FailedPayment;
  refundLimits: RefundLimits;
  taxes: VenuePaymentSettings["taxes"];
  pricesIncludeTax: boolean;
  autoCloseDraft: string;
  maxSplitsDraft: string;
  staffMaxDraft: string;
  managerMaxDraft: string;
  pending: PendingConfirm | null;
  onClose: () => void;
  onAutoCloseDraft: (value: string) => void;
  onMaxSplitsDraft: (value: string) => void;
  onStaffMaxDraft: (value: string) => void;
  onManagerMaxDraft: (value: string) => void;
  onApplyPatch: (patch: Partial<VenuePaymentSettings>, message: string) => void;
  onRequestConfirm: (next: PendingConfirm) => void;
  onCancelPending: () => void;
  onConfirmPending: () => void;
};

export function PaymentAdvancedRulesDrawer({
  ruleKey,
  open,
  canEdit,
  qr,
  splits,
  tips,
  failed,
  refundLimits,
  taxes,
  pricesIncludeTax,
  autoCloseDraft,
  maxSplitsDraft,
  staffMaxDraft,
  managerMaxDraft,
  pending,
  onClose,
  onAutoCloseDraft,
  onMaxSplitsDraft,
  onStaffMaxDraft,
  onManagerMaxDraft,
  onApplyPatch,
  onRequestConfirm,
  onCancelPending,
  onConfirmPending
}: Props) {
  const active = ADVANCED_RULES.find((rule) => rule.key === ruleKey) ?? ADVANCED_RULES[0];
  const isRefunds = ruleKey === "refunds";
  const isPriceDisplay = ruleKey === "tax";
  const [priceIncludeDraft, setPriceIncludeDraft] = useState(pricesIncludeTax);
  const staffKronorDraft = parseKronorInput(staffMaxDraft);
  const managerKronorDraft = parseKronorInput(managerMaxDraft);
  const staffCentsNext = kronorDraftToCents(staffMaxDraft);
  const managerCentsNext = kronorDraftToCents(managerMaxDraft);
  const refundDraftsValid = staffCentsNext != null && managerCentsNext != null;
  const refundDirty =
    staffCentsNext !== refundLimits.staffMaxCents || managerCentsNext !== refundLimits.managerMaxCents;
  const priceDirty = priceIncludeDraft !== pricesIncludeTax;

  useEffect(() => {
    if (open && isPriceDisplay) setPriceIncludeDraft(pricesIncludeTax);
  }, [open, isPriceDisplay, pricesIncludeTax]);

  const resetRefundDrafts = () => {
    onStaffMaxDraft(formatKronorLabel(centsToKronor(refundLimits.staffMaxCents)));
    onManagerMaxDraft(formatKronorLabel(centsToKronor(refundLimits.managerMaxCents)));
  };

  const closeDrawer = () => {
    onCancelPending();
    if (isRefunds) resetRefundDrafts();
    if (isPriceDisplay) setPriceIncludeDraft(pricesIncludeTax);
    onClose();
  };

  const saveRefunds = () => {
    if (!canEdit || !refundDraftsValid || staffCentsNext == null || managerCentsNext == null) return;
    onApplyPatch(
      {
        refundLimits: {
          ...refundLimits,
          staffMaxCents: staffCentsNext,
          managerMaxCents: managerCentsNext,
          ownerUnlimited: true
        }
      },
      "Refund permissions updated."
    );
    onClose();
  };

  const savePriceDisplay = () => {
    if (!canEdit || !priceDirty) return;
    onApplyPatch(
      {
        taxDisplay: {
          managedIn: "restaurant_taxes",
          calculation: "backend",
          pricesIncludeTax: priceIncludeDraft
        }
      },
      priceIncludeDraft ? "Menu prices will include tax." : "Tax will be shown separately at checkout."
    );
    onClose();
  };

  const footerDirty = isRefunds ? refundDirty && refundDraftsValid : isPriceDisplay ? priceDirty : false;
  const onSave = isRefunds ? saveRefunds : isPriceDisplay ? savePriceDisplay : undefined;

  return (
    <DetailsDrawerShell
      open={open}
      entityKey={ruleKey}
      kicker="Payment rules"
      title={active.title}
      subtitle={active.description}
      closeLabel={`Close ${active.title}`}
      onClose={closeDrawer}
      overlay={
        pending ? (
          <DrawerConfirm pending={pending} onCancel={onCancelPending} onConfirm={onConfirmPending} />
        ) : null
      }
      footer={
        (isRefunds || isPriceDisplay) && canEdit ? (
          <div className="admin-payments-rule-footer">
            <button type="button" className="admin-profile-modal-btn admin-profile-modal-btn--ghost" onClick={closeDrawer}>
              Cancel
            </button>
            <button
              type="button"
              className="admin-profile-modal-btn admin-profile-modal-btn--primary"
              disabled={!footerDirty}
              onClick={onSave}
            >
              Save changes
            </button>
          </div>
        ) : null
      }
    >
      <div className="admin-payments-rule-drawer">
        {ruleKey === "qr" ? (
          <>
            <RulePanel
              kicker="Guest checkout"
              tipId="adv-qr-checkout-tip"
              tipBody="These choices shape the QR table experience — from scan to paid, with as little friction as you want."
            >
              <PaymentSwitch
                label="Let guests finish paying in the app"
                description="A guest who started on a table QR can complete payment on their phone."
                tipId="adv-qr-switch-app"
                tipBody="Helpful when someone wants Apple Pay, Swish, or a saved card instead of paying at the table."
                checked={qr.allowSwitchToApp}
                disabled={!canEdit}
                onRequestChange={(allowSwitchToApp) =>
                  onRequestConfirm({
                    title: "",
                    copy: allowSwitchToApp
                      ? "Guests scanning a table QR can finish paying in the ServeOS app."
                      : "Guests scanning a table QR will stay on the in-venue payment path.",
                    confirmLabel: allowSwitchToApp ? "Allow" : "Keep at table",
                    apply: () =>
                      onApplyPatch(
                        { qrPolicy: { ...qr, allowSwitchToApp } },
                        allowSwitchToApp ? "Guests can finish paying in the app." : "QR checkout stays at the table."
                      )
                  })
                }
              />
              <PaymentSwitch
                label="Wait for payment before cooking"
                description="The kitchen only starts once the QR order is paid."
                tipId="adv-qr-before-prep"
                tipBody="Best for takeaway-style QR ordering. Turn off if tables should order first and pay later."
                checked={qr.requirePaymentBeforePrep}
                disabled={!canEdit}
                onRequestChange={(requirePaymentBeforePrep) =>
                  onRequestConfirm({
                    title: "",
                    copy: requirePaymentBeforePrep
                      ? "QR orders wait for payment before the kitchen starts cooking."
                      : "The kitchen may start QR orders before payment is complete.",
                    confirmLabel: requirePaymentBeforePrep ? "Wait for payment" : "Allow cooking first",
                    danger: !requirePaymentBeforePrep,
                    apply: () =>
                      onApplyPatch(
                        { qrPolicy: { ...qr, requirePaymentBeforePrep } },
                        requirePaymentBeforePrep
                          ? "QR orders wait for payment before cooking."
                          : "Kitchen may start before QR payment."
                      )
                  })
                }
              />
              <PaymentSwitch
                label="Allow guests to order now and pay later"
                description="QR tables can place an order without paying immediately."
                tipId="adv-qr-unpaid"
                tipBody="Great for dine-in. Combine with staff confirmation if you want a team member to approve unpaid tickets."
                checked={qr.allowUnpaidOrders}
                disabled={!canEdit}
                onRequestChange={(allowUnpaidOrders) =>
                  onRequestConfirm({
                    title: "",
                    copy: allowUnpaidOrders
                      ? "QR guests can place an order and settle the bill later."
                      : "QR guests will need to pay according to your usual checkout rules.",
                    confirmLabel: allowUnpaidOrders ? "Allow pay later" : "Require payment",
                    danger: allowUnpaidOrders,
                    apply: () =>
                      onApplyPatch(
                        { qrPolicy: { ...qr, allowUnpaidOrders } },
                        allowUnpaidOrders ? "QR guests can order now and pay later." : "QR pay-later is off."
                      )
                  })
                }
              />
              <PaymentSwitch
                label="Staff confirm unpaid QR orders"
                description="A team member signs off before an unpaid QR order continues."
                tipId="adv-qr-staff"
                tipBody="Adds a human check so unpaid QR tickets don’t surprise the kitchen."
                checked={qr.requireStaffConfirmation}
                disabled={!canEdit}
                onRequestChange={(requireStaffConfirmation) =>
                  onRequestConfirm({
                    title: "",
                    copy: requireStaffConfirmation
                      ? "Staff will confirm unpaid QR orders before they continue."
                      : "Unpaid QR orders can continue without a staff confirmation step.",
                    confirmLabel: requireStaffConfirmation ? "Ask staff" : "Skip confirmation",
                    apply: () =>
                      onApplyPatch(
                        { qrPolicy: { ...qr, requireStaffConfirmation } },
                        requireStaffConfirmation
                          ? "Staff will confirm unpaid QR orders."
                          : "Staff confirmation is not required."
                      )
                  })
                }
              />
            </RulePanel>
            <RulePanel
              kicker="Open bills"
              tipId="adv-qr-autoclose-tip"
              tipBody="Automatically close QR bills that were never paid, so tables don’t stay open overnight."
            >
              <label className="admin-payments-venue-field">
                <span className="admin-payments-venue-field-label">
                  Close unpaid QR bills after (hours)
                  <PaymentInfoTip
                    tipId="adv-qr-hours"
                    body="Leave empty to keep unpaid QR bills open until your team closes them."
                  />
                </span>
                <AdminInput
                  type="number"
                  disabled={!canEdit}
                  value={autoCloseDraft}
                  placeholder="e.g. 4"
                  onChange={(e) => onAutoCloseDraft(e.target.value)}
                />
              </label>
              {canEdit && autoCloseDraft !== String(qr.autoCloseUnpaidHours ?? "") ? (
                <button
                  type="button"
                  className="admin-payments-message-save"
                  onClick={() => {
                    const autoCloseUnpaidHours =
                      autoCloseDraft.trim() === "" ? null : Number(autoCloseDraft);
                    onRequestConfirm({
                      title: "",
                      copy:
                        autoCloseUnpaidHours == null
                          ? "Unpaid QR bills will stay open until your team closes them."
                          : `Unpaid QR bills will close automatically after ${autoCloseUnpaidHours} hour(s).`,
                      confirmLabel: "Save",
                      apply: () =>
                        onApplyPatch(
                          { qrPolicy: { ...qr, autoCloseUnpaidHours } },
                          "Unpaid QR bill timer updated."
                        )
                    });
                  }}
                >
                  Save hours
                </button>
              ) : null}
            </RulePanel>
          </>
        ) : null}

        {ruleKey === "splits" ? (
          <>
            <PaymentSwitch
              label="Let tables split the bill"
              description="Guests and staff can divide one check into several payments."
              tipId="adv-splits-on"
              tipBody="Perfect for groups. Each part still belongs to the same visit."
              checked={splits.enabled}
              disabled={!canEdit}
              onRequestChange={(enabled) =>
                onRequestConfirm({
                  title: "",
                  copy: enabled
                    ? "Tables will be able to split the bill."
                    : "Split the bill will no longer be offered.",
                  confirmLabel: enabled ? "Turn on" : "Turn off",
                  danger: !enabled,
                  apply: () =>
                    onApplyPatch(
                      { splits: { ...splits, enabled } },
                      enabled ? "Tables can split the bill." : "Split the bill is off."
                    )
                })
              }
            />
            <RulePanel
              kicker="How many ways"
              tipId="adv-splits-max-tip"
              tipBody="A higher number is more flexible for large tables. Keep it practical for your floor."
            >
              <label className="admin-payments-venue-field">
                <span className="admin-payments-venue-field-label">Maximum splits per bill</span>
                <AdminInput
                  type="number"
                  disabled={!canEdit || !splits.enabled}
                  value={maxSplitsDraft}
                  onChange={(e) => onMaxSplitsDraft(e.target.value)}
                />
              </label>
              {canEdit && splits.enabled && maxSplitsDraft !== String(splits.maxSplits) ? (
                <button
                  type="button"
                  className="admin-payments-message-save"
                  onClick={() => {
                    const maxSplits = Math.max(1, Number(maxSplitsDraft) || 1);
                    onRequestConfirm({
                      title: "",
                      copy: `A bill can be split into up to ${maxSplits} payments.`,
                      confirmLabel: "Save",
                      apply: () =>
                        onApplyPatch({ splits: { ...splits, maxSplits } }, `Bills can be split up to ${maxSplits} ways.`)
                    });
                  }}
                >
                  Save limit
                </button>
              ) : null}
            </RulePanel>
            <RulePanel
              kicker="Split styles"
              tipId="adv-splits-styles-tip"
              tipBody="Turn on the split styles your guests actually use. You can offer more than one."
            >
              <div className="admin-payments-venue-check-grid" role="group" aria-label="Split styles">
                {SPLIT_OPTIONS.map((opt) => (
                  <CheckOption
                    key={opt.key}
                    label={opt.label}
                    tipId={`adv-split-${opt.key}`}
                    tipBody={opt.tip}
                    checked={splits[opt.key]}
                    disabled={!canEdit || !splits.enabled}
                    onToggle={(on) =>
                      onRequestConfirm({
                        title: "",
                        copy: on
                          ? `${opt.label} will be available when splitting a bill.`
                          : `${opt.label} will no longer be offered.`,
                        confirmLabel: on ? "Turn on" : "Turn off",
                        apply: () =>
                          onApplyPatch(
                            { splits: { ...splits, [opt.key]: on } },
                            on ? `${opt.label} is on.` : `${opt.label} is off.`
                          )
                      })
                    }
                  />
                ))}
              </div>
            </RulePanel>
          </>
        ) : null}

        {ruleKey === "tips" ? (
          <>
            <PaymentSwitch
              label="Ask for tips"
              description="Guests see tip options at checkout. Tips stay separate from food sales."
              tipId="adv-tips-on"
              tipBody="Suggested amounts help guests tip quickly. You can still allow a custom amount."
              checked={tips.enabled}
              disabled={!canEdit}
              onRequestChange={(enabled) =>
                onRequestConfirm({
                  title: "",
                  copy: enabled
                    ? "Guests will see tip options at checkout."
                    : "Tip prompts will be hidden for this venue.",
                  confirmLabel: enabled ? "Turn on" : "Turn off",
                  danger: !enabled,
                  apply: () =>
                    onApplyPatch(
                      {
                        tips: { ...tips, enabled },
                        taxes: { ...taxes, tipsEnabled: enabled }
                      },
                      enabled ? "Tip options are on." : "Tip options are hidden."
                    )
                })
              }
            />
            <RulePanel
              kicker="Suggested amounts"
              tipId="adv-tips-presets-tip"
              tipBody="Pick the percentages that feel right for your venue. Guests tap one and move on."
            >
              <div className="admin-payments-venue-check-grid" role="group" aria-label="Suggested tip amounts">
                {TIP_PRESETS.map((pct) => {
                  const active = tips.suggestedPercents.includes(pct);
                  return (
                    <CheckOption
                      key={pct}
                      label={`${pct}%`}
                      tipId={`adv-tip-${pct}`}
                      tipBody={`Offer ${pct}% as a one-tap tip suggestion.`}
                      checked={active}
                      disabled={!canEdit || !tips.enabled}
                      onToggle={(on) =>
                        onRequestConfirm({
                          title: "",
                          copy: on
                            ? `${pct}% will appear as a suggested tip.`
                            : `${pct}% will be removed from suggested tips.`,
                          confirmLabel: on ? "Add" : "Remove",
                          apply: () => {
                            const suggestedPercents = on
                              ? [...new Set([...tips.suggestedPercents, pct])].sort((a, b) => a - b)
                              : tips.suggestedPercents.filter((n) => n !== pct);
                            onApplyPatch(
                              { tips: { ...tips, suggestedPercents } },
                              on ? `${pct}% tip added.` : `${pct}% tip removed.`
                            );
                          }
                        })
                      }
                    />
                  );
                })}
              </div>
              <CustomTipAmount
                percents={tips.suggestedPercents}
                disabled={!canEdit || !tips.enabled}
                onRequestConfirm={onRequestConfirm}
                onApply={(suggestedPercents, message) =>
                  onApplyPatch({ tips: { ...tips, suggestedPercents } }, message)
                }
              />
            </RulePanel>
            <RulePanel kicker="When and how">
              <PaymentSwitch
                label="Let guests type their own tip"
                description="Anyone can enter an amount instead of picking a percentage."
                tipId="adv-tips-custom"
                tipBody="Useful for regulars or large groups who want a round number."
                checked={tips.customTip}
                disabled={!canEdit || !tips.enabled}
                onRequestChange={(customTip) =>
                  onRequestConfirm({
                    title: "",
                    copy: customTip
                      ? "Guests can enter any tip amount."
                      : "Guests can only pick the suggested percentages.",
                    confirmLabel: customTip ? "Allow" : "Suggested only",
                    apply: () =>
                      onApplyPatch(
                        { tips: { ...tips, customTip } },
                        customTip ? "Guests can type their own tip." : "Only suggested tips are shown."
                      )
                  })
                }
              />
              <PaymentSwitch
                label="Ask for a tip before they pay"
                description="The tip is added as part of checkout."
                tipId="adv-tips-before"
                tipBody="Most QR and card checkouts use this — one payment, tip included."
                checked={tips.tipBeforePayment}
                disabled={!canEdit || !tips.enabled}
                onRequestChange={(tipBeforePayment) =>
                  onRequestConfirm({
                    title: "",
                    copy: tipBeforePayment
                      ? "Guests can add a tip before they pay."
                      : "Tip-before-payment will be hidden.",
                    confirmLabel: tipBeforePayment ? "Ask before" : "Hide",
                    apply: () =>
                      onApplyPatch(
                        { tips: { ...tips, tipBeforePayment } },
                        tipBeforePayment ? "Tip is asked before payment." : "Tip before payment is hidden."
                      )
                  })
                }
              />
              <PaymentSwitch
                label="Ask for a tip after they pay"
                description="Guests can add a tip once the main bill is paid."
                tipId="adv-tips-after"
                tipBody="Nice for table service when the bill is settled first, then a tip is added."
                checked={tips.tipAfterPayment}
                disabled={!canEdit || !tips.enabled}
                onRequestChange={(tipAfterPayment) =>
                  onRequestConfirm({
                    title: "",
                    copy: tipAfterPayment
                      ? "Guests can add a tip after the main payment."
                      : "Tip-after-payment will be hidden.",
                    confirmLabel: tipAfterPayment ? "Ask after" : "Hide",
                    apply: () =>
                      onApplyPatch(
                        { tips: { ...tips, tipAfterPayment } },
                        tipAfterPayment ? "Tip can be added after payment." : "Tip after payment is hidden."
                      )
                  })
                }
              />
              <PaymentExpandSelect
                label="Cash tips"
                value={tips.cashTipsMode}
                options={CASH_TIPS_OPTIONS}
                disabled={!canEdit || !tips.enabled}
                onRequestChange={(next) => {
                  const cashTipsMode = next as Tips["cashTipsMode"];
                  const label = CASH_TIPS_OPTIONS.find((o) => o.value === cashTipsMode)?.label ?? cashTipsMode;
                  onRequestConfirm({
                    title: "",
                    copy: `Cash tips will be set to “${label}”.`,
                    confirmLabel: "Save",
                    apply: () =>
                      onApplyPatch({ tips: { ...tips, cashTipsMode } }, `Cash tips set to ${label}.`)
                  });
                }}
              />
            </RulePanel>
          </>
        ) : null}

        {ruleKey === "failed" ? (
          <RulePanel
            kicker="If payment doesn’t go through"
            tipId="adv-failed-tip"
            tipBody="These rules protect the kitchen and still give guests a way to try again."
          >
            <PaymentSwitch
              label="Keep the order open"
              description="A failed payment doesn’t cancel the visit — the bill stays unpaid."
              tipId="adv-failed-unpaid"
              tipBody="Guests or staff can finish payment without starting over."
              checked={failed.remainUnpaid}
              disabled={!canEdit}
              onRequestChange={(remainUnpaid) =>
                onRequestConfirm({
                  title: "",
                  copy: remainUnpaid
                    ? "If payment fails, the order stays open so someone can try again."
                    : "Failed payments will no longer keep the order open automatically.",
                  confirmLabel: "Save",
                  apply: () =>
                    onApplyPatch(
                      { failedPayment: { ...failed, remainUnpaid } },
                      remainUnpaid ? "Failed orders stay open." : "Keep-open rule is off."
                    )
                })
              }
            />
            <PaymentSwitch
              label="Let guests try again"
              description="Show a simple retry after a failed charge."
              tipId="adv-failed-retry"
              tipBody="Most venues want this on — one tap and the guest can use another card."
              checked={failed.allowRetry}
              disabled={!canEdit}
              onRequestChange={(allowRetry) =>
                onRequestConfirm({
                  title: "",
                  copy: allowRetry
                    ? "Guests can try again after a failed payment."
                    : "Guests will not see a retry after a failed payment.",
                  confirmLabel: allowRetry ? "Allow retry" : "Hide retry",
                  danger: !allowRetry,
                  apply: () =>
                    onApplyPatch(
                      { failedPayment: { ...failed, allowRetry } },
                      allowRetry ? "Guests can retry payment." : "Payment retry is hidden."
                    )
                })
              }
            />
            <PaymentSwitch
              label="Don’t send to kitchen until payment succeeds"
              description="Protects prep when guests pay first."
              tipId="adv-failed-kitchen"
              tipBody="Stops food going out when a pay-first attempt fails."
              checked={failed.blockKitchen}
              disabled={!canEdit}
              onRequestChange={(blockKitchen) =>
                onRequestConfirm({
                  title: "",
                  copy: blockKitchen
                    ? "The kitchen will wait until payment succeeds."
                    : "The kitchen may start even if payment failed.",
                  confirmLabel: blockKitchen ? "Wait for payment" : "Allow cooking",
                  danger: !blockKitchen,
                  apply: () =>
                    onApplyPatch(
                      { failedPayment: { ...failed, blockKitchen } },
                      blockKitchen ? "Kitchen waits for successful payment." : "Kitchen may start after a failed payment."
                    )
                })
              }
            />
            <PaymentSwitch
              label="Let staff accept the order anyway"
              description="A manager or server can take the risk and send it through."
              tipId="adv-failed-staff"
              tipBody="Use this for VIPs or known regulars. Staff choose when to override."
              checked={failed.allowStaffAcceptUnpaid}
              disabled={!canEdit}
              onRequestChange={(allowStaffAcceptUnpaid) =>
                onRequestConfirm({
                  title: "",
                  copy: allowStaffAcceptUnpaid
                    ? "Staff can accept an order even when payment failed."
                    : "Staff cannot accept unpaid orders after a failed payment.",
                  confirmLabel: allowStaffAcceptUnpaid ? "Allow" : "Don’t allow",
                  danger: allowStaffAcceptUnpaid,
                  apply: () =>
                    onApplyPatch(
                      { failedPayment: { ...failed, allowStaffAcceptUnpaid } },
                      allowStaffAcceptUnpaid
                        ? "Staff may accept unpaid orders."
                        : "Staff cannot accept unpaid orders after failure."
                    )
                })
              }
            />
          </RulePanel>
        ) : null}

        {ruleKey === "refunds" ? (
          <div className="admin-payments-refund-roles">
            <RefundRoleCard role="Staff">
              <RefundKronorField
                label="Maximum refund amount"
                value={staffMaxDraft}
                disabled={!canEdit}
                helper={
                  staffKronorDraft != null
                    ? `Staff can refund up to ${formatKronorWithUnit(staffKronorDraft)} without approval.`
                    : "Enter a whole amount in kronor."
                }
                onChange={onStaffMaxDraft}
              />
            </RefundRoleCard>
            <RefundRoleCard role="Manager">
              <RefundKronorField
                label="Maximum refund amount"
                value={managerMaxDraft}
                disabled={!canEdit}
                helper={
                  managerKronorDraft != null
                    ? `Managers can refund up to ${formatKronorWithUnit(managerKronorDraft)} without approval.`
                    : "Enter a whole amount in kronor."
                }
                onChange={onManagerMaxDraft}
              />
            </RefundRoleCard>
            <RefundRoleCard role="Owner">
              <div className="admin-payments-refund-owner">
                <p className="admin-payments-refund-owner-title">
                  <span className="admin-payments-refund-owner-dot" aria-hidden />
                  No refund limit
                </p>
                <p className="admin-payments-refund-owner-copy">Owners can refund any amount.</p>
              </div>
            </RefundRoleCard>
          </div>
        ) : null}

        {ruleKey === "tax" ? (
          <div className="admin-payments-price-display">
            <p className="admin-payments-price-question">How should prices be displayed?</p>
            <div className="admin-payments-price-cards" role="radiogroup" aria-label="How should prices be displayed?">
              {PRICE_DISPLAY_OPTIONS.map((option) => (
                <PriceDisplayCard
                  key={option.title}
                  title={option.title}
                  body={option.body}
                  example={option.example}
                  selected={priceIncludeDraft === option.includeTax}
                  disabled={!canEdit}
                  onSelect={() => setPriceIncludeDraft(option.includeTax)}
                />
              ))}
            </div>
            <div className="admin-payments-price-tax-note">
              <div className="admin-payments-price-tax-note-copy">
                <p className="admin-payments-price-tax-note-kicker">Tax rates</p>
                <p>
                  Tax rates and product tax rules are managed in Restaurant → Taxes. Changes to tax rates are applied
                  separately from this display setting.
                </p>
              </div>
              <a
                className="admin-payments-price-tax-note-link"
                href={ADMIN_VENUE_CONTROL_HASH}
                onClick={closeDrawer}
              >
                Manage tax settings
              </a>
            </div>
          </div>
        ) : null}
      </div>
    </DetailsDrawerShell>
  );
}
