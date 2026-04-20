import { type ReactNode } from "react";
import { motion, useScroll, useSpring, useTransform, type MotionValue } from "framer-motion";
import { ambientWebPalettes, type AmbientWebVariant } from "./themes";

const NOISE_SVG = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">
    <filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="4" stitchTiles="stitch"/></filter>
    <rect width="100%" height="100%" filter="url(#n)" opacity="0.5"/>
  </svg>`
);

/** Soft radial: stepped alpha falloff + large ellipse + heavy blur — no hard “lamp shade” edge. */
function softBlobCss(rgba: string, at: string, size = "118%") {
  const m = rgba.match(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/i);
  if (!m) return "transparent";
  const [, r, g, b] = m;
  const rgb = `${r},${g},${b}`;
  return `radial-gradient(ellipse ${size} ${size} at ${at},
    rgba(${rgb},0.5) 0%,
    rgba(${rgb},0.2) 38%,
    rgba(${rgb},0.07) 62%,
    rgba(${rgb},0.02) 80%,
    rgba(${rgb},0) 94%)`;
}

function buildLinearBase(stops: Array<{ c: string; p: number }>) {
  return `linear-gradient(180deg, ${stops.map((s) => `${s.c} ${s.p}%`).join(", ")})`;
}

function MeshLayers({ variant, scrollY }: { variant: AmbientWebVariant; scrollY: MotionValue<number> }) {
  const p = ambientWebPalettes[variant];

  const b1y = useSpring(useTransform(scrollY, [0, 900], [0, 160]), { stiffness: 90, damping: 28 });
  const b2y = useSpring(useTransform(scrollY, [0, 900], [0, -110]), { stiffness: 90, damping: 28 });
  const b2x = useSpring(useTransform(scrollY, [0, 900], [0, 72]), { stiffness: 90, damping: 28 });
  const b3y = useSpring(useTransform(scrollY, [0, 900], [0, 95]), { stiffness: 90, damping: 28 });
  const b3x = useSpring(useTransform(scrollY, [0, 900], [0, -40]), { stiffness: 90, damping: 28 });

  const depth = useSpring(useTransform(scrollY, [0, 820], [0.05, variant === "admin" ? 0.42 : 0.34]), {
    stiffness: 100,
    damping: 30
  });

  const shimmer = useSpring(useTransform(scrollY, [0, 1200], [0, 1]), { stiffness: 80, damping: 35 });
  const washOpacity = useTransform(shimmer, [0, 1], [0.5, 0.92]);
  const blob3Opacity = useSpring(useTransform(scrollY, [0, 600], [0.48, 0.88]), { stiffness: 120, damping: 32 });

  const base = buildLinearBase(p.baseStops);

  return (
    <div className="pointer-events-none fixed inset-0 z-0 isolate overflow-hidden" aria-hidden>
      <div className="absolute inset-0" style={{ background: base }} />

      <motion.div
        className="absolute -left-[22%] -top-[16%] h-[min(110vw,720px)] w-[min(110vw,720px)] rounded-full"
        style={{
          background: softBlobCss(p.blobA, "42% 38%"),
          filter: "blur(72px)",
          y: b1y,
          opacity: washOpacity,
          willChange: "transform, opacity"
        }}
      />

      <motion.div
        className="absolute -right-[12%] top-[4%] h-[min(100vw,640px)] w-[min(100vw,640px)] rounded-full"
        style={{
          background: softBlobCss(p.blobB, "55% 42%"),
          filter: "blur(78px)",
          y: b2y,
          x: b2x,
          opacity: washOpacity,
          willChange: "transform, opacity"
        }}
      />

      <motion.div
        className="absolute bottom-[-24%] left-[4%] h-[min(105vw,680px)] w-[min(105vw,680px)] rounded-full"
        style={{
          background: softBlobCss(p.blobC, "50% 52%", "122%"),
          filter: "blur(84px)",
          y: b3y,
          x: b3x,
          opacity: blob3Opacity,
          willChange: "transform, opacity"
        }}
      />

      <motion.div
        className="absolute inset-0"
        style={{
          background:
            variant === "admin"
              ? `linear-gradient(180deg,
                  transparent 0%,
                  rgba(15,23,42,0.03) 24%,
                  rgba(15,23,42,0.09) 48%,
                  rgba(15,23,42,0.22) 68%,
                  rgba(15,23,42,0.48) 86%,
                  rgba(15,23,42,0.82) 100%)`
              : `linear-gradient(180deg,
                  transparent 0%,
                  rgba(15,23,42,0.02) 30%,
                  rgba(15,23,42,0.07) 54%,
                  rgba(15,23,42,0.18) 74%,
                  rgba(15,23,42,0.4) 90%,
                  rgba(15,23,42,0.72) 100%)`,
          opacity: depth
        }}
      />

      <div
        className="absolute inset-0 opacity-[0.18] mix-blend-soft-light md:opacity-[0.11]"
        style={{
          background: `radial-gradient(ellipse 100% 70% at 82% 4%, ${p.warmAccent}, transparent 62%)`
        }}
      />

      <div
        className="absolute inset-0 opacity-[0.028] mix-blend-overlay md:opacity-[0.018]"
        style={{ backgroundImage: `url("data:image/svg+xml,${NOISE_SVG}")`, backgroundSize: "256px 256px" }}
      />
    </div>
  );
}

export function AmbientWebShell({
  variant,
  children,
  className
}: {
  variant: AmbientWebVariant;
  children: ReactNode;
  className?: string;
}) {
  /** Window scroll — nested overflow-y on a min-height box trapped wheel/touch scroll on web. */
  const { scrollY } = useScroll();

  return (
    <div className="relative min-h-[100dvh] w-full bg-transparent text-slate-900">
      <MeshLayers variant={variant} scrollY={scrollY} />
      <div
        className={`relative z-10 min-h-[100dvh] overflow-x-hidden pt-[env(safe-area-inset-top,0px)] ${className ?? ""}`}
      >
        {children}
      </div>
    </div>
  );
}
