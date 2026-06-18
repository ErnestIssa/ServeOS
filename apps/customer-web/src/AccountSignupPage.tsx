import { useCallback, useEffect, useState } from "react";
import { iconPath } from "./marketing/assetPaths";
import { ADMIN_APP_PATH, PRIVACY_POLICY_PATH } from "./marketing/constants";
import { BtnPrimary, BtnSecondary } from "./marketing/ui";
import { SignupCancelModal } from "./signup/SignupCancelModal";
import {
  clearSignupSession,
  clearSignupWizardState,
  loadSignupPhase,
  saveSignupPhase,
  type SignupPhase
} from "./signup/signupWizardPersistence";
import { SignupWizard } from "./signup/SignupWizard";
import { ServeOsWordmark, SignupStepShell } from "./signup/SignupShell";

type Props = {
  onBack: () => void;
  onGoLogin?: () => void;
};

const DIRECTIONS_ICON = iconPath("directions-svgrepo-com.svg");

function SignupBackButton({ onClick, label = "Back" }: { onClick: () => void; label?: string }) {
  const isCancel = label === "Cancel";

  return (
    <button
      type="button"
      onClick={onClick}
      className="group inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-4 py-2 text-sm font-bold text-slate-700 shadow-sm backdrop-blur-md transition hover:border-violet-200 hover:bg-white hover:text-slate-900"
    >
      {!isCancel ? (
        <span
          aria-hidden
          className="inline-block transition-transform duration-200 group-hover:-translate-x-0.5"
        >
          ←
        </span>
      ) : null}
      {label}
    </button>
  );
}

export function AccountSignupPage({ onBack, onGoLogin }: Props) {
  const [phase, setPhase] = useState<SignupPhase>(() => loadSignupPhase());
  const [cancelOpen, setCancelOpen] = useState(false);
  const [hidePageCancel, setHidePageCancel] = useState(false);

  useEffect(() => {
    saveSignupPhase(phase);
  }, [phase]);

  useEffect(() => {
    if (phase !== "wizard") setHidePageCancel(false);
  }, [phase]);

  const handlePageBack = useCallback(() => {
    if (phase === "wizard") {
      setCancelOpen(true);
      return;
    }
    onBack();
  }, [phase, onBack]);

  const confirmCancel = useCallback(() => {
    clearSignupSession();
    setCancelOpen(false);
    onBack();
  }, [onBack]);

  return (
    <div className="relative min-h-[100dvh] w-full bg-white/92">
      {phase !== "wizard" || !hidePageCancel ? (
        <div className="fixed left-5 top-6 z-50 sm:left-8 sm:top-8">
          <SignupBackButton onClick={handlePageBack} label={phase === "wizard" ? "Cancel" : "Back"} />
        </div>
      ) : null}

      <div className="fixed right-5 top-6 z-50 sm:right-8 sm:top-8">
        <ServeOsWordmark className="text-xl sm:text-2xl" />
      </div>

      <SignupCancelModal
        open={cancelOpen}
        onStay={() => setCancelOpen(false)}
        onConfirm={confirmCancel}
      />

      <main className="flex min-h-[100dvh] flex-col px-5 pb-12 pt-20 sm:px-8 sm:pb-16 sm:pt-24">
        <div className="signup-slot mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center py-6">
          {phase === "intro" ? (
            <SignupStepShell
              stepKey="intro"
              iconSrc={DIRECTIONS_ICON}
              title="Let's set up your business"
              description={
                <div className="flex w-full flex-col items-center gap-3">
                  <p className="mx-auto w-max max-w-full text-center text-sm leading-snug whitespace-nowrap sm:text-[15px] md:text-base">
                    You&apos;ll answer a few questions about your company, venue, and how you operate.
                  </p>
                  <p className="relative mx-auto w-max max-w-full -translate-x-[3.75rem] text-center text-sm leading-snug whitespace-nowrap sm:-translate-x-[4.25rem] sm:text-[15px] md:-translate-x-[5.25rem] md:text-base">
                    We&apos;ll use that information to create your ServeOS workspace and recommend the right setup for your business.
                  </p>
                </div>
              }
              descriptionClassName="w-full"
              footer={
                <div className="flex flex-col items-center gap-4">
                  <p className="text-center text-sm font-semibold text-slate-500">It takes about 2 minutes.</p>
                  <BtnPrimary
                    onClick={() => setPhase("wizard")}
                    className="w-full max-w-xs px-8 py-3.5 text-base sm:w-auto"
                  >
                    Start the guide
                  </BtnPrimary>
                  <p className="max-w-lg text-center text-xs leading-snug text-slate-500">
                    By clicking Start the guide, you confirm that you have read the ServeOS{" "}
                    <a
                      href={PRIVACY_POLICY_PATH}
                      className="font-semibold text-violet-700 underline decoration-violet-300 underline-offset-2 transition hover:text-violet-900"
                    >
                      Privacy Policy
                    </a>
                    .
                  </p>
                </div>
              }
            />
          ) : null}

          {phase === "wizard" ? (
            <SignupWizard
              flow="BUSINESS"
              onAccountCreatingChange={setHidePageCancel}
              onGoLogin={onGoLogin}
              onExit={() => {
                clearSignupWizardState();
                setPhase("intro");
              }}
              onSuccess={() => {
                clearSignupWizardState();
                setPhase("success");
              }}
            />
          ) : null}

          {phase === "success" ? (
            <div key="success" className="signup-phase flex w-full flex-col text-center">
              <h2 className="font-display text-3xl font-extrabold text-slate-900">Your business is ready</h2>
              <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-slate-600 sm:text-base">
                Your company, venue, and owner account were created. Open the admin dashboard to manage operations.
              </p>
              <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <BtnPrimary onClick={() => window.location.assign(ADMIN_APP_PATH)}>Open admin dashboard</BtnPrimary>
                <BtnSecondary onClick={onBack}>Back to home</BtnSecondary>
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
