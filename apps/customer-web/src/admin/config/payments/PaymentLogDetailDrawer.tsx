import type { PaymentLogRow } from "../../../api";
import { DetailsDrawerShell, DetailsRow, DetailsSection } from "../menu/detailsDrawerUi";
import { formatWhen } from "./paymentsUiHelpers";
import { logCategoryLabel, logLevelLabel, logLevelTone } from "./logsListQuery";

type Props = {
  open: boolean;
  log: PaymentLogRow | null;
  onClose: () => void;
};

function metaEntries(meta?: Record<string, unknown>) {
  if (!meta) return [];
  return Object.entries(meta).filter(([, value]) => value != null && value !== "");
}

function formatMetaValue(value: unknown) {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

export function PaymentLogDetailDrawer({ open, log, onClose }: Props) {
  const tone = log ? logLevelTone(log.level) : "inactive";
  const meta = log ? metaEntries(log.meta) : [];

  return (
    <DetailsDrawerShell
      open={open}
      entityKey={log?.id ?? "log-detail"}
      kicker="Payment logs"
      title={log ? log.message : "Log event"}
      subtitle={log ? `${logCategoryLabel(log.category)} · ${formatWhen(log.at)}` : "Technical event from the payment API."}
      closeLabel="Close log details"
      onClose={onClose}
      badge={
        log ? (
          <span className={`admin-menu-surface-status admin-payments-method-tone is-${tone}`}>
            {logLevelLabel(log.level)}
          </span>
        ) : null
      }
      footer={
        <div className="admin-payments-rule-footer">
          <button type="button" className="admin-profile-modal-btn admin-profile-modal-btn--ghost" onClick={onClose}>
            Close
          </button>
        </div>
      }
    >
      {log ? (
        <div className="admin-payments-provider-detail">
          <DetailsRow label="Level" value={logLevelLabel(log.level)} />
          <DetailsRow label="Category" value={logCategoryLabel(log.category)} />
          <DetailsRow label="Message" value={log.message} />
          <DetailsRow label="When" value={formatWhen(log.at)} />
          <DetailsRow label="Source" value={log.source === "demo" ? "Sample log" : "Live"} />
          <DetailsRow label="Event ID" value={log.id} />
          {meta.length > 0 ? (
            <DetailsSection title="Event payload" hint="Provider and system fields attached to this event.">
              {meta.map(([key, value]) => (
                <DetailsRow key={key} label={key} value={formatMetaValue(value)} />
              ))}
            </DetailsSection>
          ) : null}
        </div>
      ) : (
        <p className="admin-config-text-muted text-sm">No log selected.</p>
      )}
    </DetailsDrawerShell>
  );
}
