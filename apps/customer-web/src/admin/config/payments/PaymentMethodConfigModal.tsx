import { useEffect, useState } from "react";
import type { PaymentMethodConfig } from "../../../api";
import { AdminInput, AdminLabel } from "../../AdminUi";
import { MenuPageModalShell, ProfileModalFooter } from "../menu/menuPageModalShell";
import { methodLabel } from "./paymentsUiHelpers";

type Props = {
  open: boolean;
  methodKey: string | null;
  config: PaymentMethodConfig | null;
  canEdit: boolean;
  onClose: () => void;
  onSave: (methodKey: string, config: PaymentMethodConfig) => void;
};

export function PaymentMethodConfigModal({ open, methodKey, config, canEdit, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<PaymentMethodConfig | null>(null);

  useEffect(() => {
    if (open && config) setDraft({ ...config, currencies: [...config.currencies] });
  }, [open, config]);

  if (!methodKey || !draft) {
    return (
      <MenuPageModalShell open={open} onClose={onClose} title="Method" titleId="payment-method-config" maxWidthClass="max-w-lg">
        <p className="admin-config-text-muted text-sm">No method selected.</p>
      </MenuPageModalShell>
    );
  }

  return (
    <MenuPageModalShell
      open={open}
      onClose={onClose}
      title={`${methodLabel(methodKey)} payments`}
      description="Provider-facing complexity stays hidden — configure capture, limits, and refunds."
      titleId="payment-method-config"
      maxWidthClass="max-w-lg"
    >
      <div className="admin-payments-method-config grid gap-4">
        <div className="admin-payments-kv">
          <span>Status</span>
          <strong>{draft.enabled ? "Enabled" : "Disabled"}</strong>
        </div>
        <div className="admin-payments-kv">
          <span>Provider</span>
          <strong>{draft.provider ?? "none"}</strong>
        </div>
        <label className="grid gap-1">
          <AdminLabel>Currencies</AdminLabel>
          <AdminInput
            value={draft.currencies.join(", ")}
            disabled={!canEdit}
            onChange={(e) =>
              setDraft({
                ...draft,
                currencies: e.target.value
                  .split(",")
                  .map((s) => s.trim().toUpperCase())
                  .filter(Boolean)
              })
            }
          />
        </label>
        <label className="grid gap-1">
          <AdminLabel>Capture</AdminLabel>
          <select
            className="admin-payments-select"
            disabled={!canEdit}
            value={draft.capture}
            onChange={(e) => setDraft({ ...draft, capture: e.target.value as PaymentMethodConfig["capture"] })}
          >
            <option value="automatic">Automatic</option>
            <option value="manual">Manual</option>
          </select>
        </label>
        <label className="grid gap-1">
          <AdminLabel>3D Secure</AdminLabel>
          <select
            className="admin-payments-select"
            disabled={!canEdit}
            value={draft.threeDSecure}
            onChange={(e) => setDraft({ ...draft, threeDSecure: e.target.value as PaymentMethodConfig["threeDSecure"] })}
          >
            <option value="automatic">Automatic</option>
            <option value="always">Always</option>
            <option value="never">Never</option>
          </select>
        </label>
        <label className="admin-payments-toggle-row">
          <span className="admin-payments-toggle-label">Refunds enabled</span>
          <input
            type="checkbox"
            className="admin-payments-toggle-input"
            checked={draft.refundsEnabled}
            disabled={!canEdit}
            onChange={(e) => setDraft({ ...draft, refundsEnabled: e.target.checked })}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1">
            <AdminLabel>Minimum (öre)</AdminLabel>
            <AdminInput
              type="number"
              disabled={!canEdit}
              value={draft.minCents ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, minCents: e.target.value === "" ? null : Number(e.target.value) })
              }
            />
          </label>
          <label className="grid gap-1">
            <AdminLabel>Maximum (öre)</AdminLabel>
            <AdminInput
              type="number"
              disabled={!canEdit}
              value={draft.maxCents ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, maxCents: e.target.value === "" ? null : Number(e.target.value) })
              }
            />
          </label>
        </div>
      </div>
      <ProfileModalFooter
        cancelLabel="Close"
        confirmLabel={canEdit ? "Save method" : "Done"}
        confirmDisabled={!canEdit}
        onCancel={onClose}
        onConfirm={() => {
          if (!canEdit) {
            onClose();
            return;
          }
          onSave(methodKey, draft);
        }}
      />
    </MenuPageModalShell>
  );
}
