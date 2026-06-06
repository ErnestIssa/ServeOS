import type { SignupFlow } from "@serveos/core-shared";
import { useState } from "react";
import { WEB_ADMIN_URL } from "./marketing/constants";
import { Reveal } from "./marketing/motion";
import { SiteFooter } from "./marketing/SiteFooter";
import { SiteNav } from "./marketing/SiteNav";
import {
  bodyMuted,
  contentWrap,
  glassPanelLg,
  marketingRoot,
  pageGutter,
  pageSection
} from "./marketing/styles";
import { BtnPrimary, BtnSecondary } from "./marketing/ui";
import { SignupWizard } from "./signup/SignupWizard";

type Phase = "experience" | "wizard" | "success";

type Props = {
  onHome: () => void;
  onHowItWorks: () => void;
  onGoPricing: () => void;
  initialFlow?: SignupFlow | null;
};

function ServeOsWordmark() {
  return (
    <span className="font-display font-extrabold tracking-tight">
      Serve
      <span className="bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent">OS</span>
    </span>
  );
}

export function AccountSignupPage({ onHome, onHowItWorks, onGoPricing, initialFlow = null }: Props) {
  const [phase, setPhase] = useState<Phase>(initialFlow ? "wizard" : "experience");
  const [flow, setFlow] = useState<SignupFlow | null>(initialFlow);
  const [createdRole, setCreatedRole] = useState<"CUSTOMER" | "OWNER" | null>(null);

  const startWizard = (next: SignupFlow) => {
    setFlow(next);
    setPhase("wizard");
  };

  return (
    <div className={`${marketingRoot} pb-24 md:pb-0`}>
      <SiteNav onHome={onHome} onHowItWorks={onHowItWorks} onGoPricing={onGoPricing} />

      <section className={`${pageSection} pb-12 pt-24 sm:pt-28`}>
        <div className={`${contentWrap} ${pageGutter}`}>
          {phase === "experience" ? (
            <Reveal className="mx-auto max-w-3xl text-center">
              <p className="inline-flex rounded-full border border-violet-200/50 bg-white/50 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-violet-800 backdrop-blur-md">
                Account setup
              </p>
              <h1 className="font-display mt-5 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
                Which <ServeOsWordmark /> setup fits you?
              </h1>
              <p className={`mx-auto mt-5 max-w-xl text-base sm:text-lg ${bodyMuted}`}>
                Business owners set up their restaurant here on the web. Guests can also create a personal account
                for ordering and reservations.
              </p>

              <div className={`mt-10 grid gap-4 sm:grid-cols-2 ${glassPanelLg} p-6 sm:p-8`}>
                <button
                  type="button"
                  onClick={() => startWizard("BUSINESS")}
                  className="group rounded-2xl border border-blue-200/70 bg-gradient-to-br from-blue-600 to-violet-700 p-6 text-left text-white shadow-[0_8px_28px_rgba(59,130,246,0.25)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_36px_rgba(59,130,246,0.32)]"
                >
                  <p className="text-xs font-bold uppercase tracking-wide text-blue-100">For operators</p>
                  <p className="mt-2 font-display text-2xl font-extrabold">Business Account</p>
                  <p className="mt-2 text-sm leading-relaxed text-blue-50/90">
                    Register your company, first venue, and owner access — the same flow as our guided setup.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => startWizard("GUEST")}
                  className="group rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-500 to-teal-600 p-6 text-left text-white shadow-[0_8px_28px_rgba(16,185,129,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_36px_rgba(16,185,129,0.3)]"
                >
                  <p className="text-xs font-bold uppercase tracking-wide text-emerald-100">For guests</p>
                  <p className="mt-2 font-display text-2xl font-extrabold">Guest Account</p>
                  <p className="mt-2 text-sm leading-relaxed text-emerald-50/90">
                    Personal account for browsing menus, booking tables, and tracking orders.
                  </p>
                </button>
              </div>

              <p className="mt-8 text-sm text-slate-500">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={onHome}
                  className="font-bold text-violet-700 underline-offset-2 hover:underline"
                >
                  Return to home
                </button>
              </p>
            </Reveal>
          ) : null}

          {phase === "wizard" && flow ? (
            <Reveal>
              <SignupWizard
                flow={flow}
                onExit={() => {
                  setPhase("experience");
                  setFlow(null);
                }}
                onSuccess={(role) => {
                  setCreatedRole(role);
                  setPhase("success");
                }}
              />
            </Reveal>
          ) : null}

          {phase === "success" && createdRole ? (
            <Reveal className="mx-auto max-w-xl text-center">
              <div className={`${glassPanelLg} px-8 py-12`}>
                <h2 className="font-display text-3xl font-extrabold text-slate-900">
                  {createdRole === "OWNER" ? "Your business is ready" : "Your account is ready"}
                </h2>
                <p className={`mt-4 text-sm leading-relaxed sm:text-base ${bodyMuted}`}>
                  {createdRole === "OWNER"
                    ? "Your company, venue, and owner account were created. Open the admin dashboard to manage operations."
                    : "Your guest account was created. Download the ServeOS app to order, book, and track visits."}
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                  {createdRole === "OWNER" && WEB_ADMIN_URL ? (
                    <BtnPrimary onClick={() => window.open(WEB_ADMIN_URL, "_blank", "noopener,noreferrer")}>
                      Open admin dashboard
                    </BtnPrimary>
                  ) : null}
                  <BtnSecondary onClick={onHome}>Back to home</BtnSecondary>
                </div>
              </div>
            </Reveal>
          ) : null}
        </div>
      </section>

      <SiteFooter onHowItWorks={onHowItWorks} />
    </div>
  );
}
