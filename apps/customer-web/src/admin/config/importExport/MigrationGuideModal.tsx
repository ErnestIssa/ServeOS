import { useEffect, useMemo, useState } from "react";
import type { MigrationGuideStep } from "../../../api";
import { MenuPageModalShell, ProfileModalFooter } from "../menu/menuPageModalShell";

type Props = {
  open: boolean;
  steps: MigrationGuideStep[];
  onClose: () => void;
};

/** Local fallback when catalog has not returned migrationSteps yet (keeps guide complete). */
export const MIGRATION_GUIDE_FALLBACK_STEPS: MigrationGuideStep[] = [
  {
    key: "choose",
    title: "Choose system",
    summary: "Pick the POS or file source you’re leaving.",
    detail:
      "Use the Source system menu on this Migration panel. Custom CSV is available today; other providers can be requested for assisted migration until their connectors ship."
  },
  {
    key: "upload",
    title: "Upload / Connect",
    summary: "Provide an export file or approve a connection.",
    detail:
      "For Custom CSV, Start migration opens the import wizard so you can upload your file. Connected POS providers will use a secure OAuth or export handshake when they become available."
  },
  {
    key: "analyze",
    title: "Analyze",
    summary: "ServeOS inspects structure, IDs, and data quality.",
    detail:
      "We detect columns, external IDs, and obvious issues before anything is written. Analysis results appear in the wizard so you can fix problems early."
  },
  {
    key: "map",
    title: "Map",
    summary: "Match source fields to ServeOS fields.",
    detail:
      "Map categories, items, prices, and modifiers to the ServeOS schema. Preserving external IDs here keeps future sync and re-imports safer."
  },
  {
    key: "preview",
    title: "Preview",
    summary: "Review creates, updates, and skips before commit.",
    detail:
      "Preview shows what will change on this venue. Nothing live updates until you confirm — dry runs are available for menu CSV today."
  },
  {
    key: "import",
    title: "Import",
    summary: "Apply the migration into this venue.",
    detail:
      "Confirmed imports run as tracked transfer jobs. You can follow progress under Overview and History, and download or retry when supported."
  },
  {
    key: "verify",
    title: "Verify",
    summary: "Spot-check the venue and keep a backup export.",
    detail:
      "After import, check menus and key records in admin. Export a ServeOS backup when you’re happy so you have a restore point."
  }
];

export function MigrationGuideModal({ open, steps, onClose }: Props) {
  const [stepIndex, setStepIndex] = useState(0);

  const resolvedSteps = useMemo(
    () => (steps.length >= 2 ? steps : MIGRATION_GUIDE_FALLBACK_STEPS),
    [steps]
  );
  const step = resolvedSteps[Math.min(stepIndex, resolvedSteps.length - 1)]!;
  const stepNumber = Math.min(stepIndex, resolvedSteps.length - 1) + 1;
  const isFirst = stepIndex <= 0;
  const isLast = stepIndex >= resolvedSteps.length - 1;

  useEffect(() => {
    if (!open) return;
    setStepIndex(0);
  }, [open]);

  return (
    <MenuPageModalShell
      open={open}
      onClose={onClose}
      title="Migration guide"
      description={`Step ${stepNumber} of ${resolvedSteps.length}`}
      titleId="data-transfer-migration-guide"
      maxWidthClass="max-w-xl"
      panelClassName="data-transfer-migration-guide-shell"
      stackLevel="overlay"
    >
      <div className="data-transfer-migration-guide-stage">
        <article
          className="data-transfer-migration-guide-card"
          data-step={stepNumber}
          aria-label={`Step ${stepNumber}: ${step.title}`}
        >
          <div className="data-transfer-migration-guide-card-badge" aria-hidden>
            {stepNumber}
          </div>
          <h4 className="data-transfer-migration-guide-card-title">{step.title}</h4>
          <p className="data-transfer-migration-guide-card-summary">{step.summary}</p>
          <p className="data-transfer-migration-guide-card-detail">{step.detail}</p>
        </article>

        <ol className="data-transfer-migration-guide-progress" aria-label="Guide progress">
          {resolvedSteps.map((s, i) => (
            <li key={s.key}>
              <button
                type="button"
                className={`data-transfer-migration-guide-progress-dot${i === stepIndex ? " is-active" : ""}${i < stepIndex ? " is-done" : ""}`}
                data-step={i + 1}
                aria-label={`Go to step ${i + 1}: ${s.title}`}
                aria-current={i === stepIndex ? "step" : undefined}
                onClick={() => setStepIndex(i)}
              />
            </li>
          ))}
        </ol>
      </div>

      <ProfileModalFooter
        cancelLabel={isFirst ? "Close" : "Back"}
        confirmLabel={isLast ? "Done" : "Next step"}
        onCancel={() => {
          if (isFirst) onClose();
          else setStepIndex((i) => Math.max(i - 1, 0));
        }}
        onConfirm={() => {
          if (isLast) onClose();
          else setStepIndex((i) => Math.min(i + 1, resolvedSteps.length - 1));
        }}
      />
    </MenuPageModalShell>
  );
}
