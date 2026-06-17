import { useCallback, useEffect, useMemo, useState } from "react";
import { iconPath } from "../marketing/assetPaths";
import { clearAdminToken, persistAdminToken, readStoredAdminToken } from "../authStorage";
import { handoffToAdminApp } from "../signup/adminHandoff";
import { ServeOsWordmark, SignupStepShell } from "../signup/SignupShell";
import {
  acceptWorkspaceEnrollment,
  enrollmentErrorMessage,
  resolveWorkspaceInvite,
  type InviteResolveOk
} from "./workspaceEnrollmentApi";
import { clearStoredInviteSearch, readInviteTokenFromLocation } from "../inviteToken";

const ENROLL_ICON = iconPath("register-svgrepo-com.svg");

type Phase = "loading" | "error" | "gateway" | "create" | "login" | "merge" | "success";

type Props = {
  onBack: () => void;
  onGoLogin: () => void;
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

export function WorkspaceEnrollmentPage({ onBack, onGoLogin }: Props) {
  const inviteToken = useMemo(readInviteToken, []);
  const [phase, setPhase] = useState<Phase>("loading");
  const [resolved, setResolved] = useState<InviteResolveOk | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [successNote, setSuccessNote] = useState<string | null>(null);

  const loadResolve = useCallback(async () => {
    if (!inviteToken) {
      setPhase("error");
      setError("Missing invitation token. Open the link from your email.");
      return;
    }
    setPhase("loading");
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
    setPhase("gateway");
  }, [inviteToken]);

  useEffect(() => {
    void loadResolve();
  }, [loadResolve]);

  async function finishAccept(
    action: "create_account" | "use_existing" | "merge_accounts",
    opts?: { mergeConfirm?: boolean }
  ) {
    if (!inviteToken) return;
    setBusy(true);
    setError(null);
    const result = await acceptWorkspaceEnrollment({
      token: inviteToken,
      action,
      password: password || undefined,
      fullName: fullName.trim() || undefined,
      mergeConfirm: opts?.mergeConfirm
    });
    setBusy(false);
    if (!result.ok) {
      setError(enrollmentErrorMessage(result.error));
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
    void loadResolve();
  }

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

          {resolved && (phase === "gateway" || phase === "create" || phase === "login" || phase === "merge") ? (
            <SignupStepShell
              stepKey={phase}
              iconSrc={ENROLL_ICON}
              iconClassName="h-16 w-16 opacity-90 sm:h-20 sm:w-20"
              title="You've been invited to join ServeOS"
              description={
                <div className="flex w-full flex-col items-center gap-4">
                  <div className="enroll-invite-card w-full max-w-md">
                    <p className="enroll-invite-venue">{resolved.invite.restaurantName}</p>
                    <span className={roleBadgeClass(resolved.invite.intendedRole)}>
                      {resolved.invite.roleLabel}
                    </span>
                    <p className="enroll-invite-meta">
                      Invited as <strong>{resolved.invite.inviteEmailMasked}</strong>
                    </p>
                  </div>
                  {error ? <p className="text-center text-sm font-medium text-rose-600">{error}</p> : null}
                </div>
              }
              descriptionClassName="w-full"
            >
              <div className="enroll-gateway">
                {phase === "gateway" ? (
                  <>
                    <section className="enroll-section">
                      <h2 className="enroll-section-title">Identity check</h2>
                      {resolved.session.state === "NONE" ? (
                        <p className="enroll-section-text">
                          Sign in or create an account for{" "}
                          <strong>{resolved.invite.inviteEmailMasked}</strong> to join this workspace.
                        </p>
                      ) : (
                        <div className="enroll-session-card">
                          <p className="enroll-session-label">Signed in as</p>
                          <p className="enroll-session-email">{resolved.session.user?.emailMasked}</p>
                          {resolved.session.user?.fullName ? (
                            <p className="enroll-session-name">{resolved.session.user.fullName}</p>
                          ) : null}
                          <button
                            type="button"
                            className="enroll-link-btn"
                            onClick={handleSwitchAccount}
                          >
                            Switch account
                          </button>
                        </div>
                      )}
                    </section>

                    <section className="enroll-section">
                      <h2 className="enroll-section-title">How do you want to continue?</h2>
                      <div className="enroll-actions">
                        {resolved.actions.canCreateAccount ? (
                          <button
                            type="button"
                            className="enroll-primary-btn"
                            disabled={busy}
                            onClick={() => setPhase("create")}
                          >
                            Create new account and join
                          </button>
                        ) : null}

                        {resolved.session.state === "MATCHES_INVITE" && resolved.actions.canUseExisting ? (
                          <button
                            type="button"
                            className="enroll-primary-btn"
                            disabled={busy}
                            onClick={() => void finishAccept("use_existing")}
                          >
                            Continue with this account
                          </button>
                        ) : null}

                        {resolved.actions.requiresLogin ? (
                          <button
                            type="button"
                            className="enroll-secondary-btn"
                            disabled={busy}
                            onClick={() => setPhase("login")}
                          >
                            Join with existing account
                          </button>
                        ) : null}

                        {resolved.actions.canMerge ? (
                          <button
                            type="button"
                            className="enroll-secondary-btn"
                            disabled={busy}
                            onClick={() => setPhase("merge")}
                          >
                            Merge accounts and join
                          </button>
                        ) : null}

                        {resolved.actions.requiresSwitchAccount ? (
                          <button
                            type="button"
                            className="enroll-secondary-btn"
                            onClick={handleSwitchAccount}
                          >
                            Sign out and use invited email
                          </button>
                        ) : null}
                      </div>
                    </section>
                  </>
                ) : null}

                {phase === "create" ? (
                  <form
                    className="enroll-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void finishAccept("create_account");
                    }}
                  >
                    <h2 className="enroll-section-title">Create your account</h2>
                    <label className="enroll-field-label" htmlFor="enroll-name">
                      Full name
                    </label>
                    <input
                      id="enroll-name"
                      className="enroll-input"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      autoComplete="name"
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
                    <div className="enroll-form-actions">
                      <button type="button" className="enroll-secondary-btn" onClick={() => setPhase("gateway")}>
                        Back
                      </button>
                      <button type="submit" className="enroll-primary-btn" disabled={busy}>
                        {busy ? "Joining…" : "Create and join"}
                      </button>
                    </div>
                  </form>
                ) : null}

                {phase === "login" ? (
                  <form
                    className="enroll-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void finishAccept("use_existing");
                    }}
                  >
                    <h2 className="enroll-section-title">Sign in to join</h2>
                    <p className="enroll-section-text">
                      Use the password for <strong>{resolved.invite.inviteEmailMasked}</strong>.
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
                  </form>
                ) : null}

                {phase === "merge" ? (
                  <div className="enroll-form">
                    <h2 className="enroll-section-title">Merge accounts</h2>
                    <p className="enroll-section-text">
                      We found another ServeOS account for{" "}
                      <strong>{resolved.invite.inviteEmailMasked}</strong>. Merging will combine workspace access
                      into your current session ({resolved.session.user?.emailMasked}) and retire the duplicate
                      login.
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
