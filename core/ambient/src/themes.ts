/** Scroll-reactive ambient palettes (Revolut-style: light top → deeper bottom, cold accents). */
export type AmbientWebVariant = "customer" | "admin";

export type AmbientNativeTab = "home" | "bookings" | "orders" | "messages" | "account";

/** Extra-smooth vertical bases — many stops so there is no visible “band” between hues. */
export const ambientWebPalettes: Record<
  AmbientWebVariant,
  {
    /** [color, position%] pairs for linear-gradient */
    baseStops: Array<{ c: string; p: number }>;
    blobA: string;
    blobB: string;
    blobC: string;
    coolWash: string;
    warmAccent: string;
  }
> = {
  customer: {
    baseStops: [
      { c: "#f8fafc", p: 0 },
      { c: "#f1f5f9", p: 10 },
      { c: "#eef2ff", p: 26 },
      { c: "#e0e7ff", p: 44 },
      { c: "#c7d2fe", p: 62 },
      { c: "#a5b4fc", p: 78 },
      { c: "#93c5fd", p: 100 }
    ],
    blobA: "rgba(139, 92, 246, 0.42)",
    blobB: "rgba(59, 130, 246, 0.34)",
    blobC: "rgba(45, 212, 191, 0.22)",
    coolWash: "rgba(15, 23, 42, 0.12)",
    warmAccent: "rgba(251, 191, 36, 0.1)"
  },
  admin: {
    baseStops: [
      { c: "#f8fafc", p: 0 },
      { c: "#e2e8f0", p: 14 },
      { c: "#cbd5e1", p: 32 },
      { c: "#94a3b8", p: 52 },
      { c: "#64748b", p: 68 },
      { c: "#334155", p: 82 },
      { c: "#0f172a", p: 100 }
    ],
    blobA: "rgba(37, 99, 235, 0.32)",
    blobB: "rgba(124, 58, 237, 0.26)",
    blobC: "rgba(14, 165, 233, 0.18)",
    coolWash: "rgba(15, 23, 42, 0.18)",
    warmAccent: "rgba(245, 158, 11, 0.08)"
  }
};

/**
 * Native page backgrounds: exactly **two** solid hues per tab — light at top, darker at bottom.
 * No blob mixes (handled in ScrollMeshBackground). Scroll adds a uniform depth overlay.
 */
export const ambientNativePalettes: Record<AmbientNativeTab, { top: string; bottom: string }> = {
  home: { top: "#F8FAFC", bottom: "#C4B5FD" },
  bookings: { top: "#FAF5FF", bottom: "#A78BFA" },
  orders: { top: "#F0FDFA", bottom: "#8B5CF6" },
  messages: { top: "#F5F3FF", bottom: "#818CF8" },
  account: { top: "#F8FAFC", bottom: "#94A3B8" }
};

function normalizeHex(hex: string): string {
  const h = hex.replace("#", "").trim();
  if (h.length === 6) return h;
  if (h.length === 3) {
    return h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  return "000000";
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = parseInt(normalizeHex(hex), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (x: number) => Math.max(0, Math.min(255, Math.round(x)));
  return `#${[c(r), c(g), c(b)]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("")}`;
}

/**
 * Saturated accent for floating nav — same hue DNA as {@link ambientNativePalettes} for `tab`,
 * blended toward the page “bottom” color and deepened so it reads as a bold capsule over the gradient.
 */
export function nativeNavBoldGradient(tab: AmbientNativeTab): { crest: string; deep: string } {
  const { top: pageTop, bottom: pageBottom } = ambientNativePalettes[tab];
  const a = hexToRgb(pageTop);
  const b = hexToRgb(pageBottom);
  const wTop = 0.18;
  const wBot = 0.82;
  let rCh = a.r * wTop + b.r * wBot;
  let gCh = a.g * wTop + b.g * wBot;
  let bCh = a.b * wTop + b.b * wBot;

  /** Stronger chroma push for a vivid nav capsule vs page wash. */
  const mid = (rCh + gCh + bCh) / 3;
  const saturate = 1.22;
  rCh = mid + (rCh - mid) * saturate;
  gCh = mid + (gCh - mid) * saturate;
  bCh = mid + (bCh - mid) * saturate;

  const crest = rgbToHex(rCh * 0.93, gCh * 0.93, bCh * 0.93);
  const deep = rgbToHex(rCh * 0.68, gCh * 0.68, bCh * 0.68);

  return { crest, deep };
}
