/** Glass + typography aligned with customer AmbientWebShell / in-app cards. */

export const marketingRoot = "marketing-site landing-root relative min-h-[100dvh] w-full bg-transparent text-slate-900";

/** Full-bleed sections; content uses contentWrap so edges never touch the viewport. */
export const pageSection = "relative w-full scroll-mt-16 py-16 sm:py-20";

/** Mobile/tablet keep comfortable inset; desktop uses wider rails, near edge-to-edge feel. */
export const pageGutter = "px-5 sm:px-7 md:px-10 lg:px-10 xl:px-14 2xl:px-16";

/** `max-w-6xl` below `lg`; desktop fills width inside gutters. */
export const contentWrap = "mx-auto w-full max-w-6xl lg:max-w-none";

/** Narrow blocks (FAQ, CTAs) — still wider on desktop only. */
export const contentWrapNarrow = "mx-auto w-full max-w-3xl lg:max-w-5xl xl:max-w-6xl";

export const glassPanel =
  "rounded-2xl border border-white/50 bg-white/65 shadow-[0_2px_16px_rgba(15,23,42,0.05)] backdrop-blur-lg";

export const glassPanelLg =
  "rounded-3xl border border-white/50 bg-white/60 shadow-[0_4px_24px_rgba(15,23,42,0.06)] backdrop-blur-xl";

export const darkGlassPanel =
  "rounded-[2rem] border border-white/10 bg-slate-900/88 text-white shadow-[0_8px_32px_rgba(15,23,42,0.2)] backdrop-blur-2xl";

export const eyebrow = "text-[11px] font-bold uppercase tracking-[0.22em] text-violet-700/80";

export const sectionTitle = "font-display mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl";

export const bodyMuted = "text-slate-600";

export const btnPrimary =
  "rounded-full bg-gradient-to-r from-violet-600 to-blue-600 px-6 py-3 text-sm font-bold text-white shadow-[0_4px_20px_rgba(124,58,237,0.25)] transition hover:from-violet-500 hover:to-blue-500";

export const btnSecondary =
  "rounded-full border border-white/60 bg-white/55 px-6 py-3 text-sm font-bold text-slate-900 shadow-sm backdrop-blur-md transition hover:border-violet-200/70 hover:bg-white/75";

export const navShell =
  "sticky top-0 z-50 bg-white/40 backdrop-blur-xl supports-[backdrop-filter]:bg-white/35";

export const mobileBar =
  "fixed inset-x-0 bottom-0 z-40 flex gap-2 bg-white/50 p-3 backdrop-blur-xl supports-[backdrop-filter]:bg-white/40 md:hidden";

/** Footer + nav menu link hover — slight right shift on hover. */
export const linkHoverShift =
  "inline-block text-left transition-[transform,color] duration-200 ease-out hover:translate-x-1";

export const linkHoverShiftGroup =
  "inline-block text-left transition-[transform,color] duration-200 ease-out group-hover:translate-x-1";
