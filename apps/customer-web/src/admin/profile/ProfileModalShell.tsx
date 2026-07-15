import type { ReactNode } from "react";
import { SignupModalShell } from "../../signup/SignupModalShell";

export const PROFILE_MODAL_PANEL =
  "relative w-full overflow-hidden rounded-3xl border border-white/60 bg-white/95 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.18)] backdrop-blur-xl sm:p-8 min-h-0";

type ShellProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  titleId: string;
  children: ReactNode;
  busy?: boolean;
  maxWidthClass?: string;
  backdropLabel?: string;
  stackLevel?: "default" | "overlay";
  panelClassName?: string;
  bodyClassName?: string;
  maxHeightClass?: string;
  /** When false, modal body does not scroll — use for forms with in-panel dropdowns. */
  bodyScroll?: boolean;
  backdropClassName?: string;
};

const PROFILE_MODAL_SHELL_CLASS = {
  default:
    "admin-profile-modal-shell fixed inset-0 z-[10000] flex items-center justify-center overflow-hidden overscroll-none p-4 sm:p-6",
  overlay:
    "admin-profile-modal-shell fixed inset-0 z-[10050] flex items-center justify-center overflow-hidden overscroll-none p-4 sm:p-6"
} as const;

export function ProfileModalShell({
  open,
  onClose,
  title,
  description,
  titleId,
  children,
  busy = false,
  maxWidthClass = "max-w-md",
  backdropLabel = "Close dialog",
  stackLevel = "default",
  panelClassName = "",
  bodyClassName = "",
  maxHeightClass = "max-h-[min(90dvh,44rem)]",
  bodyScroll = true,
  backdropClassName
}: ShellProps) {
  return (
    <SignupModalShell
      open={open}
      onClose={busy ? () => undefined : onClose}
      labelledBy={titleId}
      backdropLabel={backdropLabel}
      shellClassName={PROFILE_MODAL_SHELL_CLASS[stackLevel]}
      backdropClassName={backdropClassName}
      panelClassName={`${PROFILE_MODAL_PANEL} ${maxWidthClass} flex ${maxHeightClass} flex-col ${panelClassName}`.trim()}
    >
      <div className="shrink-0">
        <h2 id={titleId} className="font-display text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
          {title}
        </h2>
        {description ? (
          <p className="mt-2 text-sm leading-relaxed text-slate-600 sm:text-[0.9375rem]">{description}</p>
        ) : null}
      </div>
      <div
        className={`mt-5 min-h-0 pr-0.5 ${bodyScroll ? "flex-1 overflow-y-auto overscroll-contain" : "overflow-visible"} ${bodyClassName}`.trim()}
      >
        {children}
      </div>
    </SignupModalShell>
  );
}

type FooterProps = {
  onCancel: () => void;
  onConfirm?: () => void;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  confirmDisabled?: boolean;
  confirmType?: "button" | "submit";
};

export function ProfileModalFooter({
  onCancel,
  onConfirm,
  confirmLabel,
  cancelLabel = "Cancel",
  danger = false,
  busy = false,
  confirmDisabled = false,
  confirmType = "button"
}: FooterProps) {
  return (
    <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
      <button type="button" onClick={onCancel} disabled={busy} className="admin-profile-modal-btn admin-profile-modal-btn--ghost">
        {cancelLabel}
      </button>
      <button
        type={confirmType}
        onClick={onConfirm}
        disabled={busy || confirmDisabled}
        className={`admin-profile-modal-btn ${danger ? "admin-profile-modal-btn--danger" : "admin-profile-modal-btn--primary"}`}
      >
        {busy ? "Working…" : confirmLabel}
      </button>
    </div>
  );
}

export function ProfileModalAlert({ tone, children }: { tone: "error" | "success"; children: ReactNode }) {
  return (
    <p
      className={`mt-4 text-sm font-semibold ${tone === "error" ? "text-rose-600" : "text-emerald-700"}`}
      role={tone === "error" ? "alert" : "status"}
    >
      {children}
    </p>
  );
}

export function ProfileModalNote({ children }: { children: ReactNode }) {
  return (
    <p className="admin-profile-modal-note rounded-xl border px-3 py-2.5 text-xs leading-relaxed text-slate-600">{children}</p>
  );
}
