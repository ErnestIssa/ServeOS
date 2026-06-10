import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";

const transition = { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const };

type Props = {
  presetKey: string;
  children: ReactNode;
};

/** In-workspace perspective swap — does not remount the workspace shell. */
export function AdminWorkspaceInnerTransition({ presetKey, children }: Props) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={presetKey}
        className="admin-ws-inner-transition w-full min-w-0"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={transition}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
