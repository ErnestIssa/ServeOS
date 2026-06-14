import { useEffect, useState } from "react";
import { AdminInput, AdminLabel } from "../AdminUi";
import { readApiMessage, type UserSessionRow } from "./accountApi";
import { ProfileModalAlert, ProfileModalFooter, ProfileModalNote, ProfileModalShell } from "./ProfileModalShell";
import { ProfileToggleRow } from "./ProfileUi";
import { VerificationPasswordInput } from "./VerificationPasswordInput";

function formatSessionWhen(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function SignOutSessionsModal({
  open,
  busy,
  sessions,
  onClose,
  onConfirm
}: {
  open: boolean;
  busy: boolean;
  sessions: UserSessionRow[];
  onClose: () => void;
  onConfirm: (sessionIds: string[]) => Promise<{ ok: boolean; error?: string; signedOut?: number }>;
}) {
  const revokable = sessions.filter((s) => !s.isCurrent);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [signedOutCount, setSignedOutCount] = useState(0);

  useEffect(() => {
    if (!open) {
      setSelected({});
      setErr(null);
      setDone(false);
      setSignedOutCount(0);
      return;
    }
    const init: Record<string, boolean> = {};
    revokable.forEach((s) => {
      init[s.id] = true;
    });
    setSelected(init);
  }, [open, sessions]);

  const allSelected = revokable.length > 0 && revokable.every((s) => selected[s.id]);
  const selectedIds = revokable.filter((s) => selected[s.id]).map((s) => s.id);

  return (
    <ProfileModalShell
      open={open}
      onClose={onClose}
      title="Sign out sessions"
      description="Choose which devices to sign out. Your current session stays active on this device."
      titleId="sign-out-sessions-modal-title"
      busy={busy}
      maxWidthClass="max-w-lg"
    >
      {done ? (
        <>
          <ProfileModalAlert tone="success">
            {signedOutCount === 1
              ? "1 session was signed out."
              : `${signedOutCount} sessions were signed out.`}
          </ProfileModalAlert>
          <ProfileModalFooter onCancel={onClose} confirmLabel="Done" onConfirm={onClose} />
        </>
      ) : revokable.length === 0 ? (
        <>
          <ProfileModalNote>There are no other active sessions to sign out.</ProfileModalNote>
          <ProfileModalFooter onCancel={onClose} confirmLabel="Close" onConfirm={onClose} />
        </>
      ) : (
        <>
          <div className="admin-profile-sessions-modal-list">
            <ProfileToggleRow
              label="Select all"
              checked={allSelected}
              onChange={(on) => {
                const next: Record<string, boolean> = {};
                revokable.forEach((s) => {
                  next[s.id] = on;
                });
                setSelected(next);
              }}
            />
            <div className="admin-profile-toggle-divider my-2" />
            {revokable.map((s) => {
              const hint = [
                s.browser,
                s.ipMasked,
                s.location,
                `Last active ${formatSessionWhen(s.lastActiveAt)}`
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <ProfileToggleRow
                  key={s.id}
                  label={s.deviceName}
                  hint={hint}
                  checked={!!selected[s.id]}
                  onChange={(on) => setSelected((prev) => ({ ...prev, [s.id]: on }))}
                />
              );
            })}
          </div>
          {err ? <ProfileModalAlert tone="error">{err}</ProfileModalAlert> : null}
          <ProfileModalFooter
            onCancel={onClose}
            confirmLabel="Sign out selected"
            danger
            busy={busy}
            confirmDisabled={selectedIds.length === 0}
            onConfirm={async () => {
              setErr(null);
              const res = await onConfirm(selectedIds);
              if (!res.ok) {
                setErr(readApiMessage(res));
                return;
              }
              setSignedOutCount(res.signedOut ?? selectedIds.length);
              setDone(true);
            }}
          />
        </>
      )}
    </ProfileModalShell>
  );
}

export function ChangeEmailModal({
  open,
  currentEmail,
  busy,
  onClose,
  onSubmit
}: {
  open: boolean;
  currentEmail?: string | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (newEmail: string, password: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!open) {
      setNewEmail("");
      setPassword("");
      setErr(null);
      setSent(false);
    }
  }, [open]);

  return (
    <ProfileModalShell
      open={open}
      onClose={onClose}
      title="Change email"
      description="Verify your password, then confirm the new address from your inbox."
      titleId="change-email-modal-title"
      busy={busy}
    >
      {sent ? (
        <>
          <ProfileModalAlert tone="success">
            Verification email sent. Open the link in your new inbox to finish the change.
          </ProfileModalAlert>
          <ProfileModalFooter onCancel={onClose} confirmLabel="Done" onConfirm={onClose} />
        </>
      ) : (
        <div className="space-y-4">
          {currentEmail ? (
            <ProfileModalNote>
              Current email: <span className="font-semibold text-slate-900">{currentEmail}</span>
            </ProfileModalNote>
          ) : null}
          <AdminLabel>
            New email
            <AdminInput type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} autoComplete="email" />
          </AdminLabel>
          <AdminLabel>
            Current password
            <VerificationPasswordInput value={password} onChange={(e) => setPassword(e.target.value)} />
          </AdminLabel>
          {err ? <ProfileModalAlert tone="error">{err}</ProfileModalAlert> : null}
          <ProfileModalFooter
            onCancel={onClose}
            confirmLabel="Send verification"
            busy={busy}
            onConfirm={async () => {
              setErr(null);
              const res = await onSubmit(newEmail.trim(), password);
              if (!res.ok) {
                setErr(readApiMessage(res));
                return;
              }
              setSent(true);
            }}
          />
        </div>
      )}
    </ProfileModalShell>
  );
}

