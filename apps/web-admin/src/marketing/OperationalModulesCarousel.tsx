import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode
} from "react";
import { OPERATIONAL_MODULES, type OperationalModule } from "./operationalModules";

const MODULE_COUNT = OPERATIONAL_MODULES.length;
const LOOP_COPIES = 5;
const MOBILE_AUTO_MS = 3000;
const MIDDLE_BAND_START = MODULE_COUNT * 2;

const LOOP_MODULES = Array.from({ length: LOOP_COPIES }, () => OPERATIONAL_MODULES).flat();

function useVisibleCount() {
  const [count, setCount] = useState(3);

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w < 640) setCount(1);
      else if (w < 1024) setCount(2);
      else setCount(3);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return count;
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const update = () => setIsDesktop(window.innerWidth >= 1024);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return isDesktop;
}

function NavPill({
  label,
  onClick,
  children
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-white/70 text-slate-700 shadow-sm backdrop-blur-md transition hover:border-violet-300/70 hover:bg-white hover:text-violet-700"
    >
      {children}
    </button>
  );
}

function ModuleCard({ module, shellClassName }: { module: OperationalModule; shellClassName: string }) {
  return (
    <article
      className={`group relative flex shrink-0 grow-0 flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-950/55 p-7 text-white shadow-[0_8px_32px_rgba(0,0,0,0.2)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-violet-400/25 hover:shadow-[0_20px_56px_rgba(124,58,237,0.18)] sm:p-8 ${shellClassName}`}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-32 rounded-t-3xl bg-gradient-to-b from-violet-600/25 via-blue-600/10 to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-violet-600/15 blur-3xl"
        aria-hidden
      />

      <div className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 shadow-[0_8px_28px_rgba(0,0,0,0.25)] transition duration-300 group-hover:scale-105 group-hover:border-violet-300/35">
        <img
          src={module.iconSrc}
          alt=""
          width={64}
          height={64}
          className="h-16 w-16 object-contain"
          aria-hidden
        />
      </div>

      <div className="relative mt-6 flex items-center gap-2">
        <span className="text-xl font-bold text-violet-300" aria-hidden>
          {module.symbol}
        </span>
        <h3 className="font-display text-2xl font-extrabold tracking-tight text-white">{module.title}</h3>
      </div>

      <p className="relative mt-2 text-sm font-semibold text-violet-200">{module.subtitle}</p>

      <p className="relative mt-5 flex-1 text-sm leading-relaxed text-slate-300">{module.description}</p>

      <div className="relative mt-7 border-t border-white/10 pt-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-violet-300/80">Highlights</p>
        <ul className="mt-3 space-y-2.5">
          {module.highlights.map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm text-slate-300">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

export function OperationalModulesCarousel() {
  const visibleCount = useVisibleCount();
  const isDesktop = useIsDesktop();
  const [activeIndex, setActiveIndex] = useState(MIDDLE_BAND_START);
  const [animate, setAnimate] = useState(true);
  const [stepPx, setStepPx] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragStartXRef = useRef<number | null>(null);
  const resetTimerRef = useRef<number | null>(null);

  const logicalIndex = ((activeIndex % MODULE_COUNT) + MODULE_COUNT) % MODULE_COUNT;

  const normalizeIndex = useCallback((index: number) => {
    const upper = MODULE_COUNT * (LOOP_COPIES - 1);
    const lower = MODULE_COUNT;
    if (index >= upper) return index - MODULE_COUNT;
    if (index < lower) return index + MODULE_COUNT;
    return index;
  }, []);

  const advance = useCallback((delta: number) => {
    setAnimate(true);
    setActiveIndex((i) => i + delta);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const measure = () => {
      const first = track.firstElementChild as HTMLElement | null;
      const second = track.children[1] as HTMLElement | null;
      if (first && second) {
        setStepPx(second.offsetLeft - first.offsetLeft);
      } else if (first) {
        setStepPx(first.offsetWidth);
      }
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(track);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [visibleCount, isDesktop]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const onEnd = (e: TransitionEvent) => {
      if (e.target !== track || e.propertyName !== "transform") return;
      const next = normalizeIndex(activeIndex);
      if (next !== activeIndex) {
        setAnimate(false);
        setActiveIndex(next);
        if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current);
        resetTimerRef.current = window.setTimeout(() => setAnimate(true), 20);
      }
    };

    track.addEventListener("transitionend", onEnd);
    return () => track.removeEventListener("transitionend", onEnd);
  }, [activeIndex, normalizeIndex]);

  useEffect(() => {
    if (isDesktop) return;
    const timer = window.setInterval(() => advance(1), MOBILE_AUTO_MS);
    return () => window.clearInterval(timer);
  }, [isDesktop, advance]);

  useEffect(
    () => () => {
      if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current);
    },
    []
  );

  const goToModule = (moduleIndex: number) => {
    if (moduleIndex === logicalIndex) return;
    setAnimate(true);
    const forward = (moduleIndex - logicalIndex + MODULE_COUNT) % MODULE_COUNT;
    const backward = forward - MODULE_COUNT;
    const delta = Math.abs(forward) <= Math.abs(backward) ? forward : backward;
    setActiveIndex((i) => i + delta);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (isDesktop) return;
    const track = trackRef.current;
    if (!track) return;
    track.setPointerCapture(e.pointerId);
    dragStartXRef.current = e.clientX;
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (isDesktop) return;
    const track = trackRef.current;
    if (!track || dragStartXRef.current === null) return;
    const deltaX = e.clientX - dragStartXRef.current;
    dragStartXRef.current = null;
    track.releasePointerCapture(e.pointerId);
    if (Math.abs(deltaX) < 40) return;
    advance(deltaX > 0 ? -1 : 1);
  };

  const cardWidthClass =
    visibleCount === 1
      ? "w-[calc(100vw-1.5rem)]"
      : visibleCount === 2
        ? "w-[calc((100vw-1.5rem-0.75rem)/2.12)]"
        : "w-[calc((100vw-1.5rem-1.5rem)/3.18)]";

  const cardHeightClass = "h-[34rem] sm:h-[36rem]";
  const cardShellClass = `${cardWidthClass} ${cardHeightClass}`;

  return (
    <>
      <div
        ref={trackRef}
        className={`mt-12 flex w-max gap-0 overflow-visible px-5 will-change-transform lg:gap-3 lg:px-10 ${isDesktop ? "" : "cursor-grab active:cursor-grabbing"} ${animate ? "transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]" : ""}`}
        style={{ transform: stepPx > 0 ? `translateX(-${activeIndex * stepPx}px)` : undefined }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {LOOP_MODULES.map((module, index) => (
          <ModuleCard key={`${module.id}-${index}`} module={module} shellClassName={cardShellClass} />
        ))}
      </div>

      <div className="mt-8 flex flex-col items-center gap-4 px-5 lg:px-10">
        <div className="hidden items-center gap-3 lg:flex">
          <NavPill label="Previous module" onClick={() => advance(-1)}>
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 6l-6 6 6 6" />
            </svg>
          </NavPill>
          <NavPill label="Next module" onClick={() => advance(1)}>
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
            </svg>
          </NavPill>
        </div>

        <div className="flex items-center justify-center gap-2 lg:hidden" role="tablist" aria-label="Operational modules">
          {OPERATIONAL_MODULES.map((module, index) => {
            const isActive = index === logicalIndex;
            return (
              <button
                key={module.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={`Show ${module.title}`}
                onClick={() => goToModule(index)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  isActive ? "w-6 bg-violet-600" : "w-2 bg-slate-300 hover:bg-violet-300"
                }`}
              />
            );
          })}
        </div>
      </div>
    </>
  );
}
