import type { TrialNoticePayload } from "./deploymentApi";

type Props = {
  canManageBilling: boolean;
  needsDeploymentSetup: boolean;
  trialNotice: TrialNoticePayload | null;
  dismissingTrial: boolean;
  onOpenDeployment: () => void;
  onDismissTrial: () => void;
  onViewBilling: () => void;
};

export function OwnerWorkspaceBanner({
  canManageBilling,
  needsDeploymentSetup,
  trialNotice,
  dismissingTrial,
  onOpenDeployment,
  onDismissTrial,
  onViewBilling
}: Props) {
  if (!canManageBilling) return null;

  if (needsDeploymentSetup) {
    return (
      <div className="owner-workspace-banner owner-workspace-banner--setup" role="status">
        <div className="owner-workspace-banner__copy">
          <p className="owner-workspace-banner__title">Complete your workspace setup</p>
          <p className="owner-workspace-banner__text">
            Choose your ServeOS plan and hardware when you&apos;re ready — your team can explore the dashboard in the
            meantime.
          </p>
        </div>
        <button type="button" className="owner-workspace-banner__cta" onClick={onOpenDeployment}>
          View plans
        </button>
      </div>
    );
  }

  if (!trialNotice) return null;

  const isWelcome = trialNotice.kind === "welcome";

  return (
    <div
      className={`owner-workspace-banner ${isWelcome ? "owner-workspace-banner--welcome" : "owner-workspace-banner--reminder"}`}
      role="status"
    >
      <div className="owner-workspace-banner__copy">
        <p className="owner-workspace-banner__title">{trialNotice.title}</p>
        <p className="owner-workspace-banner__text">{trialNotice.message}</p>
      </div>
      <div className="owner-workspace-banner__actions">
        <button type="button" className="owner-workspace-banner__link" onClick={onViewBilling}>
          View billing
        </button>
        <button
          type="button"
          className="owner-workspace-banner__cta"
          onClick={onDismissTrial}
          disabled={dismissingTrial}
        >
          {dismissingTrial ? "Saving…" : trialNotice.dismissLabel}
        </button>
      </div>
    </div>
  );
}
