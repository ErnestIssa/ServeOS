import type { VenuePaymentSettings } from "../../../api";
import { AdminInput, AdminLabel } from "../../AdminUi";
import { PaySection, ToggleRow } from "./paymentsShared";
import { PAY_AT_VENUE_TIMING_OPTIONS } from "./paymentsUiHelpers";

type Props = {
  settings: VenuePaymentSettings;
  canEdit: boolean;
  onPatch: (patch: Partial<VenuePaymentSettings>) => void;
};

export function PaymentsRulesTab({ settings, canEdit, onPatch }: Props) {
  const payAtVenue = settings.payAtVenue ?? {
    enabled: true,
    timing: "when_bill_requested" as const,
    channels: { qrOrders: true, walkIns: true, staffCreated: true, reservations: true, delivery: false },
    settlementMethods: { cash: true, cardTerminal: true, swish: true, other: false }
  };
  const qr = settings.qrPolicy ?? {
    defaultPaymentMode: "PAY_AT_VENUE" as const,
    allowSwitchToApp: true,
    requirePaymentBeforePrep: false,
    allowUnpaidOrders: true,
    autoCloseUnpaidHours: 4,
    requireStaffConfirmation: false
  };
  const splits = settings.splits ?? {
    enabled: true,
    maxSplits: 10,
    allowCustomerSelfSplit: true,
    allowStaffSplit: true,
    allowEqualSplit: true,
    allowItemBasedSplit: true,
    allowCustomAmount: true
  };
  const tips = settings.tips ?? {
    enabled: true,
    suggestedPercents: [10, 15, 20],
    customTip: true,
    tipBeforePayment: true,
    tipAfterPayment: true,
    cashTipsMode: "track_manually" as const
  };
  const failed = settings.failedPayment ?? {
    remainUnpaid: true,
    allowRetry: true,
    blockKitchen: true,
    allowStaffAcceptUnpaid: false
  };
  const refundLimits = settings.refundLimits ?? {
    staffMaxCents: 20_000,
    managerMaxCents: 500_000,
    ownerUnlimited: true
  };

  return (
    <div className="admin-payments-tab-stack">
      <PaySection title="Default payment mode" description="Consumed by Order Engine + QR sessions.">
        <label className="grid gap-1 max-w-sm">
          <AdminLabel>Default mode</AdminLabel>
          <select
            className="admin-payments-select"
            disabled={!canEdit}
            value={settings.rules.defaultPaymentMode}
            onChange={(e) =>
              onPatch({
                rules: {
                  ...settings.rules,
                  defaultPaymentMode: e.target.value as VenuePaymentSettings["rules"]["defaultPaymentMode"]
                }
              })
            }
          >
            <option value="PAY_AT_VENUE">Pay at venue</option>
            <option value="PREPAY">Pay in app (prepay)</option>
            <option value="HYBRID">Hybrid</option>
          </select>
        </label>
        <div className="mt-3 grid gap-2">
          <ToggleRow
            label="Payment required before preparation (online)"
            checked={settings.rules.payBeforeOrder}
            disabled={!canEdit}
            onChange={(v) => onPatch({ rules: { ...settings.rules, payBeforeOrder: v } })}
          />
          <ToggleRow
            label="Pay after meal (pay at venue path)"
            checked={settings.rules.payAfterMeal}
            disabled={!canEdit}
            onChange={(v) => onPatch({ rules: { ...settings.rules, payAfterMeal: v } })}
          />
          <ToggleRow
            label="Deposit required"
            checked={settings.rules.depositRequired}
            disabled={!canEdit}
            onChange={(v) => onPatch({ rules: { ...settings.rules, depositRequired: v } })}
          />
        </div>
      </PaySection>

      <PaySection title="Pay at venue timing" description="When settlement is expected for unpaid QR / venue orders.">
        <div className="admin-payments-radio-list">
          {PAY_AT_VENUE_TIMING_OPTIONS.map((opt) => (
            <label key={opt.value} className="admin-payments-radio-row">
              <input
                type="radio"
                name="pay-at-venue-timing"
                disabled={!canEdit}
                checked={payAtVenue.timing === opt.value}
                onChange={() => onPatch({ payAtVenue: { ...payAtVenue, timing: opt.value } })}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
        <div className="mt-4 grid gap-2">
          <p className="text-xs font-bold uppercase tracking-wide admin-config-text-muted">Who can use it</p>
          {(
            [
              ["qrOrders", "QR orders"],
              ["walkIns", "Walk-ins"],
              ["staffCreated", "Staff-created orders"],
              ["reservations", "Reservations"],
              ["delivery", "Delivery"]
            ] as const
          ).map(([key, label]) => (
            <ToggleRow
              key={key}
              label={label}
              checked={payAtVenue.channels[key]}
              disabled={!canEdit}
              onChange={(v) =>
                onPatch({ payAtVenue: { ...payAtVenue, channels: { ...payAtVenue.channels, [key]: v } } })
              }
            />
          ))}
        </div>
      </PaySection>

      <PaySection title="QR payment policy" description="Must stay aligned with Order Engine + Payment Engine.">
        <div className="grid gap-2">
          <ToggleRow
            label="Allow customer to switch to pay in app"
            checked={qr.allowSwitchToApp}
            disabled={!canEdit}
            onChange={(v) => onPatch({ qrPolicy: { ...qr, allowSwitchToApp: v } })}
          />
          <ToggleRow
            label="Require payment before preparation"
            checked={qr.requirePaymentBeforePrep}
            disabled={!canEdit}
            onChange={(v) => onPatch({ qrPolicy: { ...qr, requirePaymentBeforePrep: v } })}
          />
          <ToggleRow
            label="Allow unpaid orders"
            checked={qr.allowUnpaidOrders}
            disabled={!canEdit}
            onChange={(v) => onPatch({ qrPolicy: { ...qr, allowUnpaidOrders: v } })}
          />
          <ToggleRow
            label="Require staff confirmation"
            checked={qr.requireStaffConfirmation}
            disabled={!canEdit}
            onChange={(v) => onPatch({ qrPolicy: { ...qr, requireStaffConfirmation: v } })}
          />
          <label className="grid gap-1 max-w-xs mt-2">
            <AdminLabel>Auto-close unpaid orders (hours)</AdminLabel>
            <AdminInput
              type="number"
              disabled={!canEdit}
              value={qr.autoCloseUnpaidHours ?? ""}
              onChange={(e) =>
                onPatch({
                  qrPolicy: {
                    ...qr,
                    autoCloseUnpaidHours: e.target.value === "" ? null : Number(e.target.value)
                  }
                })
              }
            />
          </label>
        </div>
      </PaySection>

      <PaySection title="Split payments" description="Each split links to the same order in the payment ledger.">
        <div className="grid gap-2">
          <ToggleRow
            label="Split payments enabled"
            checked={splits.enabled}
            disabled={!canEdit}
            onChange={(v) => onPatch({ splits: { ...splits, enabled: v } })}
          />
          <label className="grid gap-1 max-w-xs">
            <AdminLabel>Maximum splits</AdminLabel>
            <AdminInput
              type="number"
              disabled={!canEdit || !splits.enabled}
              value={splits.maxSplits}
              onChange={(e) => onPatch({ splits: { ...splits, maxSplits: Number(e.target.value) || 1 } })}
            />
          </label>
          <ToggleRow label="Allow customer self-split" checked={splits.allowCustomerSelfSplit} disabled={!canEdit || !splits.enabled} onChange={(v) => onPatch({ splits: { ...splits, allowCustomerSelfSplit: v } })} />
          <ToggleRow label="Allow staff split" checked={splits.allowStaffSplit} disabled={!canEdit || !splits.enabled} onChange={(v) => onPatch({ splits: { ...splits, allowStaffSplit: v } })} />
          <ToggleRow label="Allow equal split" checked={splits.allowEqualSplit} disabled={!canEdit || !splits.enabled} onChange={(v) => onPatch({ splits: { ...splits, allowEqualSplit: v } })} />
          <ToggleRow label="Allow item-based split" checked={splits.allowItemBasedSplit} disabled={!canEdit || !splits.enabled} onChange={(v) => onPatch({ splits: { ...splits, allowItemBasedSplit: v } })} />
          <ToggleRow label="Allow custom amount" checked={splits.allowCustomAmount} disabled={!canEdit || !splits.enabled} onChange={(v) => onPatch({ splits: { ...splits, allowCustomAmount: v } })} />
        </div>
      </PaySection>

      <PaySection title="Tips" description="Tips stay in their own accounting category — never mixed into item revenue.">
        <div className="grid gap-2">
          <ToggleRow label="Tips enabled" checked={tips.enabled} disabled={!canEdit} onChange={(v) => onPatch({ tips: { ...tips, enabled: v }, taxes: { ...settings.taxes, tipsEnabled: v } })} />
          <label className="grid gap-1 max-w-md">
            <AdminLabel>Suggested tips (%)</AdminLabel>
            <AdminInput
              disabled={!canEdit || !tips.enabled}
              value={tips.suggestedPercents.join(", ")}
              onChange={(e) =>
                onPatch({
                  tips: {
                    ...tips,
                    suggestedPercents: e.target.value
                      .split(",")
                      .map((s) => Number(s.trim()))
                      .filter((n) => Number.isFinite(n))
                  }
                })
              }
            />
          </label>
          <ToggleRow label="Custom tip" checked={tips.customTip} disabled={!canEdit || !tips.enabled} onChange={(v) => onPatch({ tips: { ...tips, customTip: v } })} />
          <ToggleRow label="Tip before payment" checked={tips.tipBeforePayment} disabled={!canEdit || !tips.enabled} onChange={(v) => onPatch({ tips: { ...tips, tipBeforePayment: v } })} />
          <ToggleRow label="Tip after payment" checked={tips.tipAfterPayment} disabled={!canEdit || !tips.enabled} onChange={(v) => onPatch({ tips: { ...tips, tipAfterPayment: v } })} />
        </div>
      </PaySection>

      <PaySection title="Failed payment behavior">
        <div className="grid gap-2">
          <ToggleRow label="Order remains unpaid" checked={failed.remainUnpaid} disabled={!canEdit} onChange={(v) => onPatch({ failedPayment: { ...failed, remainUnpaid: v } })} />
          <ToggleRow label="Customer can retry" checked={failed.allowRetry} disabled={!canEdit} onChange={(v) => onPatch({ failedPayment: { ...failed, allowRetry: v } })} />
          <ToggleRow label="Kitchen does not start" checked={failed.blockKitchen} disabled={!canEdit} onChange={(v) => onPatch({ failedPayment: { ...failed, blockKitchen: v } })} />
          <ToggleRow label="Allow staff to accept unpaid orders" checked={failed.allowStaffAcceptUnpaid} disabled={!canEdit} onChange={(v) => onPatch({ failedPayment: { ...failed, allowStaffAcceptUnpaid: v } })} />
        </div>
      </PaySection>

      <PaySection title="Refund limits" description="Enforced by backend authorization — not the browser.">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="grid gap-1">
            <AdminLabel>Staff max (öre)</AdminLabel>
            <AdminInput
              type="number"
              disabled={!canEdit}
              value={refundLimits.staffMaxCents}
              onChange={(e) => onPatch({ refundLimits: { ...refundLimits, staffMaxCents: Number(e.target.value) || 0 } })}
            />
          </label>
          <label className="grid gap-1">
            <AdminLabel>Manager max (öre)</AdminLabel>
            <AdminInput
              type="number"
              disabled={!canEdit}
              value={refundLimits.managerMaxCents}
              onChange={(e) => onPatch({ refundLimits: { ...refundLimits, managerMaxCents: Number(e.target.value) || 0 } })}
            />
          </label>
          <ToggleRow
            label="Owner unlimited"
            checked={refundLimits.ownerUnlimited}
            disabled={!canEdit}
            onChange={(v) => onPatch({ refundLimits: { ...refundLimits, ownerUnlimited: v } })}
          />
        </div>
      </PaySection>

      <PaySection title="Tax configuration" description="Detailed tax rules live under Restaurant → Taxes.">
        <div className="admin-payments-kv">
          <span>Managed in</span>
          <strong>Restaurant → Taxes</strong>
        </div>
        <div className="admin-payments-kv">
          <span>Orders</span>
          <strong>{settings.taxDisplay?.pricesIncludeTax ? "Prices include tax" : "Prices exclude tax"}</strong>
        </div>
        <div className="admin-payments-kv">
          <span>Tax calculation</span>
          <strong>Backend</strong>
        </div>
      </PaySection>
    </div>
  );
}