export function ChangePasswordModal({
  open,
  busy,
  onClose,
  onSubmit
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (body: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setErr(null);
      setDone(false);
    }
  }, [open]);

  return (
    <ProfileModalShell
      open={open}
      onClose={onClose}
      title="Update password"
      description="Other signed-in devices will be signed out after a successful change."
      titleId="change-password-modal-title"
      busy={busy}
    >
      {done ? (
        <>
          <ProfileModalAlert tone="success">Password updated. Other sessions were signed out.</ProfileModalAlert>
          <ProfileModalFooter onCancel={onClose} confirmLabel="Done" onConfirm={onClose} />
        </>
      ) : (
        <div className="space-y-4">
          <AdminLabel>
            Current password
            <VerificationPasswordInput value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </AdminLabel>
          <AdminLabel>
            New password
            <VerificationPasswordInput
              allowNewPasswordHints
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </AdminLabel>
          <AdminLabel>
            Confirm new password
            <VerificationPasswordInput
              allowNewPasswordHints
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </AdminLabel>
          {err ? <ProfileModalAlert tone="error">{err}</ProfileModalAlert> : null}
          <ProfileModalFooter
            onCancel={onClose}
            confirmLabel="Update password"
            busy={busy}
            onConfirm={async () => {
              setErr(null);
              const res = await onSubmit({ currentPassword, newPassword, confirmPassword });
              if (!res.ok) {
                setErr(readApiMessage(res));
                return;
              }
              setDone(true);
            }}
          />
        </div>
      )}
    </ProfileModalShell>
  );
}

