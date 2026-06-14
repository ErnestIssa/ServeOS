import { useState, type ReactNode } from "react";
import { confirmPasswordReset, mapPasswordResetError, requestPasswordReset } from "../api";
import { iconPath } from "../marketing/assetPaths";
import { BtnPrimary } from "../marketing/ui";
import { SignupStepShell, SignupWizardActions } from "../signup/SignupShell";

const RESET_ICON = iconPath("user-add-account-profile-svgrepo-com.svg");

const inputBase =
  "w-full rounded-xl border border-slate-200/90 bg-white/90 px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-200/60";
const inputErr = "border-red-400 bg-red-50/60 focus:border-red-400 focus:ring-red-200/60";
const labelCls = "mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500";

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

type RequestProps = {
  mode: "request";
  onExit: () => void;
};

type ConfirmProps = {
  mode: "confirm";
  resetToken: string;
  onExit: () => void;
  onSuccess: () => void;
};

type Props = RequestProps | ConfirmProps;

export function PasswordResetWizard(props: Props) {
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});
  const [btnErr, setBtnErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [done, setDone] = useState(false);

  const fieldErr = (key: string) => Boolean(fieldErrors[key]);
  const clearField = (key: string) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const submitRequest = async () => {
    setBtnErr(null);
    const missing: Record<string, boolean> = {};
    if (!email.trim()) missing.email = true;
    else if (!isValidEmail(email)) missing.email = true;
    if (Object.keys(missing).length > 0) {
      setFieldErrors(missing);
      setBtnErr(!email.trim() ? "Enter your work email" : "Enter a valid email address");
      return;
    }

    setBusy(true);
    const res = await requestPasswordReset(email);
    setBusy(false);
    if (!res.ok) {
      setBtnErr(mapPasswordResetError(res));
      return;
    }
    setSent(true);
  };

  const submitConfirm = async () => {
    if (props.mode !== "confirm") return;
    setBtnErr(null);
    const missing: Record<string, boolean> = {};
    if (!newPassword.trim()) missing.newPassword = true;
    else if (newPassword.length < 8) missing.newPassword = true;
    if (!confirmPassword.trim()) missing.confirmPassword = true;
    if (Object.keys(missing).length > 0) {
      setFieldErrors(missing);
      setBtnErr("Enter and confirm your new password (at least 8 characters).");
      return;
    }

    setBusy(true);
    const res = await confirmPasswordReset({
      token: props.resetToken,
      newPassword,
      confirmPassword
    });
    setBusy(false);
    if (!res.ok) {
      setBtnErr(mapPasswordResetError(res));
      return;
    }
    setDone(true);
  };

  if (props.mode === "request" && sent) {
    return (
      <SignupStepShell
        stepKey="reset-sent"
        iconSrc={RESET_ICON}
        title="Check your email"
        description={
          <p className="text-center text-sm sm:text-base">
            If an account exists for <strong>{email.trim()}</strong>, we sent a password reset link. It expires in
            one hour.
          </p>
        }
        footer={
          <div className="flex flex-col items-center gap-4">
            <BtnPrimary onClick={props.onExit} className="w-full max-w-xs px-8 py-3.5 text-base sm:w-auto">
              Back to sign in
            </BtnPrimary>
          </div>
        }
      />
    );
  }

  if (props.mode === "confirm" && done) {
    return (
      <SignupStepShell
        stepKey="reset-done"
        iconSrc={RESET_ICON}
        title="Password updated"
        description={
          <p className="text-center text-sm sm:text-base">
            Your password has been changed. Sign in with your new password to open your workspace.
          </p>
        }
        footer={
          <div className="flex flex-col items-center gap-4">
            <BtnPrimary onClick={props.onSuccess} className="w-full max-w-xs px-8 py-3.5 text-base sm:w-auto">
              Continue to sign in
            </BtnPrimary>
          </div>
        }
      />
    );
  }

  const requestFooter = (
    <>
      <SignupWizardActions
        onBack={props.onExit}
        onContinue={() => void submitRequest()}
        continueLabel={busy ? "Sending…" : "Send reset link"}
        continueBusy={busy}
      />
      {btnErr ? <p className="mt-3 text-center text-sm font-medium text-red-600">{btnErr}</p> : null}
    </>
  );

  const confirmFooter = (
    <>
      <SignupWizardActions
        onBack={props.onExit}
        onContinue={() => void submitConfirm()}
        continueLabel={busy ? "Updating…" : "Set new password"}
        continueBusy={busy}
      />
      {btnErr ? <p className="mt-3 text-center text-sm font-medium text-red-600">{btnErr}</p> : null}
    </>
  );

  if (props.mode === "request") {
    return (
      <SignupStepShell
        stepKey="reset-request"
        iconSrc={RESET_ICON}
        title="Reset your password"
        description={
          <p className="text-center text-sm sm:text-base">
            Enter the email on your ServeOS account. We&apos;ll send a secure link to choose a new password.
          </p>
        }
        footer={requestFooter}
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
    );
  }

  return (
    <SignupStepShell
      stepKey="reset-confirm"
      iconSrc={RESET_ICON}
      title="Choose a new password"
      description={
        <p className="text-center text-sm sm:text-base">
          Enter a strong password for your ServeOS account. Other signed-in devices will be signed out.
        </p>
      }
      footer={confirmFooter}
    >
      <div className="space-y-4">
        <div>
          <FieldLabel>New password</FieldLabel>
          <PasswordField
            value={newPassword}
            onChange={(v) => {
              clearField("newPassword");
              setNewPassword(v);
            }}
            placeholder="New password"
            error={fieldErr("newPassword")}
            autoComplete="new-password"
            showPassword={showNewPassword}
            onToggleShow={() => setShowNewPassword((s) => !s)}
          />
        </div>
        <div>
          <FieldLabel>Confirm new password</FieldLabel>
          <PasswordField
            value={confirmPassword}
            onChange={(v) => {
              clearField("confirmPassword");
              setConfirmPassword(v);
            }}
            placeholder="Confirm new password"
            error={fieldErr("confirmPassword")}
            autoComplete="new-password"
            showPassword={showConfirmPassword}
            onToggleShow={() => setShowConfirmPassword((s) => !s)}
          />
        </div>
      </div>
    </SignupStepShell>
  );
}
