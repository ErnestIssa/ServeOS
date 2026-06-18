import { useCallback, useEffect, useMemo, useState } from "react";
import { iconPath } from "../marketing/assetPaths";
import { clearAdminToken, persistAdminToken } from "../authStorage";
import { handoffToAdminApp } from "../signup/adminHandoff";
import { ServeOsWordmark, SignupStepShell } from "../signup/SignupShell";
import {
  acceptWorkspaceEnrollment,
  enrollmentErrorMessage,
  resolveWorkspaceInvite,
  type InviteResolveOk
} from "./workspaceEnrollmentApi";
import { clearStoredInviteSearch, readInviteTokenFromLocation } from "../inviteToken";
import { IdentityRecoveryPanel } from "../auth/IdentityRecoveryPanel";
import { inviteEnrollmentReturnPath } from "../auth/safeReturnTo";
import { PasswordResetWizard } from "../login/PasswordResetWizard";

const ENROLL_ICON = iconPath("register-svgrepo-com.svg");

type Phase = "loading" | "error" | "gateway" | "create" | "login" | "merge" | "forgot" | "success";

type Props = {
  onBack: () => void;
  onGoLogin?: () => void;
};

function readInviteToken(): string | null {
  return readInviteTokenFromLocation();
}

function roleBadgeClass(role: string): string {
  switch (role) {
    case "OWNER":
    case "MANAGER":
      return "enroll-role-badge enroll-role-badge--manager";
    case "KITCHEN":
      return "enroll-role-badge enroll-role-badge--kitchen";
    case "CASHIER":
      return "enroll-role-badge enroll-role-badge--cashier";
    case "CUSTOMER":
      return "enroll-role-badge enroll-role-badge--customer";
    default:
      return "enroll-role-badge enroll-role-badge--staff";
  }
}

function passwordStrength(password: string): { label: string; tone: "weak" | "fair" | "strong" } {
  if (password.length < 8) return { label: "Too short", tone: "weak" };
  const hasMix =
    /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
  if (password.length >= 12 && hasMix) return { label: "Strong", tone: "strong" };
  if (password.length >= 8) return { label: "Fair", tone: "fair" };
  return { label: "Weak", tone: "weak" };
}

function BackButton({ onClick }: { onClick: () => void }) {
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

function InviteSummaryCard({ resolved }: { resolved: InviteResolveOk }) {
  return (
    <div className="enroll-invite-card w-full max-w-md">
      <p className="enroll-invite-venue">{resolved.invite.restaurantName}</p>
      <span className={roleBadgeClass(resolved.invite.intendedRole)}>{resolved.invite.roleLabel}</span>
      <p className="enroll-invite-meta">
        Invited as <strong>{resolved.invite.inviteEmailMasked}</strong>
      </p>
      {resolved.invite.fullName ? (
        <p className="enroll-invite-meta mt-1">
          Name on invite: <strong>{resolved.invite.fullName}</strong>
        </p>
      ) : null}
    </div>
  );
}

function PathCard({
  title,
  description,
  cta,
  tone = "default",
  recommended,
  disabled,
  onClick
}: {
  title: string;
  description: string;
  cta: string;
  tone?: "default" | "primary";
  recommended?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`enroll-path-card ${tone === "primary" ? "enroll-path-card--primary" : ""} ${
        recommended ? "enroll-path-card--recommended" : ""
      }`}
      disabled={disabled}
      onClick={onClick}
    >
      <div className="enroll-path-card__head">
        <p className="enroll-path-card__title">{title}</p>
        {recommended ? <span className="enroll-path-card__badge">Recommended</span> : null}
      </div>
      <p className="enroll-path-card__text">{description}</p>
      <span className="enroll-path-card__cta">{cta}</span>
    </button>
  );
}

