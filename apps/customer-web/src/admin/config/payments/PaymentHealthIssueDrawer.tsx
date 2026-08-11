import { useEffect, useState } from "react";
import {
  getVenuePaymentHealthIssue,
  type PaymentHealthIssue,
  type PaymentHealthIssueDetail
} from "../../../api";
import {
  DetailsDrawerShell,
  DetailsGrid,
  DetailsRow,
  DetailsSection,
  formatDetailsWhen,
  useCachedDetailsEntity
} from "../menu/detailsDrawerUi";
import { PaymentsDetailsReveal, PaymentsDrawerSpinner } from "./paymentsLoadingUi";
import { formatSekFromCents } from "./paymentsUiHelpers";

type Props = {
  token: string | null;
  restaurantId: string | null;
  issue: PaymentHealthIssue | null;
  open: boolean;
  onClose: () => void;
};

export function PaymentHealthIssueDrawer({ token, restaurantId, issue, open, onClose }: Props) {
  const activeIssue = useCachedDetailsEntity(open, issue);
  const [detail, setDetail] = useState<PaymentHealthIssueDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !token || !restaurantId || !issue?.id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDetail(null);
    void getVenuePaymentHealthIssue(token, restaurantId, issue.id).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (res.ok && res.detail) {
        setDetail(res.detail);
        return;
      }
      setDetail(null);
      setError(res.message || res.error || "Could not load issue details.");
    });
    return () => {
      cancelled = true;
    };
  }, [open, token, restaurantId, issue?.id]);

  useEffect(() => {
    if (open) return;
    const t = window.setTimeout(() => {
      setDetail(null);
      setError(null);
    }, 520);
    return () => window.clearTimeout(t);
  }, [open]);

  const severity = activeIssue?.severity ?? "warning";

  return (
    <DetailsDrawerShell
      open={open}
      entityKey={activeIssue?.id ?? null}
      title={activeIssue?.title ?? "Payment issue"}
      subtitle={activeIssue?.detail}
      badge={
        <span className={`admin-payments-health-issue-badge is-${severity}`}>
          {detail?.summary.severityLabel ?? (severity === "critical" ? "Critical" : "Needs attention")}
        </span>
      }
      closeLabel="Close payment issue details"
      onClose={onClose}
    >
      {loading && !detail ? <PaymentsDrawerSpinner label="Loading issue details" /> : null}
      {error ? <p className="admin-config-text-muted text-sm">{error}</p> : null}

      <PaymentsDetailsReveal ready={!!detail && !loading}>
        {detail ? (
          <>
            <DetailsSection title="What this means" hint="Explained from the payment health monitor.">
              <DetailsGrid>
                <DetailsRow label="Impact" value={detail.summary.impact} />
                <DetailsRow label="Recommended action" value={detail.summary.recommendedAction} />
                <DetailsRow label="Checked" value={formatDetailsWhen(detail.evaluatedAt)} />
                <DetailsRow
                  label="Source"
                  value={detail.source === "demo" ? "Sample activity" : "Live ledger"}
                />
              </DetailsGrid>
            </DetailsSection>

            <DetailsSection title="Related figures">
              <DetailsGrid>
                {detail.relatedMetrics.map((m) => (
                  <DetailsRow key={m.label} label={m.label} value={m.value} />
                ))}
              </DetailsGrid>
            </DetailsSection>

            <DetailsSection
              title="Affected records"
              hint="These rows come from the payment ledger and provider event feed."
            >
              {detail.records.length === 0 ? (
                <p className="admin-staff-profile-muted text-sm">No linked records for this issue right now.</p>
              ) : (
                <ul className="admin-payments-health-issue-records">
                  {detail.records.map((row) => (
                    <li key={row.id}>
                      <div className="min-w-0">
                        <p className="admin-payments-health-issue-title">{row.title}</p>
                        <p className="admin-payments-health-issue-detail">
                          {row.subtitle}
                          {row.at ? ` · ${formatDetailsWhen(row.at)}` : ""}
                        </p>
                      </div>
                      <div className="admin-payments-health-issue-record-side">
                        <span className="admin-payments-chip admin-payments-chip--muted">{row.statusLabel}</span>
                        {row.amountCents != null ? (
                          <span className="admin-payments-today-recent-amount">
                            {formatSekFromCents(row.amountCents, row.currency ?? "SEK")}
                          </span>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </DetailsSection>
          </>
        ) : null}
      </PaymentsDetailsReveal>
    </DetailsDrawerShell>
  );
}
