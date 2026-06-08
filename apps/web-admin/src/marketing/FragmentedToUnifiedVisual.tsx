import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { FRAGMENTED_TOOLS, type FragmentedTool } from "./fragmentedToUnifiedContent";

type FlowPath = {
  id: string;
  d: string;
  delay: number;
};

function buildCurvedPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  bend: number
): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const perpX = (-dy / len) * len * 0.14 * bend;
  const perpY = (dx / len) * len * 0.14 * bend;
  const wobble = bend * 0.35;

  const c1x = x1 + dx * 0.28 + perpX * (1 + wobble);
  const c1y = y1 + dy * 0.28 + perpY * (1 - wobble * 0.5);
  const c2x = x1 + dx * 0.72 - perpX * 0.6;
  const c2y = y1 + dy * 0.72 - perpY * 0.4 + len * 0.04 * wobble;

  return `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`;
}

function FragmentedToolCard({ tool }: { tool: FragmentedTool }) {
  return (
    <div
      data-ftu-tool={tool.id}
      className="ftu-tool-card absolute"
      style={{
        left: `${tool.x}%`,
        top: `${tool.y}%`
      }}
    >
      <div className={tool.floatClass} style={{ rotate: `${tool.rotate}deg` }}>
        <div className="flex h-[5rem] w-[6rem] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-slate-300/90 bg-white/80 px-2 py-2.5 shadow-[0_6px_24px_rgba(15,23,42,0.12)] backdrop-blur-md">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white bg-white shadow-sm">
            {tool.iconSrc ? (
              <img src={tool.iconSrc} alt="" width={26} height={26} className="h-[26px] w-[26px] object-contain" aria-hidden />
            ) : (
              <span className="text-lg font-black text-violet-700" aria-hidden>
                {tool.symbol}
              </span>
            )}
          </div>
          <span className="text-[11px] font-extrabold uppercase tracking-wide text-slate-800">{tool.label}</span>
        </div>
      </div>
    </div>
  );
}

function FragmentedCluster() {
  return (
    <div className="relative mx-auto h-[28rem] w-full max-w-[26rem]">
      {FRAGMENTED_TOOLS.map((tool) => (
        <FragmentedToolCard key={tool.id} tool={tool} />
      ))}
    </div>
  );
}

function ServeOsLogoMark({ logoRef }: { logoRef: RefObject<HTMLDivElement | null> }) {
  return (
    <div className="relative flex h-[28rem] w-full items-center justify-center">
      <div className="pointer-events-none absolute h-56 w-56 rounded-full bg-violet-600/15 blur-3xl" aria-hidden />
      <div ref={logoRef} className="ftu-logo-target relative">
        <p className="font-display text-6xl font-black tracking-tight text-slate-900 xl:text-7xl 2xl:text-8xl">
          Serve<span className="bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent">OS</span>
        </p>
      </div>
    </div>
  );
}

export function FragmentedToUnifiedVisual() {
  const sceneRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const [flowPaths, setFlowPaths] = useState<FlowPath[]>([]);

  const updateFlowPaths = useCallback(() => {
    const scene = sceneRef.current;
    const logo = logoRef.current;
    if (!scene || !logo) return;

    const sceneRect = scene.getBoundingClientRect();
    const logoRect = logo.getBoundingClientRect();
    const endX = logoRect.left - sceneRect.left + 4;
    const endY = logoRect.top + logoRect.height / 2 - sceneRect.top;

    const next = FRAGMENTED_TOOLS.map((tool, index) => {
      const card = scene.querySelector<HTMLElement>(`[data-ftu-tool="${tool.id}"]`);
      if (!card) return null;

      const cardRect = card.getBoundingClientRect();
      const startX = cardRect.right - sceneRect.left;
      const startY = cardRect.top + cardRect.height / 2 - sceneRect.top;

      return {
        id: tool.id,
        d: buildCurvedPath(startX, startY, endX, endY, tool.pathBend),
        delay: index * 0.32
      };
    }).filter((p): p is FlowPath => p !== null);

    setFlowPaths(next);
  }, []);

  useEffect(() => {
    updateFlowPaths();

    const scene = sceneRef.current;
    if (!scene) return;

    const ro = new ResizeObserver(updateFlowPaths);
    ro.observe(scene);
    window.addEventListener("resize", updateFlowPaths);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateFlowPaths);
    };
  }, [updateFlowPaths]);

  return (
    <div className="hidden lg:block" aria-label="Restaurant tools flowing into ServeOS">
      <div ref={sceneRef} className="relative">
        <svg
          className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible"
          aria-hidden
        >
          <defs>
            <marker
              id="ftu-arrowhead"
              viewBox="0 0 12 12"
              refX="10"
              refY="6"
              markerWidth="8"
              markerHeight="8"
              orient="auto"
            >
              <path d="M 1 1 L 11 6 L 1 11 Z" className="ftu-arrow-fill" />
            </marker>
          </defs>
          {flowPaths.map((path) => (
            <path
              key={path.id}
              d={path.d}
              fill="none"
              className="ftu-flow-line"
              markerEnd="url(#ftu-arrowhead)"
              style={{ animationDelay: `${path.delay}s` }}
            />
          ))}
        </svg>

        <div className="relative z-10 grid grid-cols-2 items-center gap-8 xl:gap-16">
          <FragmentedCluster />
          <ServeOsLogoMark logoRef={logoRef} />
        </div>
      </div>
    </div>
  );
}
