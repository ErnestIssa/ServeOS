import { useMemo } from "react";
import type { PaymentLogRow, VenuePaymentSettings } from "../../../api";
import { DetailsDrawerShell } from "../menu/detailsDrawerUi";
import { PAYMENT_METHOD_CATALOG, type PaymentMethodGroup } from "./paymentMethodCatalog";
import { PaymentMethodGlyph } from "./paymentsFormControls";
import { PaymentsLogsTab } from "./PaymentsLogsTab";
import { GROUP_LABELS, getMethodConfig, methodLabel } from "./paymentsUiHelpers";

const METHOD_GROUPS: PaymentMethodGroup[] = ["online", "venue", "business"];

export function PaymentProviderMethodsDrawer({
  open,
  settings,
  onClose
}: {
  open: boolean;
  settings: VenuePaymentSettings | null;
  onClose: () => void;
}) {
  const groups = useMemo(() => {
    if (!settings) return [];
    return METHOD_GROUPS.map((group) => {
      const rows = PAYMENT_METHOD_CATALOG.filter((entry) => entry.group === group).map((entry) => {
        const config = getMethodConfig(settings, entry.key);
        const offered = Boolean(config.enabled || settings.methods[entry.key]);
        const isDefault = settings.defaultPaymentMethodKey === entry.key || Boolean(config.isDefault);
        return {
          key: entry.key,
          label: config.displayName?.trim() || methodLabel(entry.key),
          offered,
          isDefault
        };
      });
      return { group, label: GROUP_LABELS[group], rows };
    }).filter((g) => g.rows.length > 0);
  }, [settings]);

  const offeredCount = groups.reduce((n, g) => n + g.rows.filter((r) => r.offered).length, 0);

  return (
    <DetailsDrawerShell
      open={open}
      entityKey="provider-methods"
      kicker="Providers"
      title="Payment methods"
      subtitle="What customers can use at this venue. Enable or disable methods on the Payment methods tab."
      closeLabel="Close payment methods"
      onClose={onClose}
      footer={
        <div className="admin-payments-rule-footer">
          <button type="button" className="admin-profile-modal-btn admin-profile-modal-btn--ghost" onClick={onClose}>
            Close
          </button>
        </div>
      }
    >
      <div className="admin-payments-provider-preview">
        <p className="admin-payments-provider-preview-count">
          {offeredCount} offered to customers
        </p>
        {groups.map((group) => (
          <section key={group.group} className="admin-payments-provider-preview-group">
            <p className="admin-payments-venue-panel-kicker">{group.label}</p>
            <ul className="admin-payments-provider-preview-list">
              {group.rows.map((row) => (
                <li key={row.key} className={row.offered ? "is-on" : "is-off"}>
                  <PaymentMethodGlyph methodKey={row.key} />
                  <span className="admin-payments-provider-preview-name">
                    {row.label}
                    {row.isDefault ? <span className="admin-payments-provider-preview-default">Default</span> : null}
                  </span>
                  <span className="admin-payments-provider-preview-state">
                    {row.offered ? "Offered" : "Not offered"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </DetailsDrawerShell>
  );
}

export function PaymentProviderLogsDrawer({
  open,
  logs,
  source,
  onClose
}: {
  open: boolean;
  logs: PaymentLogRow[];
  source?: "live" | "demo";
  onClose: () => void;
}) {
  return (
    <DetailsDrawerShell
      open={open}
      entityKey="provider-logs"
      kicker="Providers"
      title="Payment logs"
      subtitle="Technical events and system activity for this venue."
      closeLabel="Close payment logs"
      onClose={onClose}
      footer={
        <div className="admin-payments-rule-footer">
          <button type="button" className="admin-profile-modal-btn admin-profile-modal-btn--ghost" onClick={onClose}>
            Close
          </button>
        </div>
      }
    >
      <div className="admin-payments-provider-preview admin-payments-provider-preview--logs">
        <PaymentsLogsTab logs={logs} source={source} embedded />
      </div>
    </DetailsDrawerShell>
  );
}
