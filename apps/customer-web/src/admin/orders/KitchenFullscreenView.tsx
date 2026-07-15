import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useModalScrollLock } from "../../lib/modalScrollLock";
import { readAdminTheme } from "../adminNavContent";
import { KitchenLiveClock } from "./KitchenLiveClock";

const FULLSCREEN_EASE = [0.22, 1, 0.36, 1] as const;

function FullscreenIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden width="16" height="16">
      <path
        d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M16 21h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export { FullscreenIcon };

type Props = {
  open: boolean;
  onClose: () => void;
  venueName: string;
  children: ReactNode;
};

export function KitchenFullscreenView({ open, onClose, venueName, children }: Props) {
  const [theme, setTheme] = useState(readAdminTheme);

  useEffect(() => {
    if (!open) return;
    setTheme(readAdminTheme());
  }, [open]);

  useModalScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  const displayVenue = venueName.trim() || "Your restaurant";

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="kitchen-fullscreen"
          className="admin-orders-kds-fullscreen"
          data-theme={theme}
          role="dialog"
          aria-modal="true"
          aria-label="Kitchen display fullscreen"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.58, ease: FULLSCREEN_EASE }}
        >
          <header className="admin-orders-kds-fullscreen-header">
            <div className="admin-orders-kds-fullscreen-header-side">
              <button type="button" className="admin-orders-kds-fullscreen-back" onClick={onClose}>
                <svg viewBox="0 0 20 20" fill="none" aria-hidden width="18" height="18">
                  <path
                    d="M12.5 15.5 7 10l5.5-5.5"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Back
              </button>
            </div>
            <h1 className="admin-orders-kds-fullscreen-venue">{displayVenue}</h1>
            <div className="admin-orders-kds-fullscreen-header-side admin-orders-kds-fullscreen-header-side--end">
              <KitchenLiveClock />
            </div>
          </header>
          <motion.div
            className="admin-orders-kds-fullscreen-body"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.62, ease: FULLSCREEN_EASE, delay: 0.06 }}
          >
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
