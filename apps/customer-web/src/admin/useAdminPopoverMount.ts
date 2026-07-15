import { useEffect, useState } from "react";
import { useModalScrollLock } from "../lib/modalScrollLock";

export const ADMIN_POPOVER_EXIT_MS = 220;

/** Mount/unmount with enter/exit visibility for admin popovers and bubbles. */
export function useAdminPopoverMount(open: boolean, exitMs = ADMIN_POPOVER_EXIT_MS) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);

  useModalScrollLock(mounted);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
      return () => cancelAnimationFrame(raf);
    }
    setVisible(false);
    const timer = window.setTimeout(() => setMounted(false), exitMs);
    return () => clearTimeout(timer);
  }, [open, exitMs]);

  return { mounted, visible };
}
