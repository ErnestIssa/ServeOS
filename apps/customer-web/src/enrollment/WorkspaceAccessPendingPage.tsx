import { iconPath } from "../marketing/assetPaths";
import { SignupStepShell } from "../signup/SignupShell";

const PENDING_ICON = iconPath("register-svgrepo-com.svg");

const ROLE_APP_HINTS: Record<string, { label: string; description: string }> = {
  STAFF: {
    label: "ServeOS Staff app",
    description: "Orders, tables, and guest messaging once your access is approved."
  },
  KITCHEN: {
    label: "ServeOS Kitchen / KDS",
    description: "Ticket flow and order status — no billing or admin tools."
  },
  CASHIER: {
    label: "ServeOS Checkout",
    description: "Counter checkout and order handoff after approval."
  },
  MANAGER: {
    label: "ServeOS Admin dashboard",
    description: "Full venue operations after your manager approves access."
  },
  OWNER: {
    label: "ServeOS Admin dashboard",
    description: "Workspace management after setup is complete."
  }
};

function StatusRow({ done, label }: { done: boolean; label: string }) {
  return (
    <li className="enroll-pending-status-row">
      <span className={`enroll-pending-status-icon ${done ? "enroll-pending-status-icon--done" : ""}`} aria-hidden>
        {done ? "✓" : "⏳"}
      </span>
      <span>{label}</span>
    </li>
  );
}

export function WorkspaceAccessPendingPage({
  restaurantName,
  roleLabel,
  intendedRole,
  invitedByName,
  shell = "marketing",
  onSignOut
}: {
  restaurantName: string;
  roleLabel: string;
  intendedRole?: string;
  invitedByName?: string | null;
  shell?: "marketing" | "admin";
  onSignOut?: () => void;
}) {
  const roleKey = (intendedRole ?? "STAFF").toUpperCase();
  const appHint = ROLE_APP_HINTS[roleKey] ?? ROLE_APP_HINTS.STAFF;

  const body = (
    <div className="enroll-pending w-full max-w-lg">
      <p className="enroll-pending-lead">
        You&apos;ve successfully joined <strong>{restaurantName}</strong>.
      </p>
      <div className="enroll-pending-meta">
        <p>
          Role request: <strong>{roleLabel}</strong>
        </p>
        {invitedByName ? (
          <p>
            Invited by: <strong>{invitedByName}</strong>
          </p>
        ) : null}
      </div>

      <div className="enroll-pending-card">
        <p className="enroll-pending-card__title">Status</p>
        <ul className="enroll-pending-status-list">
          <StatusRow done label="Invitation accepted" />
          <StatusRow done label="Account ready" />
          <StatusRow done={false} label="Manager approval pending" />
        </ul>
        <p className="enroll-pending-card__note">
          An admin at {restaurantName} must approve your access before you can start working. This usually takes
          minutes to a few hours.
        </p>
      </div>

      <div className="enroll-pending-card">
        <p className="enroll-pending-card__title">While you wait</p>
        <p className="enroll-pending-card__text">
          Download <strong>{appHint.label}</strong> — {appHint.description}
        </p>
        <p className="enroll-pending-card__text mt-3 text-sm text-slate-500">
          You&apos;ll receive access to the dashboard when approval is complete. No subscription or billing steps are
          required for staff accounts.
        </p>
      </div>

      <button type="button" className="enroll-pending-locked-cta" disabled aria-disabled>
        Access dashboard (locked until approved)
      </button>

      {onSignOut ? (
        <button type="button" className="enroll-link-btn mt-4" onClick={onSignOut}>
          Sign out
        </button>
      ) : null}
    </div>
  );

  if (shell === "admin") {
    return (
      <div className="admin-pending-approval mx-auto max-w-2xl py-8">
        <h1 className="font-display text-2xl font-extrabold text-slate-900">Your account is being reviewed</h1>
        <p className="mt-2 text-sm text-slate-600">An admin must approve your workspace access.</p>
        <div className="mt-8">{body}</div>
      </div>
    );
  }

  return (
    <SignupStepShell
      stepKey="pending-approval"
      iconSrc={PENDING_ICON}
      title="Your account is being reviewed"
      description={body}
      descriptionClassName="w-full"
    />
  );
}
