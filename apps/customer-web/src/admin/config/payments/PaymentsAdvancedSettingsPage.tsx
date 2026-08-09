import type { PaymentProviderEnvReady, VenuePaymentSettings } from "../../../api";
import { AdminBtnPrimary, AdminBtnSecondary, AdminInput, AdminLabel } from "../../AdminUi";
import { PayChip, PaySection, ToggleRow } from "./paymentsShared";
import { formatWhen } from "./paymentsUiHelpers";

type Props = {
  settings: VenuePaymentSettings;
  envReady: PaymentProviderEnvReady | null;
  canEdit: boolean;
  saving: boolean;
  onBack: () => void;
  onPatch: (patch: Partial<VenuePaymentSettings>) => void;
  onSave: () => void;
};

export function PaymentsAdvancedSettingsPage({
  settings,
  envReady,
  canEdit,
  saving,
  onBack,
  onPatch,
  onSave
}: Props) {
  const audit = settings.auditLog ?? [];
  const refundLimits = settings.refundLimits ?? {
    staffMaxCents: 20_000,
    managerMaxCents: 500_000,
    ownerUnlimited: true
  };
  const failed = settings.failedPayment ?? {
    remainUnpaid: true,
    allowRetry: true,
    blockKitchen: true,
    allowStaffAcceptUnpaid: false
  };

  return (
    <div className="admin-payments-advanced-page">
      <header className="admin-payments-advanced-page-hero">
        <div className="min-w-0">
          <button type="button" className="admin-payments-advanced-back" onClick={onBack}>
            ← Back to Payments
          </button>
          <h2 className="admin-payments-advanced-page-title">Advanced settings</h2>
          <p className="admin-payments-advanced-page-desc">
            Order limits, refund timing, failed-payment behavior, provider environment, tax pointer, and
            configuration audit. Backend remains the source of truth.
          </p>
        </div>
        <div className="admin-payments-advanced-page-actions">
          <AdminBtnSecondary type="button" onClick={onBack}>
            Cancel
          </AdminBtnSecondary>
          {canEdit ? (
            <AdminBtnPrimary type="button" disabled={saving} onClick={onSave}>
              {saving ? "Saving…" : "Save changes"}
            </AdminBtnPrimary>
          ) : null}
        </div>
      </header>

      <div className="admin-payments-advanced-page-grid">
        <PaySection title="Order limits" description="Hard bounds enforced when checkout starts.">
          <div className="admin-payments-advanced-fields">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1">
                <AdminLabel>Minimum order (öre)</AdminLabel>
                <AdminInput
                  type="number"
                  disabled={!canEdit}
                  value={settings.rules.minOrderCents ?? ""}
                  onChange={(e) =>
                    onPatch({
                      rules: {
                        ...settings.rules,
                        minOrderCents: e.target.value === "" ? null : Number(e.target.value)
                      }
                    })
                  }
                />
              </label>
              <label className="grid gap-1">
                <AdminLabel>Maximum order (öre)</AdminLabel>
                <AdminInput
                  type="number"
                  disabled={!canEdit}
                  value={settings.rules.maxOrderCents ?? ""}
                  onChange={(e) =>
                    onPatch({
                      rules: {
                        ...settings.rules,
                        maxOrderCents: e.target.value === "" ? null : Number(e.target.value)
                      }
                    })
                  }
                />
              </label>
            </div>
            <ToggleRow
              label="Deposit required"
              description="Require a deposit before the order is accepted."
              checked={settings.rules.depositRequired}
              disabled={!canEdit}
              onChange={(v) => onPatch({ rules: { ...settings.rules, depositRequired: v } })}
            />
          </div>
        </PaySection>

        <PaySection title="Refund timing & policy" description="How long refunds stay open and how they are processed.">
          <div className="admin-payments-advanced-fields">
            <label className="grid gap-1 max-w-xs">
              <AdminLabel>Refund timeout (hours)</AdminLabel>
              <AdminInput
                type="number"
                disabled={!canEdit}
                value={settings.refunds.refundTimeoutHours}
                onChange={(e) =>
                  onPatch({
                    refunds: {
                      ...settings.refunds,
                      refundTimeoutHours: Number(e.target.value) || 0
                    }
                  })
                }
              />
            </label>
            <ToggleRow
              label="Manager approval required"
              checked={settings.refunds.managerApproval}
              disabled={!canEdit}
              onChange={(v) => onPatch({ refunds: { ...settings.refunds, managerApproval: v } })}
            />
            <ToggleRow
              label="Automatic refunds"
              checked={settings.refunds.automaticRefund}
              disabled={!canEdit}
              onChange={(v) => onPatch({ refunds: { ...settings.refunds, automaticRefund: v } })}
            />
            <ToggleRow
              label="Manual refunds"
              checked={settings.refunds.manualRefund}
              disabled={!canEdit}
              onChange={(v) => onPatch({ refunds: { ...settings.refunds, manualRefund: v } })}
            />
          </div>
        </PaySection>

        <PaySection title="Refund limits" description="Enforced by backend authorization — not the browser.">
          <div className="admin-payments-advanced-fields">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1">
                <AdminLabel>Staff max (öre)</AdminLabel>
                <AdminInput
                  type="number"
                  disabled={!canEdit}
                  value={refundLimits.staffMaxCents}
                  onChange={(e) =>
                    onPatch({
                      refundLimits: { ...refundLimits, staffMaxCents: Number(e.target.value) || 0 }
                    })
                  }
                />
              </label>
              <label className="grid gap-1">
                <AdminLabel>Manager max (öre)</AdminLabel>
                <AdminInput
                  type="number"
                  disabled={!canEdit}
                  value={refundLimits.managerMaxCents}
                  onChange={(e) =>
                    onPatch({
                      refundLimits: { ...refundLimits, managerMaxCents: Number(e.target.value) || 0 }
                    })
                  }
                />
              </label>
            </div>
            <ToggleRow
              label="Owner unlimited"
              checked={refundLimits.ownerUnlimited}
              disabled={!canEdit}
              onChange={(v) => onPatch({ refundLimits: { ...refundLimits, ownerUnlimited: v } })}
            />
          </div>
        </PaySection>

        <PaySection title="Failed payment behavior" description="What happens when a guest payment fails.">
          <div className="admin-payments-advanced-fields">
            <ToggleRow
              label="Order remains unpaid"
              checked={failed.remainUnpaid}
              disabled={!canEdit}
              onChange={(v) => onPatch({ failedPayment: { ...failed, remainUnpaid: v } })}
            />
            <ToggleRow
              label="Customer can retry"
              checked={failed.allowRetry}
              disabled={!canEdit}
              onChange={(v) => onPatch({ failedPayment: { ...failed, allowRetry: v } })}
            />
            <ToggleRow
              label="Kitchen does not start"
              checked={failed.blockKitchen}
              disabled={!canEdit}
              onChange={(v) => onPatch({ failedPayment: { ...failed, blockKitchen: v } })}
            />
            <ToggleRow
              label="Allow staff to accept unpaid orders"
              checked={failed.allowStaffAcceptUnpaid}
              disabled={!canEdit}
              onChange={(v) => onPatch({ failedPayment: { ...failed, allowStaffAcceptUnpaid: v } })}
            />
          </div>
        </PaySection>

        <PaySection
          title="Provider environment"
          description="Live charges require server secrets. Account IDs stay masked in Providers."
        >
          <div className="admin-payments-advanced-fields">
            <div className="flex flex-wrap gap-2">
              <PayChip tone={envReady?.stripe ? "success" : "warning"}>
                Stripe {envReady?.stripe ? "keys ready" : "sandbox / pending keys"}
              </PayChip>
              <PayChip tone={envReady?.swish ? "success" : "warning"}>
                Swish {envReady?.swish ? "keys ready" : "sandbox / pending keys"}
              </PayChip>
              <PayChip tone={envReady?.webhook ? "success" : "warning"}>
                Webhooks {envReady?.webhook ? "ready" : "pending secret"}
              </PayChip>
            </div>
            <p className="admin-config-text-subtle text-sm">
              Configure <code>STRIPE_*</code>, <code>SWISH_*</code>, and <code>PAYMENT_WEBHOOK_SECRET</code> in
              the API environment. Never store card numbers, CVV, or provider secret keys in ServeOS.
            </p>
            <div className="admin-payments-kv px-0">
              <span>Bank linked</span>
              <PayChip tone={settings.bankAccount.linked ? "success" : "muted"}>
                {settings.bankAccount.linked
                  ? `•••• ${settings.bankAccount.lastFour ?? "————"}`
                  : "Not linked"}
              </PayChip>
            </div>
          </div>
        </PaySection>

        <PaySection title="Tax configuration" description="Detailed tax rules stay under Restaurant → Taxes.">
          <div className="admin-payments-advanced-fields">
            <div className="admin-payments-kv px-0">
              <span>Managed in</span>
              <strong>Restaurant → Taxes</strong>
            </div>
            <div className="admin-payments-kv px-0">
              <span>Orders</span>
              <strong>
                {settings.taxDisplay?.pricesIncludeTax !== false
                  ? "Prices include tax"
                  : "Prices exclude tax"}
              </strong>
            </div>
            <div className="admin-payments-kv px-0">
              <span>Tax calculation</span>
              <strong>Backend</strong>
            </div>
            <label className="grid gap-1 max-w-xs">
              <AdminLabel>VAT display % (legacy field)</AdminLabel>
              <AdminInput
                type="number"
                disabled={!canEdit}
                value={settings.taxes.vatStandardPercent}
                onChange={(e) =>
                  onPatch({
                    taxes: { ...settings.taxes, vatStandardPercent: Number(e.target.value) || 0 }
                  })
                }
              />
            </label>
            <label className="grid gap-1 max-w-xs">
              <AdminLabel>Service fee %</AdminLabel>
              <AdminInput
                type="number"
                disabled={!canEdit}
                value={settings.taxes.serviceFeePercent}
                onChange={(e) =>
                  onPatch({
                    taxes: { ...settings.taxes, serviceFeePercent: Number(e.target.value) || 0 }
                  })
                }
              />
            </label>
          </div>
        </PaySection>

        <PaySection
          title="Security"
          description="Payment success is only trusted from signed provider webhooks."
        >
          <div className="admin-payments-advanced-fields">
            <ul className="admin-payments-security-list">
              <li>No raw card numbers, CVV, or provider secrets stored</li>
              <li>Tenant isolation + permission checks on every mutation</li>
              <li>Webhook signature verification when secrets are configured</li>
              <li>Idempotent refunds and webhook replay protection</li>
              <li>Configuration changes written to the payment audit log</li>
            </ul>
          </div>
        </PaySection>

        <PaySection title="Configuration audit" description="Recent payment policy changes for this venue.">
          <div className="admin-payments-advanced-fields">
            {audit.length === 0 ? (
              <p className="admin-config-text-muted text-sm">No configuration changes logged yet.</p>
            ) : (
              <ul className="admin-payments-advanced-audit">
                {audit.slice(0, 40).map((entry) => (
                  <li key={entry.id}>
                    <div className="min-w-0">
                      <span className="font-semibold">{entry.action.replace(/_/g, " ")}</span>
                      {entry.path ? (
                        <span className="admin-config-text-subtle block text-xs mt-0.5">{entry.path}</span>
                      ) : null}
                      {entry.actorRole ? (
                        <span className="admin-config-text-subtle block text-xs">{entry.actorRole}</span>
                      ) : null}
                    </div>
                    <span>{formatWhen(entry.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </PaySection>
      </div>
    </div>
  );
}