export function WorkspaceEnrollmentPage({ onBack }: Props) {
  const inviteToken = useMemo(readInviteToken, []);
  const [phase, setPhase] = useState<Phase>("loading");
  const [resolved, setResolved] = useState<InviteResolveOk | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [successNote, setSuccessNote] = useState<string | null>(null);

  const strength = useMemo(() => passwordStrength(password), [password]);
  const passwordsMatch = !confirmPassword || password === confirmPassword;

  const pickInitialPhase = useCallback((result: InviteResolveOk): Phase => {
    if (result.identity.state === "ALREADY_JOINED") return "success";
    if (result.actions.recommended === "login" || result.identity.hasUsableAccount) return "login";
    if (result.actions.recommended === "create_account") return "create";
    if (result.actions.recommended === "use_existing") return "gateway";
    return "gateway";
  }, []);

  const loadResolve = useCallback(async () => {
    if (!inviteToken) {
      setPhase("error");
      setError("Missing invitation token. Open the link from your email.");
      return;
    }
    setPhase("loading");
    setError(null);
    const result = await resolveWorkspaceInvite(inviteToken);
    if (!result.ok) {
      setPhase("error");
      setError(enrollmentErrorMessage(result.error));
      return;
    }
    setResolved(result);
    setFullName(result.invite.fullName ?? "");
    if (result.identity.state === "ALREADY_JOINED") {
      setPhase("success");
      setSuccessNote("You are already connected to this workspace.");
      return;
    }
    setPhase(pickInitialPhase(result));
  }, [inviteToken, pickInitialPhase]);

  useEffect(() => {
    void loadResolve();
  }, [loadResolve]);

  async function finishAccept(
    action: "create_account" | "use_existing" | "merge_accounts",
    opts?: { mergeConfirm?: boolean }
  ) {
    if (!inviteToken) return;
    if (action === "create_account") {
      if (password.length < 8) {
        setError("Choose a password with at least 8 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
      if (resolved?.session.state === "MISMATCH") {
        clearAdminToken();
      }
    }

    setBusy(true);
    setError(null);
    const result = await acceptWorkspaceEnrollment({
      token: inviteToken,
      action,
      password: password || undefined,
      fullName: fullName.trim() || undefined,
      phone: phone.trim() || undefined,
      mergeConfirm: opts?.mergeConfirm
    });
    setBusy(false);
    if (!result.ok) {
      const code = result.error;
      if (code === "identity_exists_use_login" || code === "account_already_exists") {
        setPhase("login");
      }
      setError(enrollmentErrorMessage(code));
      return;
    }

    persistAdminToken(result.token);
    clearStoredInviteSearch();
    setPhase("success");
    if (result.merged) {
      setSuccessNote("Accounts merged and workspace connected.");
    } else if (result.pendingApproval) {
      setSuccessNote("Request submitted — an admin must approve your access.");
    } else if (result.intendedRole === "CUSTOMER") {
      setSuccessNote("You are now connected as a customer.");
    } else {
      setSuccessNote("Workspace connected successfully.");
    }

    window.setTimeout(() => {
      if (result.redirectPath === "/admin") {
        handoffToAdminApp(result.token);
      } else {
        onBack();
      }
    }, 2200);
  }

  function handleSwitchAccount() {
    clearAdminToken();
    setPassword("");
    setConfirmPassword("");
    setError(null);
    void loadResolve();
  }

  const createDescription =
    resolved?.identity.hasUsableAccount === false && resolved.identity.state === "NEW"
      ? "Set up your ServeOS login for this invitation."
      : "Finish setting up your account to accept this invitation.";

  return (
    <div className="relative min-h-[100dvh] w-full bg-white/92">
      <div className="fixed left-5 top-6 z-50 sm:left-8 sm:top-8">
        <BackButton onClick={onBack} />
      </div>
      <div className="fixed right-5 top-6 z-50 sm:right-8 sm:top-8">
        <ServeOsWordmark className="text-xl sm:text-2xl" />
      </div>

      <main className="flex min-h-[100dvh] flex-col px-5 pb-12 pt-20 sm:px-8 sm:pb-16 sm:pt-24">
        <div className="signup-slot mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center py-6">
          {phase === "loading" ? (
            <SignupStepShell
              stepKey="loading"
              iconSrc={ENROLL_ICON}
              title="Checking your invitation"
              description={
                <p className="mx-auto max-w-md text-center text-sm text-slate-500">
                  Validating secure workspace enrollment…
                </p>
              }
            />
          ) : null}

          {phase === "error" ? (
            <SignupStepShell
              stepKey="error"
              iconSrc={ENROLL_ICON}
              title="Invitation unavailable"
              description={
                <p className="mx-auto max-w-md text-center text-sm font-medium text-rose-600">{error}</p>
              }
              footer={
                <button
                  type="button"
                  onClick={onBack}
                  className="mx-auto block text-sm font-semibold text-violet-700 underline decoration-violet-300 underline-offset-2"
                >
                  Return to ServeOS
                </button>
              }
            />
          ) : null}

          {phase === "success" ? (
            <SignupStepShell
              stepKey="success"
              iconSrc={ENROLL_ICON}
              title="You're all set"
              description={
                <p className="mx-auto max-w-md text-center text-sm text-slate-600">
                  {successNote ?? "Redirecting you now…"}
                </p>
              }
            />
          ) : null}

          {resolved && (phase === "gateway" || phase === "create" || phase === "login" || phase === "merge" || phase === "forgot") ? (
            <SignupStepShell
              stepKey={phase}
              iconSrc={ENROLL_ICON}
              iconClassName="h-16 w-16 opacity-90 sm:h-20 sm:w-20"
              title={
                phase === "create"
                  ? "Create your account"
                  : phase === "login"
                    ? "Sign in to join"
                    : phase === "forgot"
                      ? "Reset your password"
                      : "Accept your workspace invitation"
              }
              description={
                <div className="flex w-full flex-col items-center gap-4">
                  <InviteSummaryCard resolved={resolved} />
                  {error ? <p className="text-center text-sm font-medium text-rose-600">{error}</p> : null}
                </div>
              }
              descriptionClassName="w-full"
            >
              <div className="enroll-gateway">
                {resolved.session.state === "MISMATCH" && phase !== "merge" ? (
                  <div className="enroll-notice enroll-notice--warn">
                    <p className="enroll-notice__title">Different account signed in</p>
                    <p className="enroll-notice__text">
                      You are signed in as <strong>{resolved.session.user?.emailMasked}</strong>, but this invite is
                      for <strong>{resolved.invite.inviteEmailMasked}</strong>.
                    </p>
                    <button type="button" className="enroll-link-btn" onClick={handleSwitchAccount}>
                      Sign out and continue with invited email
                    </button>
                  </div>
                ) : null}

                {resolved.session.state === "MATCHES_INVITE" && phase === "gateway" ? (
                  <div className="enroll-notice enroll-notice--info">
                    <p className="enroll-notice__title">Signed in as invited email</p>
                    <p className="enroll-notice__text">
                      Continue with <strong>{resolved.session.user?.emailMasked}</strong> to join this workspace.
                    </p>
                  </div>
                ) : null}

                {resolved.identity.hasUsableAccount && phase === "login" ? (
                  <div className="enroll-notice enroll-notice--info">
                    <p className="enroll-notice__title">One ServeOS identity</p>
                    <p className="enroll-notice__text">
                      <strong>{resolved.invite.inviteEmailMasked}</strong> already has an account. Sign in to attach
                      this invitation to your existing identity
                      {resolved.membershipAtVenue?.isOperational
                        ? ` (you currently have ${resolved.membershipAtVenue.role} access here).`
                        : resolved.membershipAtVenue
                          ? " and update your workspace access."
                          : ` as ${resolved.invite.roleLabel} at ${resolved.invite.restaurantName}.`}
                    </p>
                  </div>
                ) : null}

                {phase === "forgot" ? (
                  <PasswordResetWizard
                    mode="request"
                    defaultEmail={resolved.invite.inviteEmail}
                    returnTo={inviteToken ? inviteEnrollmentReturnPath(inviteToken) : null}
                    onExit={() => setPhase("login")}
                  />
                ) : null}

                {phase === "gateway" ? (
                  <>
                    <section className="enroll-section">
                      <h2 className="enroll-section-title">Choose how to continue</h2>
                      <p className="enroll-section-text">
                        {resolved.actions.canCreateAccount
                          ? "No ServeOS login is required yet — create one for the invited email, or sign in if you already have access."
                          : "Use the option that matches the invited email address."}
                      </p>
                      <div className="enroll-path-grid">
                        {resolved.actions.canCreateAccount ? (
                          <PathCard
                            title="Create a new account"
                            description={`Set a password for ${resolved.invite.inviteEmailMasked} and join ${resolved.invite.restaurantName}.`}
                            cta="Create account and join"
                            tone="primary"
                            recommended={resolved.actions.recommended === "create_account"}
                            disabled={busy}
                            onClick={() => {
                              setError(null);
                              setPhase("create");
                            }}
                          />
                        ) : null}

                        {resolved.actions.canUseExisting ? (
                          <PathCard
                            title="Continue with this account"
                            description="You are already signed in with the invited email."
                            cta="Join workspace"
                            tone="primary"
                            recommended={resolved.actions.recommended === "use_existing"}
                            disabled={busy}
                            onClick={() => void finishAccept("use_existing")}
                          />
                        ) : null}

                        {resolved.actions.requiresLogin ? (
                          <PathCard
                            title="Sign in with existing account"
                            description={`Use the password for ${resolved.invite.inviteEmailMasked}.`}
                            cta="Sign in and join"
                            recommended={resolved.actions.recommended === "login"}
                            disabled={busy}
                            onClick={() => {
                              setError(null);
                              setPhase("login");
                            }}
                          />
                        ) : null}

                        {resolved.actions.canMerge ? (
                          <PathCard
                            title="Merge accounts"
                            description="Combine duplicate logins and keep your current session."
                            cta="Review merge"
                            recommended={resolved.actions.recommended === "merge"}
                            disabled={busy}
                            onClick={() => {
                              setError(null);
                              setPhase("merge");
                            }}
                          />
                        ) : null}

                        {resolved.actions.requiresSwitchAccount ? (
                          <PathCard
                            title="Use the invited email"
                            description="Sign out of the current account to continue with the correct email."
                            cta="Switch account"
                            recommended={resolved.actions.recommended === "switch_account"}
                            disabled={busy}
                            onClick={handleSwitchAccount}
                          />
                        ) : null}
                      </div>
                    </section>

                    {resolved.actions.canCreateAccount ? (
                      <p className="enroll-footnote">
                        New to ServeOS? Choose <strong>Create a new account</strong> — it only takes a minute.
                      </p>
                    ) : null}
                  </>
                ) : null}

                {phase === "create" ? (
                  resolved.identity.hasUsableAccount ? (
                    <IdentityRecoveryPanel
                      emailHint={resolved.invite.inviteEmailMasked}
                      description={`${resolved.invite.inviteEmailMasked} already has a ServeOS login. Sign in to join ${resolved.invite.restaurantName} as ${resolved.invite.roleLabel}.`}
                      onSignIn={() => {
                        setError(null);
                        setPhase("login");
                      }}
                      onForgotPassword={() => {
                        setError(null);
                        setPhase("forgot");
                      }}
                    />
                  ) : (
                  <form
                    className="enroll-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void finishAccept("create_account");
                    }}
                  >
                    <p className="enroll-section-text">{createDescription}</p>

                    <label className="enroll-field-label" htmlFor="enroll-email">
                      Email
                    </label>
                    <input
                      id="enroll-email"
                      className="enroll-input enroll-input--readonly"
                      value={resolved.invite.inviteEmailMasked}
                      readOnly
                      aria-readonly
                    />

                    <label className="enroll-field-label mt-4" htmlFor="enroll-name">
                      Full name
                    </label>
                    <input
                      id="enroll-name"
                      className="enroll-input"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      autoComplete="name"
                      placeholder="First and last name"
                    />

                    <label className="enroll-field-label mt-4" htmlFor="enroll-phone">
                      Phone (optional)
                    </label>
                    <input
                      id="enroll-phone"
                      className="enroll-input"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      autoComplete="tel"
                      placeholder="+46 …"
                    />

                    <label className="enroll-field-label mt-4" htmlFor="enroll-password">
                      Password
                    </label>
                    <input
                      id="enroll-password"
                      type="password"
                      className="enroll-input"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                    />
                    {password ? (
                      <p className={`enroll-password-strength enroll-password-strength--${strength.tone}`}>
                        Password strength: {strength.label}
                      </p>
                    ) : null}

                    <label className="enroll-field-label mt-4" htmlFor="enroll-confirm-password">
                      Confirm password
                    </label>
                    <input
                      id="enroll-confirm-password"
                      type="password"
                      className="enroll-input"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      aria-invalid={!passwordsMatch}
                    />
                    {!passwordsMatch ? (
                      <p className="enroll-field-error" role="alert">
                        Passwords do not match.
                      </p>
                    ) : null}

                    <div className="enroll-form-actions">
                      <button
                        type="button"
                        className="enroll-secondary-btn"
                        onClick={() => {
                          setError(null);
                          setPhase("gateway");
                        }}
                      >
                        Back
                      </button>
                      <button
                        type="submit"
                        className="enroll-primary-btn"
                        disabled={busy || !passwordsMatch || password.length < 8}
                      >
                        {busy ? "Creating account…" : "Create account and join"}
                      </button>
                    </div>
                  </form>
                  )
                ) : null}

                {phase === "login" ? (
                  <form
                    className="enroll-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void finishAccept("use_existing");
                    }}
                  >
                    <p className="enroll-section-text">
                      Sign in with the password for <strong>{resolved.invite.inviteEmailMasked}</strong>.
                    </p>
                    <label className="enroll-field-label" htmlFor="enroll-login-password">
                      Password
                    </label>
                    <input
                      id="enroll-login-password"
                      type="password"
                      className="enroll-input"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="current-password"
                    />
                    <div className="enroll-form-actions">
                      <button type="button" className="enroll-secondary-btn" onClick={() => setPhase("gateway")}>
                        Back
                      </button>
                      <button type="submit" className="enroll-primary-btn" disabled={busy}>
                        {busy ? "Joining…" : "Sign in and join"}
                      </button>
                    </div>
                    <div className="enroll-form-actions mt-2 !grid-cols-1">
                      <button
                        type="button"
                        className="enroll-secondary-btn"
                        onClick={() => {
                          setError(null);
                          setPhase("forgot");
                        }}
                      >
                        Forgot password
                      </button>
                    </div>
                    {resolved.actions.canCreateAccount ? (
                      <p className="enroll-footnote">
                        New to ServeOS?{" "}
                        <button
                          type="button"
                          className="enroll-inline-link"
                          onClick={() => {
                            setError(null);
                            setPhase("create");
                          }}
                        >
                          Create an account instead
                        </button>
                      </p>
                    ) : null}
                  </form>
                ) : null}

                {phase === "merge" ? (
                  <div className="enroll-form">
                    <h2 className="enroll-section-title">Merge accounts</h2>
                    <p className="enroll-section-text">
                      We found another ServeOS account for <strong>{resolved.invite.inviteEmailMasked}</strong>.
                      Merging will combine workspace access into your current session (
                      {resolved.session.user?.emailMasked}) and retire the duplicate login.
                    </p>
                    <div className="enroll-form-actions">
                      <button type="button" className="enroll-secondary-btn" onClick={() => setPhase("gateway")}>
                        Back
                      </button>
                      <button
                        type="button"
                        className="enroll-primary-btn"
                        disabled={busy}
                        onClick={() => void finishAccept("merge_accounts", { mergeConfirm: true })}
                      >
                        {busy ? "Merging…" : "Merge and join"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </SignupStepShell>
          ) : null}
        </div>
      </main>
    </div>
  );
}
