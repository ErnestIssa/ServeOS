import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import { COMMS_PANE_MOTION } from "./commsPaneMotion";

export function CommsAnimatedPane({
  paneKey,
  children,
  className
}: {
  paneKey: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={paneKey} className={className} {...COMMS_PANE_MOTION}>
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
