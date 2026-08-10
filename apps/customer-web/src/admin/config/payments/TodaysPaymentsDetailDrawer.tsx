import { useEffect, useState } from "react";
import {
  getVenueTodaysPaymentsDetail,
  type TodaysPaymentsDetail,
  type TodaysPaymentsDetailQuery
} from "../../../api";
import {
  DetailsDrawerShell,
  DetailsGrid,
  DetailsRow,
  DetailsSection,
  formatDetailsWhen,
  useCachedDetailsEntity
} from "../menu/detailsDrawerUi";
import { formatSekFromCents } from "./paymentsUiHelpers";

type Props = {
  token: string | null;
  restaurantId: string | null;
  query: TodaysPaymentsDetailQuery | null;
  open: boolean;
  onClose: () => void;
};

function queryEntityKey(query: TodaysPaymentsDetailQuery | null) {
  if (!query) return null;
  if (query.scope === "payment") return `payment:${query.id ?? ""}`;
  if (query.scope === "collected") return "collected";
  return `${query.scope}:${query.key ?? ""}`;
}

export function TodaysPaymentsDetailDrawer({ token, restaurantId, query, open, onClose }: Props) {
  const activeQuery = useCachedDetailsEntity(open, query);
  const [detail, setDetail] = useState<TodaysPaymentsDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !token || !restaurantId || !query) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void getVenueTodaysPaymentsDetail(token, restaurantId, query).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (res.ok && res.detail) {
        setDetail(res.detail);
        return;
      }
      setDetail(null);
      setError(res.message || res.error || "Could not load today’s payment details.");
    });
    return () => {
      cancelled = true;
    };
  }, [open, token, restaurantId, query]);

  useEffect(() => {
    if (open) return;
    const t = window.setTimeout(() => {
      setDetail(null);
      setError(null);
    }, 520);
    return () => window.clearTimeout(t);
  }, [open]);

  return (
    <DetailsDrawerShell
      open={open}
      entityKey={queryEntityKey(activeQuery)}
      title={detail?.title ?? activeQuery?.key ?? "Today’s payments"}
      subtitle={detail?.subtitle}
      badge={
        <span className="admin-payments-health-issue-badge is-warning">
          {detail?.source === "demo" ? "Sample activity" : "Live ledger"}
        </span>
      }
      closeLabel="Close today’s payment details"
      onClose={onClose}
    >
      {loading && !detail ? (
        <p className="admin-staff-profile-muted text-sm">Loading details…</p>
      ) : null}
      {error ? <p className="admin-config-text-muted text-sm">{error}</p> : null}

      {detail ? (
        <>
          <DetailsSection title="What this means" hint="Calculated from today’s payment ledger on the server.">
            <DetailsGrid>
              <DetailsRow label="Impact" value={detail.summary.impact} />
              <DetailsRow label="Recommended action" value={detail.summary.recommendedAction} />
              <DetailsRow label="Venue day" value={detail.dayKey} />
              <DetailsRow label="Timezone" value={detail.timezone.replace(/_/g, " ")} />
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
            title={detail.payment ? "Payment record" : "Matching payments"}
            hint="These rows reconcile back to individual ledger payments for today."
          >
            {detail.records.length === 0 ? (
              <p className="admin-staff-profile-muted text-sm">No matching payments for this view.</p>
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
                      <span className="admin-payments-today-recent-amount">
                        {formatSekFromCents(row.amountCents, row.currency)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </DetailsSection>
        </>
      ) : null}
    </DetailsDrawerShell>
  );
}
