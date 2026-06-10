import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";

const transition = { duration: 0.34, ease: [0.22, 1, 0.36, 1] as const };

type Props = {
  pageKey: string;
  children: ReactNode;
};

export function AdminPageTransition({ pageKey, children }: Props) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pageKey}
        className="admin-page-transition w-full min-w-0"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={transition}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
