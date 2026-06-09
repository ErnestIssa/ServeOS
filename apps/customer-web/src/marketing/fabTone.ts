export type FabTone = "light" | "dark";

/** Shared floating action button surface — matches support + admin theme FABs. */
export function fabToneClasses(tone: FabTone): string {
  return tone === "light"
    ? "border-white/20 bg-white text-slate-900 shadow-[0_8px_32px_rgba(0,0,0,0.35)] hover:bg-slate-50"
    : "border-violet-500/30 bg-slate-900 text-white shadow-[0_8px_32px_rgba(124,58,237,0.35)] hover:bg-slate-800";
}

/** Stacked admin workspace FABs (support above theme). */
export const ADMIN_WORKSPACE_FAB = {
  support: "bottom-[5.75rem] right-4 md:bottom-[5.75rem] md:right-6",
  theme: "bottom-6 right-4 md:bottom-6 md:right-6"
} as const;
