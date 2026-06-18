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

export function ApproveAccessConfirmModal({
  open,
  fullName,
  email,
  roleLabel,
  venueName,
  busy,
  error,
  onCancel,
  onConfirm
}: {
  open: boolean;
  fullName: string;
  email: string;
  roleLabel: string;
  venueName: string;
  busy: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <ProfileModalShell
      open={open}
      onClose={busy ? () => undefined : onCancel}
      title="Approve workspace access?"
      description={`Grant ${fullName} (${email}) access to ${venueName}.`}
      titleId="approve-access-confirm-title"
      stackLevel="overlay"
      maxWidthClass="max-w-md"
      busy={busy}
    >
      <ProfileModalNote>
        Role: <strong>{roleLabel}</strong>
        <br />
        They can sign in and use operational tools for this venue after approval.
      </ProfileModalNote>
      {error ? <ProfileModalAlert tone="error">{error}</ProfileModalAlert> : null}
      <ProfileModalFooter
        onCancel={onCancel}
        onConfirm={onConfirm}
        confirmLabel="Approve access"
        cancelLabel="Not yet"
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

export function SuspendAccessConfirmModal({
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
      title="Suspend workspace access?"
      description={`${fullName} (${email}) will lose access to ${roleLabel} tools until you reactivate them.`}
      titleId="suspend-access-confirm-title"
      stackLevel="overlay"
      maxWidthClass="max-w-md"
      busy={busy}
    >
      <ProfileModalNote>
        They stay on the team roster but cannot sign in to this venue. You can reactivate access anytime from their
        profile.
      </ProfileModalNote>
      {error ? <ProfileModalAlert tone="error">{error}</ProfileModalAlert> : null}
      <ProfileModalFooter
        onCancel={onCancel}
        onConfirm={onConfirm}
        confirmLabel="Suspend access"
        cancelLabel="Keep active"
        danger
        busy={busy}
      />
    </ProfileModalShell>
  );
}

export function RemoveAccessConfirmModal({
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
      title="Remove from team?"
      description={`Remove ${fullName} (${email}) from this venue's staff roster.`}
      titleId="remove-access-confirm-title"
      stackLevel="overlay"
      maxWidthClass="max-w-md"
      busy={busy}
    >
      <ProfileModalNote>
        Role: <strong>{roleLabel}</strong>
        <br />
        This ends their membership for this restaurant. They will need a new invite to rejoin.
      </ProfileModalNote>
      {error ? <ProfileModalAlert tone="error">{error}</ProfileModalAlert> : null}
      <ProfileModalFooter
        onCancel={onCancel}
        onConfirm={onConfirm}
        confirmLabel="Remove access"
        cancelLabel="Keep on team"
        danger
        busy={busy}
      />
    </ProfileModalShell>
  );
}

export function InviteHistoryModal({
  open,
  items,
  removedItems,
  busyId,
  onClose,
  onSelect,
  onRestore
}: {
  open: boolean;
  items: Array<{
    id: string;
    name: string;
    email: string;
    roleLabel: string;
    statusLabel: string;
    sent: string;
    invitedByName?: string | null;
    invitedByRole?: string | null;
    acceptedAt?: string;
  }>;
  removedItems?: Array<{
    id: string;
    name: string;
    email: string;
    roleLabel: string;
    removedAt: string;
  }>;
  busyId?: string | null;
  onClose: () => void;
  onSelect: (id: string) => void;
  onRestore?: (membershipId: string) => void;
}) {
  return (
    <ProfileModalShell
      open={open}
      onClose={onClose}
      title="Invite history"
      description="Past staff invitations and recently removed members for this venue."
      titleId="invite-history-title"
      stackLevel="overlay"
      maxWidthClass="max-w-lg"
    >
      {removedItems?.length ? (
        <div className="mb-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide admin-staff-text-muted">Recently removed</p>
          <ul className="space-y-2">
            {removedItems.map((item) => (
              <li
                key={item.id}
                className="admin-staff-invite-row flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-semibold admin-staff-text">{item.name}</p>
                  <p className="truncate text-xs admin-staff-text-muted">{item.email}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span className="text-xs admin-staff-text-muted">Removed {item.removedAt}</span>
                  {onRestore ? (
                    <button
                      type="button"
                      className="admin-page-link-btn text-xs font-semibold text-violet-600"
                      disabled={busyId === item.id}
                      onClick={() => onRestore(item.id)}
                    >
                      Restore access
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {items.length ? (
        <ul className="max-h-[min(24rem,60vh)] space-y-2 overflow-y-auto pr-1">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                disabled={busyId === item.id}
                onClick={() => onSelect(item.id)}
                className="admin-staff-invite-row flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition hover:border-violet-300/60 disabled:opacity-60"
              >
                <div className="min-w-0">
                  <p className="font-semibold admin-staff-text">{item.name}</p>
                  <p className="truncate text-xs admin-staff-text-muted">{item.email}</p>
                  {item.invitedByName ? (
                    <p className="mt-0.5 text-xs admin-staff-text-subtle">
                      Invited by {item.invitedByName}
                      {item.invitedByRole ? ` (${item.invitedByRole})` : ""}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                  <span className="text-xs font-semibold admin-staff-text">{item.roleLabel}</span>
                  <span className="text-xs admin-staff-text-muted">{item.statusLabel}</span>
                  <span className="text-[11px] admin-staff-text-subtle">Sent {item.sent}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      ) : removedItems?.length ? null : (
        <ProfileModalNote>No invite history yet.</ProfileModalNote>
      )}
      <div className="mt-6">
        <button type="button" onClick={onClose} className="admin-profile-modal-btn admin-profile-modal-btn--ghost w-full">
          Close
        </button>
      </div>
    </ProfileModalShell>
  );
}

export function RestoreAccessConfirmModal({
  open,
  fullName,
  email,
  roleLabel,
  venueName,
  busy,
  error,
  onCancel,
  onConfirm
}: {
  open: boolean;
  fullName: string;
  email: string;
  roleLabel: string;
  venueName: string;
  busy: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <ProfileModalShell
      open={open}
      onClose={busy ? () => undefined : onCancel}
      title="Restore workspace access?"
      description={`Restore ${fullName} (${email}) to ${venueName} with their previous role.`}
      titleId="restore-access-confirm-title"
      stackLevel="overlay"
      maxWidthClass="max-w-md"
      busy={busy}
    >
      <ProfileModalNote>
        Role: <strong>{roleLabel}</strong>
        <br />
        Their membership will become active again without sending a new invite.
      </ProfileModalNote>
      {error ? <ProfileModalAlert tone="error">{error}</ProfileModalAlert> : null}
      <ProfileModalFooter
        onCancel={onCancel}
        onConfirm={onConfirm}
        confirmLabel="Restore access"
        cancelLabel="Not now"
        busy={busy}
      />
    </ProfileModalShell>
  );
}

export function InviteHistoryDetailModal({
  open,
  item,
  onClose,
  onOpenProfile
}: {
  open: boolean;
  item: {
    name: string;
    email: string;
    phone?: string;
    roleLabel: string;
    statusLabel: string;
    sent: string;
    acceptedAt?: string;
    invitedByName?: string | null;
    invitedByRole?: string | null;
    membershipId?: string | null;
  } | null;
  onClose: () => void;
  onOpenProfile?: () => void;
}) {
  if (!item) return null;

  return (
    <ProfileModalShell
      open={open}
      onClose={onClose}
      title={item.name}
      description={item.email}
      titleId="invite-history-detail-title"
      stackLevel="overlay"
      maxWidthClass="max-w-md"
    >
      <dl className="space-y-3 text-sm">
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide admin-staff-text-muted">Role</dt>
          <dd className="mt-0.5 font-semibold admin-staff-text">{item.roleLabel}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide admin-staff-text-muted">Status</dt>
          <dd className="mt-0.5 admin-staff-text">{item.statusLabel}</dd>
        </div>
        {item.phone ? (
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide admin-staff-text-muted">Phone</dt>
            <dd className="mt-0.5 admin-staff-text">{item.phone}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide admin-staff-text-muted">Invited</dt>
          <dd className="mt-0.5 admin-staff-text">{item.sent}</dd>
        </div>
        {item.acceptedAt ? (
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide admin-staff-text-muted">Accepted</dt>
            <dd className="mt-0.5 admin-staff-text">{item.acceptedAt}</dd>
          </div>
        ) : null}
        {item.invitedByName ? (
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide admin-staff-text-muted">Invited by</dt>
            <dd className="mt-0.5 admin-staff-text">
              {item.invitedByName}
              {item.invitedByRole ? ` (${item.invitedByRole})` : ""}
            </dd>
          </div>
        ) : null}
      </dl>
      <div className="mt-6 flex flex-col gap-3">
        {item.membershipId && onOpenProfile ? (
          <button
            type="button"
            onClick={onOpenProfile}
            className="admin-profile-modal-btn admin-profile-modal-btn--primary w-full"
          >
            Open staff profile
          </button>
        ) : null}
        <button type="button" onClick={onClose} className="admin-profile-modal-btn admin-profile-modal-btn--ghost w-full">
          Close
        </button>
      </div>
    </ProfileModalShell>
  );
}
