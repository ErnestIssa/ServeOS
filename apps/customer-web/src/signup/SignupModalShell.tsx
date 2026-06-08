import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export const SIGNUP_MODAL_EXIT_MS = 300;

const defaultPanelCls =
  "relative z-[1] w-full max-w-md rounded-2xl border border-slate-200/80 bg-white/95 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.18)] backdrop-blur-xl sm:p-8";

type Props = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  labelledBy?: string;
  panelClassName?: string;
  backdropLabel?: string;
  portal?: boolean;
  shellClassName?: string;
};

export function SignupModalShell({
  open,
  onClose,
  children,
  labelledBy,
  panelClassName = defaultPanelCls,
  backdropLabel = "Close dialog",
  portal = true,
  shellClassName = "fixed inset-0 z-[100] flex items-center justify-center p-5"
}: Props) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
      return () => cancelAnimationFrame(raf);
    }
    setVisible(false);
    const timer = window.setTimeout(() => setMounted(false), SIGNUP_MODAL_EXIT_MS);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!mounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mounted]);

  useEffect(() => {
    if (!mounted || !open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mounted, open, onClose]);

  if (!mounted) return null;

  const shell = (
    <div className={shellClassName} role="presentation">
      <button
        type="button"
        className={`signup-modal-backdrop absolute inset-0 bg-slate-950/35 backdrop-blur-md ${visible ? "is-active" : ""}`}
        aria-label={backdropLabel}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={`signup-modal-panel ${visible ? "is-active" : ""} ${panelClassName}`}
      >
        {children}
      </div>
    </div>
  );

  return portal ? createPortal(shell, document.body) : shell;
}
