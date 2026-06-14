import type { ReactNode } from "react";

export function ProfileSectionTitle({ children }: { children: ReactNode }) {
  return <p className="admin-profile-section-title">{children}</p>;
}

export function ProfileStatusBanner({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "success" }) {
  return <p className={`admin-profile-status admin-profile-status--${tone}`}>{children}</p>;
}

export function ProfileSectionCard({
  children,
  className = ""
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`admin-profile-section-card ${className}`.trim()}>{children}</div>;
}

export function ProfileSectionFooter({ children }: { children: ReactNode }) {
  return <div className="admin-profile-section-footer">{children}</div>;
}

export function ProfileToggleRow({
  label,
  hint,
  checked,
  onChange,
  disabled = false
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={`admin-profile-toggle-row${disabled ? " is-disabled" : ""}`}>
      <span className="admin-profile-toggle-copy">
        <span className="admin-profile-toggle-label">{label}</span>
        {hint ? <span className="admin-profile-toggle-hint">{hint}</span> : null}
      </span>
      <span className="admin-profile-toggle">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="admin-profile-toggle-track" aria-hidden />
      </span>
    </label>
  );
}

export function ProfileSignOutButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="admin-profile-sign-out-btn">
      Sign out
    </button>
  );
}
