import {
  DetailsDrawerShell,
  DetailsGrid,
  DetailsRow,
  DetailsSection,
  useCachedDetailsEntity
} from "../menu/detailsDrawerUi";
import { PaymentsDetailsReveal } from "./paymentsLoadingUi";

export type PaymentRulesDomainDetail = {
  key: string;
  label: string;
  score: number;
  fill: string;
  statusLabel: string;
  sectionId: string;
  impact: string;
  recommendedAction: string;
  facts: Array<{ label: string; value: string }>;
  /** When set, shown instead of “N% complete”. */
  badgeLabel?: string;
  /** Drawer section hint under “What this means”. */
  sectionHint?: string;
};

type Props = {
  detail: PaymentRulesDomainDetail | null;
  open: boolean;
  onClose: () => void;
  onGoToSection: (sectionId: string) => void;
};

export function PaymentRulesDomainDrawer({ detail, open, onClose, onGoToSection }: Props) {
  const active = useCachedDetailsEntity(open, detail);

  return (
    <DetailsDrawerShell
      open={open}
      entityKey={active?.key ?? null}
      title={active?.label ?? "Payment rule"}
      subtitle={active?.statusLabel}
      badge={
        active ? (
          <span
            className={`admin-payments-health-issue-badge ${
              active.badgeLabel
                ? "is-warning"
                : active.score >= 70
                  ? "is-ok"
                  : active.score > 0
                    ? "is-warning"
                    : "is-muted"
            }`}
          >
            {active.badgeLabel ?? `${active.score}% complete`}
          </span>
        ) : null
      }
      closeLabel="Close payment rule details"
      onClose={onClose}
    >
      <PaymentsDetailsReveal ready={Boolean(active)}>
        {active ? (
          <>
            <DetailsSection
              title="What this means"
              hint={
                active.sectionHint ?? "How complete this rules domain is for this venue."
              }
            >
              <DetailsGrid>
                <DetailsRow label="Impact" value={active.impact} />
                <DetailsRow label="Recommended action" value={active.recommendedAction} />
              </DetailsGrid>
            </DetailsSection>

            <DetailsSection title="Related settings">
              <DetailsGrid>
                {active.facts.map((fact) => (
                  <DetailsRow key={fact.label} label={fact.label} value={fact.value} />
                ))}
              </DetailsGrid>
            </DetailsSection>

            <button
              type="button"
              className="admin-payments-today-view-all"
              onClick={() => {
                onGoToSection(active.sectionId);
                onClose();
              }}
            >
              Open this rule
              <span aria-hidden>→</span>
            </button>
          </>
        ) : null}
      </PaymentsDetailsReveal>
    </DetailsDrawerShell>
  );
}
