import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useModalScrollLock } from "../../../lib/modalScrollLock";
import {
  MENU_PAGE_DRAWER_BACKDROP_CLASS,
  MENU_PAGE_DRAWER_SHELL_CLASS
} from "./menuPageModalShell";

export function formatDetailsWhen(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function shortEntityId(id: string) {
  if (id.length <= 14) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

export function DetailsInternalId({
  id,
  label = "Internal ID"
}: {
  id: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [idHovered, setIdHovered] = useState(false);
  const copiedTimerRef = useRef<number | null>(null);
  const short = shortEntityId(id);
  const needsReveal = id.length > 14;
  const showReveal = needsReveal && idHovered && !copied;

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
    };
  }, []);

  const copyId = async () => {
    setIdHovered(false);
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = window.setTimeout(() => {
        setCopied(false);
        copiedTimerRef.current = null;
      }, 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="admin-menu-readonly-field admin-menu-details-id">
      <p className="admin-menu-readonly-label">{label}</p>
      <div className={`admin-menu-details-id-control${needsReveal ? " has-reveal" : ""}`}>
        <div
          className={`admin-menu-details-id-display${showReveal ? " is-revealed" : ""}`}
          onMouseEnter={() => {
            if (!copied) setIdHovered(true);
          }}
          onMouseLeave={() => setIdHovered(false)}
        >
          <code className="admin-menu-details-id-short">{short}</code>
          {needsReveal ? (
            <span className="admin-menu-details-id-reveal" role="tooltip" aria-hidden={!showReveal}>
              <code className="admin-menu-details-id-full">{id}</code>
            </span>
          ) : null}
        </div>
        <button
          type="button"
          className={`admin-menu-details-id-copy${copied ? " is-copied" : ""}`}
          onMouseEnter={() => setIdHovered(false)}
          onFocus={() => setIdHovered(false)}
          onClick={(e) => {
            e.currentTarget.blur();
            void copyId();
          }}
          aria-label={copied ? "Copied internal ID" : "Copy internal ID"}
          title={copied ? "Copied" : "Copy ID"}
        >
          {copied ? (
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <rect x="9" y="9" width="11" height="11" rx="2" />
              <path strokeLinecap="round" d="M5 15V7a2 2 0 0 1 2-2h8" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

export function useDetailsDrawerMount(open: boolean, entityKey: string | null) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (open && entityKey) {
      setMounted(true);
      const frame = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setVisible(true));
      });
      return () => window.cancelAnimationFrame(frame);
    }
    setVisible(false);
    closeTimerRef.current = window.setTimeout(() => {
      setMounted(false);
      closeTimerRef.current = null;
    }, 520);
    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, [open, entityKey]);

  useModalScrollLock(mounted);

  return { mounted, visible };
}

/** Keep the last entity while the close animation runs (parent often nulls the prop immediately). */
export function useCachedDetailsEntity<T>(open: boolean, entity: T | null): T | null {
  const [active, setActive] = useState<T | null>(null);
  useEffect(() => {
    if (open && entity) setActive(entity);
  }, [open, entity]);
  useEffect(() => {
    if (open) return;
    const t = window.setTimeout(() => setActive(null), 520);
    return () => window.clearTimeout(t);
  }, [open]);
  return open ? entity ?? active : active;
}

export function DetailsRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="admin-menu-readonly-field">
      <p className="admin-menu-readonly-label">{label}</p>
      <div className="admin-menu-readonly-value">{value || "—"}</div>
    </div>
  );
}

export function DetailsSection({
  title,
  hint,
  children
}: {
  title?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="admin-staff-drawer-section admin-menu-details-section">
      {title ? <h4 className="admin-staff-drawer-section-title">{title}</h4> : null}
      {hint ? <p className="admin-staff-drawer-hint mb-3">{hint}</p> : null}
      {children}
    </section>
  );
}

export function DetailsGrid({ children }: { children: ReactNode }) {
  return <div className="admin-menu-field-grid admin-menu-details-grid">{children}</div>;
}

export type DetailsFlag = { label: string; ok: boolean; note?: string };

export function DetailsFlags({ flags }: { flags: DetailsFlag[] }) {
  return (
    <ul className="admin-menu-details-flags">
      {flags.map((f) => (
        <li key={f.label} className={f.ok ? "is-ok" : "is-off"}>
          <span className="admin-menu-details-flag-mark" aria-hidden>
            {f.ok ? "✓" : "✕"}
          </span>
          <span className="admin-menu-details-flag-copy">
            <span className="admin-menu-details-flag-label">{f.label}</span>
            {f.note ? <span className="admin-menu-details-flag-note">{f.note}</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function DetailsChipList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <p className="admin-staff-profile-muted text-sm">None</p>;
  }
  return (
    <ul className="admin-menu-details-chips">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function DetailsHealth({
  ready,
  warnings
}: {
  ready: boolean;
  warnings: string[];
}) {
  return (
    <div className={`admin-menu-details-health${ready ? " is-ready" : " has-warnings"}`}>
      <p className="admin-menu-details-health-title">{ready ? "Ready" : "Needs attention"}</p>
      {warnings.length === 0 ? (
        <p className="admin-menu-details-health-ok">No issues detected.</p>
      ) : (
        <ul className="admin-menu-details-health-list">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function DetailsSystemStatus({ rows }: { rows: DetailsFlag[] }) {
  return (
    <DetailsSection title="System status" hint="Quick readiness check for guests and ops.">
      <DetailsFlags flags={rows} />
    </DetailsSection>
  );
}

type ShellProps = {
  open: boolean;
  entityKey: string | null;
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
};

export function DetailsDrawerShell({
  open,
  entityKey,
  title,
  subtitle,
  badge,
  closeLabel,
  onClose,
  children
}: ShellProps) {
  const { mounted, visible } = useDetailsDrawerMount(open, entityKey);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, onClose]);

  if (!mounted || !entityKey) return null;

  return createPortal(
    <div
      className={`admin-staff-profile-shell ${MENU_PAGE_DRAWER_SHELL_CLASS} ${visible ? "admin-staff-profile-shell--open" : ""}`}
      role="presentation"
      aria-hidden={!visible}
    >
      <button
        type="button"
        className={`${MENU_PAGE_DRAWER_BACKDROP_CLASS}${visible ? " is-active" : ""}`}
        aria-label={closeLabel}
        tabIndex={visible ? 0 : -1}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        tabIndex={visible ? 0 : -1}
        aria-label={title}
        className={`admin-staff-profile-panel admin-menu-item-profile-panel ${visible ? "admin-staff-profile-panel--open" : ""}`}
      >
        <header className="admin-staff-profile-header">
          <div className="min-w-0 flex-1">
            <p className="admin-menu-details-kicker">Details · read only</p>
            <h3 className="admin-staff-profile-title">{title}</h3>
            {subtitle ? <p className="admin-staff-profile-sub">{subtitle}</p> : null}
            {badge ? <div className="mt-2 flex flex-wrap items-center gap-2">{badge}</div> : null}
          </div>
          <button type="button" className="admin-staff-profile-close" onClick={onClose} aria-label="Close">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>
        <div className="admin-staff-profile-body admin-menu-item-profile-body admin-menu-details-body">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
