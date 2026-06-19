import { readApiMessage } from "../bootstrap/clientConfig";
import { useState, type ReactNode } from "react";
import { login, provisionBusinessWorkspace } from "../api";
import { iconPath } from "../marketing/assetPaths";
import { handoffToAdminApp } from "../signup/adminHandoff";
import { clearPendingBusinessProvision, clearSignupSession, loadPendingBusinessProvision } from "../signup/signupWizardPersistence";
import { SignupRegistrationLoader } from "../signup/SignupRegistrationLoader";
import { SignupStepShell, SignupWizardActions } from "../signup/SignupShell";

const LOGIN_ICON = iconPath("user-add-account-profile-svgrepo-com.svg");

const inputBase =
  "w-full rounded-xl border border-slate-200/90 bg-white/90 px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-200/60";
const inputErr = "border-red-400 bg-red-50/60 focus:border-red-400 focus:ring-red-200/60";
const labelCls = "mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500";

const TOTAL_STEPS = 2;

function FieldLabel({ children }: { children: ReactNode }) {
  return <label className={labelCls}>{children}</label>;
}

function TextField({
  value,
  onChange,
  placeholder,
  type = "text",
  error,
  autoComplete
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  error?: boolean;
  autoComplete?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      autoComplete={autoComplete}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`${inputBase} ${error ? inputErr : ""}`}
    />
  );
}

function PasswordField({
  value,
  onChange,
  placeholder,
  error,
  autoComplete,
  showPassword,
  onToggleShow
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: boolean;
  autoComplete?: string;
  showPassword: boolean;
  onToggleShow: () => void;
}) {
  return (
    <div className="relative">
      <input
        type={showPassword ? "text" : "password"}
        value={value}
        autoComplete={autoComplete}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`signup-password-input ${inputBase} pr-11 ${error ? inputErr : ""}`}
      />
      <button
        type="button"
        onClick={onToggleShow}
        aria-label={showPassword ? "Hide password" : "Show password"}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-1.5 py-0.5 text-base leading-none opacity-80 transition hover:opacity-100"
      >
        {showPassword ? "🙈" : "👁"}
      </button>
    </div>
  );
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

type Props = {
  onExit: () => void;
  onForgotPassword?: () => void;
  onSigningInChange?: (signingIn: boolean) => void;
};

export function LoginWizard({ onExit, onForgotPassword, onSigningInChange }: Props) {
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});
  const [btnErr, setBtnErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fieldErr = (key: string) => Boolean(fieldErrors[key]);
  const clearField = (key: string) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const goBack = () => {
    setBtnErr(null);
    if (step === 0) {
      onExit();
      return;
    }
    setStep((s) => s - 1);
  };

  const runLogin = async () => {
    setBusy(true);
    onSigningInChange?.(true);
    setBtnErr(null);
    const res = await login({ email: email.trim(), password });
    if (!res.ok || !res.token) {
      setBusy(false);
      onSigningInChange?.(false);
      setBtnErr(readApiMessage(res));
      return;
    }

    const pending = loadPendingBusinessProvision();
    if (pending?.registrationProfile) {
      const provisioned = await provisionBusinessWorkspace(res.token, pending.registrationProfile);
      if (!provisioned.ok || !provisioned.token) {
        setBusy(false);
        onSigningInChange?.(false);
        setBtnErr(readApiMessage(provisioned));
        return;
      }
      clearPendingBusinessProvision();
      clearSignupSession();
      handoffToAdminApp(provisioned.token);
      return;
    }

    handoffToAdminApp(res.token);
  };

  const goNext = () => {
    setBtnErr(null);
    if (step === 0) {
      const missing: Record<string, boolean> = {};
      if (!email.trim()) missing.email = true;
      else if (!isValidEmail(email)) missing.email = true;
      if (Object.keys(missing).length > 0) {
        setFieldErrors(missing);
        setBtnErr(!email.trim() ? "Enter your work email" : "Enter a valid email address");
        return;
      }
      setFieldErrors({});
      setStep(1);
      return;
    }
    if (step === 1) {
      const missing: Record<string, boolean> = {};
      if (!password.trim()) missing.password = true;
      else if (password.length < 8) missing.password = true;
      if (Object.keys(missing).length > 0) {
        setFieldErrors(missing);
        setBtnErr(!password.trim() ? "Enter your password" : "Password must be at least 8 characters");
        return;
      }
      void runLogin();
    }
  };

  const wizardFooter = (
    <>
      <SignupWizardActions
        onBack={goBack}
        onContinue={goNext}
        continueLabel={step >= TOTAL_STEPS - 1 ? (busy ? "Signing in…" : "Sign in") : "Continue"}
        continueBusy={busy}
      />
      {btnErr ? <p className="mt-3 text-center text-sm font-medium text-red-600">{btnErr}</p> : null}
    </>
  );

  const stepBody =
    step === 0 ? (
      <SignupStepShell
        stepKey={step}
        iconSrc={LOGIN_ICON}
        title="Your work email"
        description={
          <p className="text-center text-sm sm:text-base">
            Enter the email you use for your ServeOS owner or staff account.
          </p>
        }
        footer={wizardFooter}
      >
        <div>
          <FieldLabel>Work email</FieldLabel>
          <TextField
            value={email}
            onChange={(v) => {
              clearField("email");
              setEmail(v);
            }}
            type="email"
            placeholder="Work email"
            error={fieldErr("email")}
            autoComplete="email"
          />
        </div>
      </SignupStepShell>
    ) : (
      <SignupStepShell
        stepKey={step}
        iconSrc={LOGIN_ICON}
        title="Your password"
        description={
          <p className="text-center text-sm sm:text-base">
            Sign in to open your ServeOS workspace.
          </p>
        }
        footer={wizardFooter}
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3 text-sm text-slate-600">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Email</span>
            <p className="mt-1 font-semibold text-slate-900">{email.trim()}</p>
          </div>
          <div>
            <FieldLabel>Password</FieldLabel>
            <PasswordField
              value={password}
              onChange={(v) => {
                clearField("password");
                setPassword(v);
              }}
              placeholder="Password"
              error={fieldErr("password")}
              autoComplete="current-password"
              showPassword={showPassword}
              onToggleShow={() => setShowPassword((s) => !s)}
            />
          </div>
          {onForgotPassword ? (
            <p className="text-right text-sm">
              <button
                type="button"
                onClick={onForgotPassword}
                className="font-semibold text-violet-700 underline decoration-violet-300 underline-offset-2 transition hover:text-violet-900"
              >
                Forgot password?
              </button>
            </p>
          ) : null}
        </div>
      </SignupStepShell>
    );

  return (
    <div className="signup-wizard-stage relative w-full">
      {stepBody}
      {busy ? <SignupRegistrationLoader mode="sign-in" /> : null}
    </div>
  );
}
