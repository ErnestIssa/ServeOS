import type { ReactNode } from "react";
import { subPanelCls } from "../../AdminUi";

export function PayChip({
  children,
  tone = "default"
}: {
  children: ReactNode;
  tone?: "default" | "success" | "muted" | "warning" | "danger";
}) {
  return (
    <span className={`admin-payments-chip${tone !== "default" ? ` admin-payments-chip--${tone}` : ""}`}>
      {children}
    </span>
  );
}

export function PaySection({
  title,
  description,
  action,
  children,
  className = "",
  borderless = false
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Removes card border/shadow and section body dividers. */
  borderless?: boolean;
}) {
  return (
    <section
      className={`${borderless ? "admin-payments-section admin-payments-section--borderless" : `${subPanelCls} admin-config-section admin-payments-section overflow-hidden p-0`} ${className}`.trim()}
    >
      <div className="admin-payments-section-head">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide admin-config-text-muted">{title}</p>
          {description ? <p className="admin-config-text-subtle mt-1 text-sm">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="admin-payments-section-body">{children}</div>
    </section>
  );
}

export function ToggleRow({
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
  onChange: (v: boolean) => void;
}) {
  return (
    <label className={`admin-payments-toggle-row${disabled ? " admin-payments-toggle-row--disabled" : ""}`}>
      <span className="min-w-0 flex-1">
        <span className="admin-payments-toggle-label">{label}</span>
        {description ? <span className="admin-payments-toggle-desc">{description}</span> : null}
      </span>
      <input
        type="checkbox"
        className="admin-payments-toggle-input"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

export function MoneyTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="admin-payments-money-tile">
      <p className="admin-payments-money-tile-label">{label}</p>
      <p className="admin-payments-money-tile-value">{value}</p>
      {hint ? <p className="admin-payments-money-tile-hint">{hint}</p> : null}
    </div>
  );
}

export function HealthRow({ label, statusLabel, tone }: { label: string; statusLabel: string; tone: string }) {
  return (
    <div className="admin-payments-health-row">
      <span className="admin-payments-health-label">{label}</span>
      <span className={`admin-payments-health-dot admin-payments-health-dot--${tone}`} aria-hidden />
      <span className="admin-payments-health-status">{statusLabel}</span>
    </div>
  );
}
