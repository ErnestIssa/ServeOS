import { SignupModalShell } from "./SignupModalShell";

type Props = {
  open: boolean;
  onClose: () => void;
};

const AT_THIS_STEP = [
  "You set up your Owner login — name, email, and password.",
  "ServeOS links the company and venue details you entered earlier in this guide."
] as const;

const CONFIGURED_LATER = [
  "How your venue operates and what you offer",
  "Physical tools and hardware you want to use",
  "Payments, terminals, and other integrations",
  "Staff invitations, roles, and access levels",
  "Menus, reservations, delivery, and launch settings"
] as const;

export function AccountCreationInfoModal({ open, onClose }: Props) {
  return (
    <SignupModalShell
      open={open}
      onClose={onClose}
      labelledBy="account-creation-info-title"
      panelClassName="relative z-[1] w-full max-w-4xl rounded-2xl border border-slate-200/80 bg-white/95 px-8 py-8 shadow-[0_24px_80px_rgba(15,23,42,0.18)] backdrop-blur-xl sm:px-10 sm:py-9"
      backdropLabel="Close account creation info"
      shellClassName="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
    >
      <h2 id="account-creation-info-title" className="font-display text-center text-2xl font-extrabold text-slate-900 sm:text-3xl">
        About account creation
      </h2>
      <p className="mx-auto mt-3 max-w-2xl text-center text-base text-slate-600">
        A quick overview of what happens now — and what you&apos;ll choose at a later stage.
      </p>

      <div className="mt-8 grid gap-8 sm:grid-cols-2 sm:gap-10">
        <section>
          <h3 className="text-sm font-bold uppercase tracking-wide text-violet-700">At this step</h3>
          <ul className="mt-4 space-y-3">
            {AT_THIS_STEP.map((item) => (
              <li key={item} className="flex gap-3 text-base leading-relaxed text-slate-600">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">You choose later</h3>
          <ul className="mt-4 space-y-3">
            {CONFIGURED_LATER.map((item) => (
              <li key={item} className="flex gap-3 text-base leading-relaxed text-slate-600">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <p className="mt-8 rounded-xl border border-slate-200/80 bg-slate-50/80 px-5 py-4 text-base leading-relaxed text-slate-600">
        Clicking Create account does not lock you into any hardware, integrations, or paid options. You&apos;ll continue
        this guide first, then decide what to set up and when — from your dashboard, at your own pace.
      </p>

      <button
        type="button"
        onClick={onClose}
        className="mt-8 w-full rounded-full bg-gradient-to-r from-violet-600 to-blue-600 px-6 py-3.5 text-base font-bold text-white shadow-[0_4px_20px_rgba(124,58,237,0.25)] transition hover:from-violet-500 hover:to-blue-500"
      >
        Got it
      </button>
    </SignupModalShell>
  );
}
