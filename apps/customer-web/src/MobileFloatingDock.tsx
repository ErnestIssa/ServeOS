import { animate, motion, useMotionValue, useSpring } from "framer-motion";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

const LINKS = [
  { href: "#top", label: "Home" },
  { href: "#account", label: "Account" },
  { href: "#menu", label: "Menu" },
  { href: "#cart", label: "Cart" },
  { href: "#track", label: "Track" }
] as const;

/**
 * Mobile / tablet: floating glass bar with a **draggable liquid pill** (spring snap, backdrop blur).
 * Desktop: hidden (`lg:hidden`).
 */
export function MobileFloatingDock() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackW, setTrackW] = useState(0);
  const n = LINKS.length;
  const seg = trackW > 0 ? trackW / n : 0;

  const x = useMotionValue(0);
  const pillX = useSpring(x, { stiffness: 440, damping: 34, mass: 0.9 });

  const [active, setActive] = useState(0);
  const drag = useRef({ active: false, startClient: 0, startX: 0 });

  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setTrackW(el.clientWidth));
    ro.observe(el);
    setTrackW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (seg <= 0) return;
    void animate(x, active * seg, { type: "spring", stiffness: 440, damping: 32 });
  }, [active, seg, x]);

  const snapToIndex = (idx: number) => {
    const clamped = Math.max(0, Math.min(n - 1, idx));
    setActive(clamped);
    const id = LINKS[clamped]?.href.slice(1);
    if (id) {
      window.location.hash = id;
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("a[data-dock-link]")) return;
    e.preventDefault();
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    drag.current = { active: true, startClient: e.clientX, startX: x.get() };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current.active) return;
    const dx = e.clientX - drag.current.startClient;
    const max = Math.max(0, (n - 1) * seg);
    x.set(Math.max(0, Math.min(max, drag.current.startX + dx)));
  };

  const endDrag = (e: React.PointerEvent) => {
    if (!drag.current.active) return;
    drag.current.active = false;
    try {
      (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (seg <= 0) return;
    const idx = Math.round(x.get() / seg);
    snapToIndex(idx);
  };

  const pillW = seg > 0 ? seg - 16 : 0;

  return (
    <nav
      className="pointer-events-none fixed inset-x-0 z-[60] lg:hidden"
      style={{
        bottom: "max(10px, env(safe-area-inset-bottom, 0px))",
        paddingLeft: "max(10px, env(safe-area-inset-left, 0px))",
        paddingRight: "max(10px, env(safe-area-inset-right, 0px))"
      }}
      aria-label="Quick navigation"
    >
      <div
        ref={trackRef}
        className="pointer-events-auto relative min-h-[56px] touch-pan-y rounded-[28px] border border-white/50 bg-white/45 shadow-[0_16px_48px_rgba(15,23,42,0.16)] backdrop-blur-2xl"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {pillW > 0 ? (
          <motion.div
            className="pointer-events-none absolute inset-y-1 rounded-[20px] border border-white/55 bg-white/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] backdrop-blur-md"
            style={{
              left: 8,
              width: pillW,
              x: pillX,
              top: 6,
              bottom: 6
            }}
          />
        ) : null}

        <div className="relative z-10 flex min-h-[52px] items-stretch justify-between gap-0.5 px-1 py-1">
          {LINKS.map((l, i) => (
            <a
              key={l.href}
              data-dock-link
              href={l.href}
              className={`flex min-h-[44px] min-w-0 flex-1 items-center justify-center rounded-[22px] px-1 text-center text-[10px] font-semibold leading-tight transition-colors hover:bg-white/35 sm:text-[11px] ${active === i ? "text-slate-900" : "text-slate-600"}`}
              onClick={(e) => {
                e.preventDefault();
                setActive(i);
                const id = l.href.slice(1);
                window.location.hash = id;
                document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                if (seg > 0) void animate(x, i * seg, { type: "spring", stiffness: 440, damping: 32 });
              }}
            >
              {l.label}
            </a>
          ))}
        </div>
      </div>
    </nav>
  );
}