export function TwoFactorModal({
  open,
  enabled,
  busy,
  otpauthUrl,
  onClose,
  onSetup,
  onEnable,
  onDisable
}: {
  open: boolean;
  enabled: boolean;
  busy: boolean;
  otpauthUrl: string | null;
  onClose: () => void;
  onSetup: () => Promise<void>;
  onEnable: (code: string) => Promise<{ ok: boolean; error?: string; backupCodes?: string[] }>;
  onDisable: (password: string, code?: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);

  useEffect(() => {
    if (!open) {
      setCode("");
      setPassword("");
      setErr(null);
      setBackupCodes(null);
    }
  }, [open]);

  useEffect(() => {
    if (open && !enabled && !otpauthUrl) void onSetup();
  }, [open, enabled, otpauthUrl, onSetup]);

  return (
    <ProfileModalShell
      open={open}
      onClose={onClose}
      title={enabled ? "Two-factor authentication" : "Enable 2FA"}
      description={
        enabled
          ? "Authenticator app (TOTP) is active on your account."
          : "Scan the QR code with your authenticator app, then enter the 6-digit code."
      }
      titleId="two-factor-modal-title"
      busy={busy}
      maxWidthClass="max-w-md"
    >
      {backupCodes ? (
        <>
          <p className="text-sm font-semibold text-slate-800">Save these backup codes in a secure place</p>
          <ul className="admin-profile-backup-codes mt-3 grid grid-cols-2 gap-2">
            {backupCodes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <ProfileModalFooter onCancel={onClose} confirmLabel="Done" onConfirm={onClose} />
        </>
      ) : enabled ? (
        <div className="space-y-4">
          <AdminLabel>
            Password
            <VerificationPasswordInput value={password} onChange={(e) => setPassword(e.target.value)} />
          </AdminLabel>
          <AdminLabel>
            Authenticator code (optional)
            <AdminInput value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" />
          </AdminLabel>
          {err ? <ProfileModalAlert tone="error">{err}</ProfileModalAlert> : null}
          <ProfileModalFooter
            onCancel={onClose}
            confirmLabel="Disable 2FA"
            danger
            busy={busy}
            onConfirm={async () => {
              setErr(null);
              const res = await onDisable(password, code || undefined);
              if (!res.ok) setErr(readApiMessage(res));
              else onClose();
            }}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {otpauthUrl ? (
            <div className="admin-profile-qr-wrap">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthUrl)}`}
                alt="Authenticator QR code"
                className="admin-profile-qr"
              />
            </div>
          ) : (
            <p className="text-center text-sm text-slate-500">Preparing your QR code…</p>
          )}
          <AdminLabel>
            6-digit code
            <AdminInput value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" />
          </AdminLabel>
          {err ? <ProfileModalAlert tone="error">{err}</ProfileModalAlert> : null}
          <ProfileModalFooter
            onCancel={onClose}
            confirmLabel="Enable 2FA"
            busy={busy}
            onConfirm={async () => {
              setErr(null);
              const res = await onEnable(code);
              if (!res.ok) {
                setErr(readApiMessage(res));
                return;
              }
              if (res.backupCodes?.length) setBackupCodes(res.backupCodes);
            }}
          />
        </div>
      )}
    </ProfileModalShell>
  );
}

export function ConfirmActionModal({
  open,
  title,
  description,
  confirmLabel,
  danger,
  busy,
  needsTwoFa,
  emailField,
  onClose,
  onConfirm
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  busy: boolean;
  needsTwoFa?: boolean;
  emailField?: { label: string; placeholder?: string };
  onClose: () => void;
  onConfirm: (
    password: string,
    twoFaCode?: string,
    reason?: string,
    email?: string
  ) => Promise<{ ok: boolean; error?: string; message?: string }>;
}) {
  const [password, setPassword] = useState("");
  const [twoFaCode, setTwoFaCode] = useState("");
  const [reason, setReason] = useState("");
  const [email, setEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const titleId = `confirm-action-${title.replace(/\s+/g, "-").toLowerCase()}`;

  useEffect(() => {
    if (!open) {
      setPassword("");
      setTwoFaCode("");
      setReason("");
      setEmail("");
      setErr(null);
      setSuccess(null);
    }
  }, [open]);

  return (
    <ProfileModalShell
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      titleId={titleId}
      busy={busy}
    >
      {success ? (
        <>
          <ProfileModalAlert tone="success">{success}</ProfileModalAlert>
          <ProfileModalFooter onCancel={onClose} confirmLabel="Done" onConfirm={onClose} />
        </>
      ) : (
        <div className="space-y-4">
          {emailField ? (
            <AdminLabel>
              {emailField.label}
              <AdminInput
                type="email"
                value={email}
                placeholder={emailField.placeholder}
                onChange={(e) => setEmail(e.target.value)}
              />
            </AdminLabel>
          ) : null}
          {confirmLabel.toLowerCase().includes("closure") ? (
            <AdminLabel>
              Reason (optional)
              <AdminInput value={reason} onChange={(e) => setReason(e.target.value)} />
            </AdminLabel>
          ) : null}
          <AdminLabel>
            Password
            <VerificationPasswordInput value={password} onChange={(e) => setPassword(e.target.value)} />
          </AdminLabel>
          {needsTwoFa ? (
            <AdminLabel>
              2FA code
              <AdminInput value={twoFaCode} onChange={(e) => setTwoFaCode(e.target.value)} inputMode="numeric" />
            </AdminLabel>
          ) : null}
          {err ? <ProfileModalAlert tone="error">{err}</ProfileModalAlert> : null}
          <ProfileModalFooter
            onCancel={onClose}
            confirmLabel={confirmLabel}
            danger={danger}
            busy={busy}
            onConfirm={async () => {
              setErr(null);
              const res = await onConfirm(password, twoFaCode || undefined, reason || undefined, email || undefined);
              if (!res.ok) {
                setErr(readApiMessage(res));
                return;
              }
              setSuccess(res.message ?? "Request submitted.");
            }}
          />
        </div>
      )}
    </ProfileModalShell>
  );
}
