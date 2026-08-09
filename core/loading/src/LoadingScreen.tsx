import {
  AnimatePresence,
  MotionConfig,
  animate,
  motion,
  useMotionValue,
  useTransform,
  type MotionValue
} from "framer-motion";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { ForkKnifeCircleIcon } from "./icons/ForkKnifeCircleIcon";

export type LoadingScreenProps = {
  /**
   * Set true when the host app finished bootstrapping (session, config, fonts, etc.).
   * The splash stays until both this is true and one full animation + hold completed.
   */
  appReady: boolean;
};

/** Timeline matched to mobile `ServeOSBrandScreenNative` */
const INITIAL_DELAY_MS = 1000;
const BUILD_DURATION_MS = 2600;
const HOLD_MS = 2000;

const T_DELAY = 0.28;
const T_STEP = 0.06;
const LETTER_IN = 0.16;

/** Minimum time from mount until splash may dismiss (delay + build + hold) */
export const MIN_SPLASH_MS = INITIAL_DELAY_MS + BUILD_DURATION_MS + HOLD_MS;

const WORD_STYLE: CSSProperties = {
  fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
  fontWeight: 900,
  letterSpacing: "-1.2px",
  fontSize: "clamp(26px, calc(min(100vw, 430px) * 0.095), 44px)",
  lineHeight: 1,
  color: "#FFFFFF"
};

const ICON_STYLE: CSSProperties = {
  width: "clamp(16px, calc(min(100vw, 430px) * 0.07), 26px)",
  height: "clamp(16px, calc(min(100vw, 430px) * 0.07), 26px)"
};

function useLetterFade(progress: MotionValue<number>, t0: number) {
  const opacity = useTransform(progress, [0, t0, t0 + LETTER_IN, 1], [0, 0, 1, 1]);
  const x = useTransform(opacity, [0, 1], [6, 0]);
  return { opacity, x };
}

export function LoadingScreen({ appReady }: LoadingScreenProps) {
  const [minSplashDone, setMinSplashDone] = useState(false);
  const measureSRef = useRef<HTMLSpanElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  const progress = useMotionValue(0);
  const sWidthMv = useMotionValue(0);
  const rowWidthMv = useMotionValue(0);

  const translateX = useTransform([progress, sWidthMv, rowWidthMv], (values) => {
    const p = Number(values[0] ?? 0);
    const s = Number(values[1] ?? 0);
    const r = Number(values[2] ?? 0);
    if (s <= 0 || r <= 0) return 0;
    const startX = -s / 2;
    const endX = -r / 2;
    return startX + (endX - startX) * p;
  });

  const stageScale = useTransform(progress, [0, 1], [1, 0.99]);

  const E1 = useLetterFade(progress, T_DELAY + T_STEP * 0);
  const R = useLetterFade(progress, T_DELAY + T_STEP * 1);
  const V = useLetterFade(progress, T_DELAY + T_STEP * 2);
  const E2 = useLetterFade(progress, T_DELAY + T_STEP * 3);
  const O = useLetterFade(progress, T_DELAY + T_STEP * 4);
  const lastS = useLetterFade(progress, T_DELAY + T_STEP * 5);

  useLayoutEffect(() => {
    const measure = () => {
      const s = measureSRef.current?.getBoundingClientRect().width ?? 0;
      const r = rowRef.current?.getBoundingClientRect().width ?? 0;
      if (s > 0) sWidthMv.set(s);
      if (r > 0) rowWidthMv.set(r);
    };
    measure();
    // Re-measure after fonts settle
    const t = window.setTimeout(measure, 50);
    window.addEventListener("resize", measure);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", measure);
    };
  }, [sWidthMv, rowWidthMv]);

  useEffect(() => {
    progress.set(0);
    setMinSplashDone(false);

    let holdTimer: ReturnType<typeof setTimeout> | undefined;
    const controls = animate(progress, 1, {
      delay: INITIAL_DELAY_MS / 1000,
      duration: BUILD_DURATION_MS / 1000,
      ease: "linear",
      onComplete: () => {
        holdTimer = setTimeout(() => setMinSplashDone(true), HOLD_MS);
      }
    });

    return () => {
      controls.stop();
      if (holdTimer) clearTimeout(holdTimer);
    };
  }, [progress]);

  const hideSplash = appReady && minSplashDone;

  return (
    <MotionConfig reducedMotion="never">
      <AnimatePresence>
        {!hideSplash ? (
          <motion.div
            key="serveos-loading"
            className="pointer-events-none fixed inset-0 z-[9999] bg-[#000D19]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.25, ease: "easeOut" } }}
            exit={{ opacity: 0, scale: 0.985, transition: { duration: 0.25, ease: "easeInOut" } }}
          >
            {/* Hidden measure for first "S" width — same approach as mobile */}
            <span
              ref={measureSRef}
              aria-hidden
              className="pointer-events-none absolute opacity-0 [font-synthesis:none]"
              style={{ ...WORD_STYLE, left: -9999, top: -9999 }}
            >
              S
            </span>

            {/*
              Full word is always laid out (invisible letters still take space).
              Continuous translateX from -sWidth/2 → -rowWidth/2 keeps the mark
              centered without layout thrash — mirrors ServeOSBrandScreenNative.
            */}
            <motion.div
              ref={rowRef}
              className="absolute left-1/2 top-1/2 flex items-center justify-center [font-synthesis:none]"
              style={{
                ...WORD_STYLE,
                x: translateX,
                y: "-50%",
                scale: stageScale
              }}
              aria-label="SERVEOS"
            >
              <span className="inline-block">S</span>

              <motion.span className="inline-block" style={{ opacity: E1.opacity, x: E1.x }}>
                E
              </motion.span>
              <motion.span className="inline-block" style={{ opacity: R.opacity, x: R.x }}>
                R
              </motion.span>
              <motion.span className="inline-block" style={{ opacity: V.opacity, x: V.x }}>
                V
              </motion.span>
              <motion.span className="inline-block" style={{ opacity: E2.opacity, x: E2.x }}>
                E
              </motion.span>

              <motion.span
                className="inline-flex items-center"
                style={{
                  opacity: O.opacity,
                  x: O.x,
                  y: -2,
                  marginLeft: "0.16em",
                  marginRight: "0.16em"
                }}
              >
                <ForkKnifeCircleIcon title="O" className="text-white" style={ICON_STYLE} />
              </motion.span>

              <motion.span className="inline-block" style={{ opacity: lastS.opacity, x: lastS.x, y: "-0.03em" }}>
                S
              </motion.span>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </MotionConfig>
  );
}
