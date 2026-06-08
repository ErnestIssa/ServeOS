import type { ReactNode } from "react";

/** Lightweight scroll reveal — CSS only, no scroll listeners. */
export function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`marketing-reveal ${className}`.trim()}>{children}</div>;
}
