import type { ReactNode } from "react";
import { AdminBtnPrimary, AdminBtnSecondary, AdminInput, AdminLabel, AdminSelect } from "../AdminUi";
import type { VenueProfileAccess, VenueProfileAction } from "./venueProfileAccess";

export function VenueSection({
  title,
  description,
  action,
  children,
  className = ""
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`admin-venue-section-card ${className}`.trim()}>
      <div className="admin-venue-section-head">
        <div className="min-w-0">
          <h3 className="admin-venue-section-title">{title}</h3>
          {description ? <p className="admin-venue-section-desc">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="admin-venue-section-body">{children}</div>
    </section>
  );
}

export function VenueFieldGrid({ children }: { children: ReactNode }) {
  return <div className="admin-venue-field-grid">{children}</div>;
}

export function VenueReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-venue-readonly-row">
      <p className="admin-venue-readonly-label">{label}</p>
      <p className="admin-venue-readonly-value">{value || "—"}</p>
    </div>
  );
}

export function VenueToggleRow({
  label,
  description,
  checked,
  disabled,
  onChange
}: {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className={`admin-venue-toggle-row${disabled ? " admin-venue-toggle-row--disabled" : ""}`}>
      <span className="min-w-0 flex-1">
        <span className="admin-venue-toggle-label">{label}</span>
        {description ? <span className="admin-venue-toggle-desc">{description}</span> : null}
      </span>
      <input
        type="checkbox"
        className="admin-venue-toggle-input"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

export function VenuePermissionGate({
  access,
  action,
  children,
  fallback
}: {
  access: VenueProfileAccess;
  action: VenueProfileAction;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  if (!access.can(action)) {
    return (
      fallback ?? (
        <p className="admin-venue-locked-hint" role="status">
          {access.reason(action)}
        </p>
      )
    );
  }
  return <>{children}</>;
}

export function VenueFormField({
  label,
  value,
  onChange,
  readOnly,
  placeholder,
  type = "text",
  mono
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  type?: string;
  mono?: boolean;
}) {
  return (
    <AdminLabel>
      <span className="admin-venue-field-label">{label}</span>
      <AdminInput
        className={`mt-1.5${mono ? " font-mono text-xs" : ""}`}
        value={value}
        readOnly={readOnly}
        placeholder={placeholder}
        type={type}
        onChange={readOnly || !onChange ? undefined : (e) => onChange(e.target.value)}
      />
    </AdminLabel>
  );
}

export function VenueSelectField({
  label,
  value,
  onChange,
  options,
  readOnly
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  readOnly?: boolean;
}) {
  return (
    <AdminLabel>
      <span className="admin-venue-field-label">{label}</span>
      <AdminSelect
        className="mt-1.5"
        value={value}
        disabled={readOnly}
        onChange={readOnly || !onChange ? undefined : (e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </AdminSelect>
    </AdminLabel>
  );
}

export function VenueActionBar({
  onSave,
  onReset,
  saveLabel = "Save changes",
  disabled
}: {
  onSave?: () => void;
  onReset?: () => void;
  saveLabel?: string;
  disabled?: boolean;
}) {
  if (!onSave && !onReset) return null;
  return (
    <div className="admin-venue-action-bar">
      {onReset ? (
        <AdminBtnSecondary type="button" onClick={onReset} disabled={disabled}>
          Reset
        </AdminBtnSecondary>
      ) : null}
      {onSave ? (
        <AdminBtnPrimary type="button" onClick={onSave} disabled={disabled}>
          {saveLabel}
        </AdminBtnPrimary>
      ) : null}
    </div>
  );
}
