export type FabTone = "light" | "dark";

/** ServeOS wordmark “OS” gradient (violet-600 → blue-600). */
export const FAB_BRAND_CLASSES =
  "border-white/25 bg-gradient-to-r from-violet-600 to-blue-600 text-white shadow-[0_8px_32px_rgba(124,58,237,0.42)] hover:brightness-110";

/** Shared floating action button surface — matches support + admin theme FABs. */
export function fabToneClasses(tone: FabTone): string {
  return tone === "light"
    ? "border-white/20 bg-white text-slate-900 shadow-[0_8px_32px_rgba(0,0,0,0.35)] hover:bg-slate-50"
    : "border-violet-500/30 bg-slate-900 text-white shadow-[0_8px_32px_rgba(124,58,237,0.35)] hover:bg-slate-800";
}

/** Stacked admin workspace FABs (support). */
export const ADMIN_WORKSPACE_FAB = {
  support: "bottom-6 right-4 md:bottom-6 md:right-6"
} as const;
