type Props = {
  emailHint?: string | null;
  title?: string;
  description?: string;
  onSignIn: () => void;
  onForgotPassword?: () => void;
  onTryAnotherEmail?: () => void;
};

export function IdentityRecoveryPanel({
  emailHint,
  title = "We found an existing ServeOS account",
  description,
  onSignIn,
  onForgotPassword,
  onTryAnotherEmail
}: Props) {
  const body =
    description ??
    (emailHint
      ? `An account already exists for ${emailHint}. Sign in with that identity to continue — ServeOS uses one login across all restaurants and roles.`
      : "An account already exists with these credentials. Sign in to continue with your existing identity.");

  return (
    <div className="identity-recovery-panel">
      <h3 className="identity-recovery-panel__title">{title}</h3>
      <p className="identity-recovery-panel__text">{body}</p>
      <div className="identity-recovery-panel__actions">
        <button type="button" className="enroll-primary-btn w-full" onClick={onSignIn}>
          Sign in to continue
        </button>
        {onForgotPassword ? (
          <button type="button" className="enroll-secondary-btn w-full" onClick={onForgotPassword}>
            Forgot password
          </button>
        ) : null}
        {onTryAnotherEmail ? (
          <button type="button" className="enroll-link-btn mx-auto" onClick={onTryAnotherEmail}>
            Use a different email
          </button>
        ) : null}
      </div>
    </div>
  );
}
