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
