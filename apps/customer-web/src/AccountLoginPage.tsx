import { useCallback, useEffect, useState } from "react";
import { iconPath } from "./marketing/assetPaths";
import { BtnPrimary } from "./marketing/ui";
import { LoginWizard } from "./login/LoginWizard";
import { PasswordResetWizard } from "./login/PasswordResetWizard";
import { ServeOsWordmark, SignupStepShell } from "./signup/SignupShell";

type Props = {
  onBack: () => void;
  onGoSignup: () => void;
};

type LoginPhase = "intro" | "wizard" | "forgot" | "reset";

const LOGIN_INTRO_ICON = iconPath("register-svgrepo-com.svg");

function readResetToken(): string | null {
  const token = new URLSearchParams(window.location.search).get("resetToken")?.trim();
  return token && token.length >= 16 ? token : null;
}

function clearResetTokenFromUrl() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("resetToken")) return;
  url.searchParams.delete("resetToken");
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(window.history.state, "", next);
}

function LoginBackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-4 py-2 text-sm font-bold text-slate-700 shadow-sm backdrop-blur-md transition hover:border-violet-200 hover:bg-white hover:text-slate-900"
    >
      <span aria-hidden className="inline-block transition-transform duration-200 group-hover:-translate-x-0.5">
        ←
      </span>
      Back
    </button>
  );
}

export function AccountLoginPage({ onBack, onGoSignup }: Props) {
  const [resetToken] = useState(readResetToken);
  const [phase, setPhase] = useState<LoginPhase>(() => (resetToken ? "reset" : "intro"));
  const [hideBack, setHideBack] = useState(false);

  useEffect(() => {
    if (phase !== "reset") clearResetTokenFromUrl();
  }, [phase]);

  const handleBack = useCallback(() => {
    if (phase === "wizard" || phase === "forgot" || phase === "reset") {
      setPhase("intro");
      return;
    }
    onBack();
  }, [phase, onBack]);

  const goSignIn = useCallback(() => {
    clearResetTokenFromUrl();
    setPhase("wizard");
  }, []);

  return (
    <div className="relative min-h-[100dvh] w-full bg-white/92">
      {!hideBack ? (
        <div className="fixed left-5 top-6 z-50 sm:left-8 sm:top-8">
          <LoginBackButton onClick={handleBack} />
        </div>
      ) : null}

      <div className="fixed right-5 top-6 z-50 sm:right-8 sm:top-8">
        <ServeOsWordmark className="text-xl sm:text-2xl" />
      </div>

      <main className="flex min-h-[100dvh] flex-col px-5 pb-12 pt-20 sm:px-8 sm:pb-16 sm:pt-24">
        <div className="signup-slot mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center py-6">
          {phase === "intro" ? (
            <SignupStepShell
              stepKey="intro"
              iconSrc={LOGIN_INTRO_ICON}
              title="Sign in to ServeOS"
              description={
                <div className="flex w-full flex-col items-center gap-3">
                  <p className="mx-auto max-w-md text-center text-sm leading-relaxed sm:text-[15px] md:text-base">
                    Access your restaurant workspace to manage menus, orders, reservations, and daily operations.
                  </p>
                  <p className="mx-auto max-w-md text-center text-sm leading-relaxed text-slate-500 sm:text-[15px] md:text-base">
                    We&apos;ll verify your credentials securely before opening your dashboard.
                  </p>
                </div>
              }
              descriptionClassName="w-full"
              footer={
                <div className="flex flex-col items-center gap-4">
                  <BtnPrimary
                    onClick={() => setPhase("wizard")}
                    className="w-full max-w-xs px-8 py-3.5 text-base sm:w-auto"
                  >
                    Continue to sign in
                  </BtnPrimary>
                  <p className="text-center text-sm text-slate-500">
                    Don&apos;t have an account?{" "}
                    <button
                      type="button"
                      onClick={onGoSignup}
                      className="font-semibold text-violet-700 underline decoration-violet-300 underline-offset-2 transition hover:text-violet-900"
                    >
                      Start free trial
                    </button>
                  </p>
                </div>
              }
            />
          ) : null}

          {phase === "wizard" ? (
            <LoginWizard
              onExit={() => setPhase("intro")}
              onForgotPassword={() => setPhase("forgot")}
              onSigningInChange={setHideBack}
            />
          ) : null}

          {phase === "forgot" ? (
            <PasswordResetWizard mode="request" onExit={() => setPhase("wizard")} />
          ) : null}

          {phase === "reset" && resetToken ? (
            <PasswordResetWizard
              mode="confirm"
              resetToken={resetToken}
              onExit={() => setPhase("intro")}
              onSuccess={goSignIn}
            />
          ) : null}
        </div>
      </main>
    </div>
  );
}
