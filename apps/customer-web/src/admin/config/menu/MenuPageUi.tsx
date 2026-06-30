import type { ReactNode } from "react";
import { AdminBtnPrimary, AdminBtnSecondary } from "../../AdminUi";

export function MenuSection({
  title,
  description,
  action,
  children,
  full = true
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  full?: boolean;
}) {
  return (
    <section className={`admin-menu-section${full ? " admin-menu-section--full" : ""}`}>
      <div className="admin-menu-section-head">
        <div className="min-w-0">
          <h3 className="admin-menu-section-title">{title}</h3>
          {description ? <p className="admin-menu-section-desc">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="admin-menu-section-body">{children}</div>
    </section>
  );
}

export function MenuChip({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "success" | "muted" | "violet" }) {
  return <span className={`admin-config-chip${tone !== "default" ? ` admin-config-chip--${tone}` : ""}`}>{children}</span>;
}

export function MenuActionRow({ children }: { children: ReactNode }) {
  return <div className="admin-menu-action-row">{children}</div>;
}

export function MenuFieldGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="admin-menu-field-group">
      <p className="admin-menu-field-group-title">{title}</p>
      <div className="admin-menu-field-group-body">{children}</div>
    </div>
  );
}

export function MenuReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-menu-readonly-field">
      <p className="admin-menu-readonly-label">{label}</p>
      <p className="admin-menu-readonly-value">{value || "—"}</p>
    </div>
  );
}

export function MenuToolbarButton({
  children,
  onClick,
  disabled,
  primary
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  if (primary) {
    return (
      <AdminBtnPrimary type="button" disabled={disabled} onClick={onClick}>
        {children}
      </AdminBtnPrimary>
    );
  }
  return (
    <AdminBtnSecondary type="button" disabled={disabled} onClick={onClick}>
      {children}
    </AdminBtnSecondary>
  );
}

export function MenuPreviewFrame({
  label,
  aspect,
  children
}: {
  label: string;
  aspect: "desktop" | "mobile" | "qr";
  children?: ReactNode;
}) {
  return (
    <div className={`admin-menu-preview-frame admin-menu-preview-frame--${aspect}`}>
      <p className="admin-menu-preview-label">{label}</p>
      <div className="admin-menu-preview-canvas">
        {children ?? <p className="admin-config-text-subtle text-sm">Live preview when menu data is published.</p>}
      </div>
    </div>
  );
}
