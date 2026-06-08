import type { ReactNode } from "react";

export function ServeOsWordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display font-extrabold tracking-tight ${className}`.trim()}>
      Serve
      <span className="bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent">OS</span>
    </span>
  );
}

type SignupStepShellProps = {
  iconSrc?: string;
  iconClassName?: string;
  title: string;
  description?: ReactNode;
  descriptionClassName?: string;
  children?: ReactNode;
  footer?: ReactNode;
  belowForm?: ReactNode;
  stepKey?: string | number;
};

export function SignupStepShell({
  iconSrc,
  iconClassName = "h-20 w-20 opacity-90 sm:h-24 sm:w-24",
  title,
  description,
  descriptionClassName = "max-w-[28rem]",
  children,
  footer,
  belowForm,
  stepKey
}: SignupStepShellProps) {
  return (
    <div key={stepKey} className="signup-phase flex w-full flex-col">
      {iconSrc ? (
        <div className="flex justify-center">
          <img src={iconSrc} alt="" aria-hidden className={iconClassName} />
        </div>
      ) : null}

      <h1
        className={`font-display text-center text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl ${
          iconSrc ? "mt-8" : ""
        }`}
      >
        {title}
      </h1>

      {description ? (
        <div className={`mx-auto mt-5 flex w-full justify-center text-slate-600 ${descriptionClassName}`}>
          {description}
        </div>
      ) : null}

      {children ? <div className="mt-8 w-full">{children}</div> : null}

      {belowForm ? <div className="mt-5 w-full text-center">{belowForm}</div> : null}

      {footer ? <div className="mt-10 w-full">{footer}</div> : null}
    </div>
  );
}

export function SignupWizardActions({
  onBack,
  onContinue,
  continueLabel,
  continueBusy,
  backLabel = "Back"
}: {
  onBack: () => void;
  onContinue: () => void;
  continueLabel: string;
  continueBusy?: boolean;
  backLabel?: string;
}) {
  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
      <button
        type="button"
        onClick={onBack}
        className="rounded-full border border-white/60 bg-white/55 px-6 py-3 text-sm font-bold text-slate-900 shadow-sm backdrop-blur-md transition hover:border-violet-200/70 hover:bg-white/75 sm:min-w-[7rem]"
      >
        {backLabel}
      </button>
      <button
        type="button"
        onClick={onContinue}
        disabled={continueBusy}
        className="rounded-full bg-gradient-to-r from-violet-600 to-blue-600 px-6 py-3 text-sm font-bold text-white shadow-[0_4px_20px_rgba(124,58,237,0.25)] transition hover:from-violet-500 hover:to-blue-500 disabled:opacity-70 sm:min-w-[10rem]"
      >
        {continueLabel}
      </button>
    </div>
  );
}
