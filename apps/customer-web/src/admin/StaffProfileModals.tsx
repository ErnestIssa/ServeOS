import { useEffect, useState } from "react";
import { AdminLabel } from "./AdminUi";
import { ProfileModalAlert, ProfileModalFooter, ProfileModalNote, ProfileModalShell } from "./profile/ProfileModalShell";
import { VerificationPasswordInput } from "./profile/VerificationPasswordInput";

export type StaffSecurityAction = "reset_password" | "force_logout" | "revoke_sessions";

const SECURITY_COPY: Record<
  StaffSecurityAction,
  { title: string; description: (name: string, email: string) => string; confirmLabel: string; danger?: boolean }
> = {
  reset_password: {
    title: "Reset staff password?",
    description: (_name, email) =>
      `A password reset link will be sent to ${email}. They must choose a new password before signing in again.`,
    confirmLabel: "Send reset link"
  },
  force_logout: {
    title: "Force logout?",
    description: (name) =>
      `${name} will be signed out on every device immediately. They can sign back in with their credentials.`,
    confirmLabel: "Force logout",
    danger: true
  },
  revoke_sessions: {
    title: "Revoke all sessions?",
    description: (name) =>
      `Every active session for ${name} will be ended. They must sign in again on each device — use this if you suspect account misuse.`,
    confirmLabel: "Revoke all sessions",
    danger: true
  }
};

export function StaffSecurityActionModal({
  open,
  action,
  staffName,
  staffEmail,
  busy,
  onClose,
  onConfirm
}: {
  open: boolean;
  action: StaffSecurityAction | null;
  staffName: string;
  staffEmail: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: (password: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setPassword("");
      setErr(null);
    }
  }, [open]);

  if (!action) return null;

  const copy = SECURITY_COPY[action];
  const titleId = `staff-security-${action}`;

  return (
    <ProfileModalShell
      open={open}
      onClose={onClose}
      title={copy.title}
      description={copy.description(staffName, staffEmail)}
      titleId={titleId}
      busy={busy}
      stackLevel="overlay"
      maxWidthClass="max-w-md"
    >
      <div className="space-y-4">
        <ProfileModalNote>Enter your owner password to confirm this security action.</ProfileModalNote>
        <AdminLabel>
          Your password
          <VerificationPasswordInput value={password} onChange={(e) => setPassword(e.target.value)} />
        </AdminLabel>
        {err ? <ProfileModalAlert tone="error">{err}</ProfileModalAlert> : null}
        <ProfileModalFooter
          onCancel={onClose}
          confirmLabel={copy.confirmLabel}
          danger={copy.danger}
          busy={busy}
          confirmDisabled={!password.trim()}
          onConfirm={async () => {
            setErr(null);
            const res = await onConfirm(password);
            if (!res.ok) {
              setErr(res.error ?? "Could not complete this action. Try again.");
            }
          }}
        />
      </div>
    </ProfileModalShell>
  );
}

export function StaffUnsavedChangesModal({
  open,
  staffName,
  busy,
  onStay,
  onDiscard,
  onSave
}: {
  open: boolean;
  staffName: string;
  busy: boolean;
  onStay: () => void;
  onDiscard: () => void;
  onSave: () => void;
}) {
  return (
    <ProfileModalShell
      open={open}
      onClose={busy ? () => undefined : onStay}
      title="Unsaved changes"
      description={`You changed permissions for ${staffName}.`}
      titleId="staff-unsaved-changes-title"
      busy={busy}
      stackLevel="overlay"
      maxWidthClass="max-w-md"
    >
      <ProfileModalNote>
        <strong>Save</strong> applies the new access rules immediately for this staff member.
        <br />
        <strong>Discard</strong> reverts to the last saved permissions and closes the profile.
        <br />
        <strong>Keep editing</strong> returns you to the profile without closing.
      </ProfileModalNote>
      <div className="mt-6 flex flex-col gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={onSave}
          className="admin-profile-modal-btn admin-profile-modal-btn--primary w-full"
        >
          {busy ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onDiscard}
          className="admin-profile-modal-btn admin-profile-modal-btn--danger w-full"
        >
          Discard changes
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onStay}
          className="admin-profile-modal-btn admin-profile-modal-btn--ghost w-full"
        >
          Keep editing
        </button>
      </div>
    </ProfileModalShell>
  );
}

export function InviteDiscardModal({
  open,
  onStay,
  onDiscard
}: {
  open: boolean;
  onStay: () => void;
  onDiscard: () => void;
}) {
  return (
    <ProfileModalShell
      open={open}
      onClose={onStay}
      title="Discard invite?"
      description="You started filling in an invite. Closing now will clear what you entered."
      titleId="invite-discard-title"
      stackLevel="overlay"
      maxWidthClass="max-w-md"
    >
      <ProfileModalNote>
        <strong>Keep editing</strong> returns you to the invite form with your entries intact.
        <br />
        <strong>Discard</strong> closes the form and clears all fields.
      </ProfileModalNote>
      <div className="mt-6 flex flex-col gap-3">
        <button type="button" onClick={onStay} className="admin-profile-modal-btn admin-profile-modal-btn--primary w-full">
          Keep editing
        </button>
        <button type="button" onClick={onDiscard} className="admin-profile-modal-btn admin-profile-modal-btn--danger w-full">
          Discard invite
        </button>
      </div>
    </ProfileModalShell>
  );
}

export function SendInviteConfirmModal({
  open,
  fullName,
  email,
  roleLabel,
  busy,
  error,
  onCancel,
  onConfirm
}: {
  open: boolean;
  fullName: string;
  email: string;
  roleLabel: string;
  busy: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <ProfileModalShell
      open={open}
      onClose={busy ? () => undefined : onCancel}
      title="Send staff invite?"
      description={`An email invitation will be sent to ${fullName} at ${email}.`}
      titleId="invite-send-confirm-title"
      stackLevel="overlay"
      maxWidthClass="max-w-md"
      busy={busy}
    >
      <ProfileModalNote>
        Role: <strong>{roleLabel}</strong>
        <br />
        They must accept the invite and may need manager approval before accessing the workspace.
      </ProfileModalNote>
      {error ? <ProfileModalAlert tone="error">{error}</ProfileModalAlert> : null}
      <ProfileModalFooter
        onCancel={onCancel}
        onConfirm={onConfirm}
        confirmLabel="Send invite"
        cancelLabel="Go back"
        busy={busy}
      />
    </ProfileModalShell>
  );
}

export function CancelInviteConfirmModal({
  open,
  fullName,
  email,
  busy,
  error,
  onCancel,
  onConfirm
}: {
  open: boolean;
  fullName: string;
  email: string;
  busy: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <ProfileModalShell
      open={open}
      onClose={busy ? () => undefined : onCancel}
      title="Cancel invite?"
      description={`The pending invitation for ${fullName} (${email}) will be revoked.`}
      titleId="invite-cancel-confirm-title"
      stackLevel="overlay"
      maxWidthClass="max-w-md"
      busy={busy}
    >
      <ProfileModalNote>
        They will no longer be able to use the invite link. You can send a new invite later if needed.
      </ProfileModalNote>
      {error ? <ProfileModalAlert tone="error">{error}</ProfileModalAlert> : null}
      <ProfileModalFooter
        onCancel={onCancel}
        onConfirm={onConfirm}
        confirmLabel="Cancel invite"
        cancelLabel="Keep invite"
        danger
        busy={busy}
      />
    </ProfileModalShell>
  );
}
