import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { ForkKnifeCircleIcon } from "./icons/ForkKnifeCircleIcon";

export type LoadingScreenProps = {
  /**
   * Set true when the host app finished bootstrapping (session, config, fonts, etc.).
   * The splash stays until both this is true and one full animation + hold completed.
   */
  appReady: boolean;
};

const LETTERS = ["S", "E", "R", "V", "E", "O", "S"] as const;

/** Letter build timing — keep in sync with timers below */
const BUILD_DELAY_MS = 720;
const PER_LETTER_MS = 95;
/** Last letter motion ~0.22s in framer */
const LAST_LETTER_TRANSITION_MS = 230;
/** Full word visible, then hold before the app may advance */
const HOLD_AFTER_FULL_WORD_MS = 2000;

const FULL_WORD_MS =
  BUILD_DELAY_MS + (LETTERS.length - 2) * PER_LETTER_MS + LAST_LETTER_TRANSITION_MS;

/** Minimum time from mount until splash may dismiss (after full word + hold) */
export const MIN_SPLASH_MS = FULL_WORD_MS + HOLD_AFTER_FULL_WORD_MS;

export function LoadingScreen({ appReady }: LoadingScreenProps) {
  const [shown, setShown] = useState(1);
  const [sweepKey, setSweepKey] = useState(0);
  const [minSplashDone, setMinSplashDone] = useState(false);

  const isComplete = shown >= LETTERS.length;
  const visible = useMemo(() => LETTERS.slice(0, Math.max(1, shown)), [shown]);

  const hideSplash = appReady && minSplashDone;

  useEffect(() => {
    setShown(1);
    setSweepKey((k) => k + 1);

    const timers: Array<ReturnType<typeof setTimeout>> = [];

    timers.push(
      setTimeout(() => {
        for (let i = 2; i <= LETTERS.length; i += 1) {
          timers.push(setTimeout(() => setShown(i), (i - 2) * PER_LETTER_MS));
        }
      }, BUILD_DELAY_MS)
    );

    timers.push(
      setTimeout(() => {
        setMinSplashDone(true);
      }, MIN_SPLASH_MS)
    );

    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <MotionConfig reducedMotion="never">
      <AnimatePresence>
        {!hideSplash ? (
          <motion.div
            key="serveos-loading"
            className="pointer-events-none fixed inset-0 z-[9999] flex items-center justify-center bg-[#000D19]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.25, ease: "easeOut" } }}
            exit={{ opacity: 0, scale: 0.985, transition: { duration: 0.25, ease: "easeInOut" } }}
          >
            <div className="relative">
              <motion.div
                className="relative flex items-center justify-center font-black leading-none tracking-[-0.08em] text-white [font-synthesis:none] text-[clamp(48px,10vw,124px)]"
                style={{
                  fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif"
                }}
                aria-label="SERVEOS"
                layout
                transition={{ duration: 0.28, ease: [0.2, 0.9, 0.2, 1] }}
              >
                {visible.map((ch, idx) => {
                  const isFirstS = idx === 0;
                  const isIconO = ch === "O";

                  if (isIconO) {
                    return (
                      <motion.span
                        key={`O-${idx}`}
                        className="mx-2 inline-flex items-center -translate-y-[0.09em]"
                        initial={{ opacity: 0, x: 12, filter: "blur(10px)" }}
                        animate={{
                          opacity: 1,
                          x: 0,
                          filter: "blur(0px)",
                          transition: { duration: 0.22, ease: [0.2, 0.9, 0.2, 1] }
                        }}
                        layout
                      >
                        <motion.span
                          initial={{ scale: 1, filter: "drop-shadow(0 0 0 rgba(59,130,246,0))" }}
                          animate={{
                            scale: [1, 1.05, 1],
                            filter: [
                              "drop-shadow(0 0 0 rgba(59,130,246,0))",
                              "drop-shadow(0 0 14px rgba(59,130,246,0.45))",
                              "drop-shadow(0 0 0 rgba(59,130,246,0))"
                            ]
                          }}
                          transition={{ duration: 0.55, ease: "easeOut" }}
                        >
                          <ForkKnifeCircleIcon
                            title="O"
                            className="h-[clamp(18px,4vw,45px)] w-[clamp(18px,4vw,45px)] text-white"
                          />
                        </motion.span>
                      </motion.span>
                    );
                  }

                  return (
                    <motion.span
                      key={`${ch}-${idx}`}
                      className={
                        ch === "S" && idx === LETTERS.length - 1
                          ? "inline-block -translate-y-[0.03em]"
                          : "inline-block"
                      }
                      {...(isFirstS
                        ? {
                            initial: { opacity: 0, scale: 0.95, filter: "blur(10px)" },
                            animate: {
                              opacity: 1,
                              scale: 1,
                              filter: "blur(0px)",
                              transition: { duration: 0.32, ease: [0.2, 0.9, 0.2, 1], delay: 0.08 }
                            }
                          }
                        : {
                            initial: { opacity: 0, x: 12, filter: "blur(10px)" },
                            animate: {
                              opacity: 1,
                              x: 0,
                              filter: "blur(0px)",
                              transition: { duration: 0.22, ease: [0.2, 0.9, 0.2, 1] }
                            }
                          })}
                      layout
                    >
                      {ch}
                    </motion.span>
                  );
                })}
              </motion.div>

              <motion.div
                className="pointer-events-none absolute inset-0 -z-10 rounded-2xl"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{
                  opacity: [0, 0.55, 0],
                  scale: [0.98, 1.05, 1.08]
                }}
                transition={{
                  duration: 0.55,
                  ease: "easeOut",
                  delay: 0.45
                }}
                style={{
                  boxShadow:
                    "0 0 24px rgba(59, 130, 246, 0.55), 0 0 64px rgba(59, 130, 246, 0.28), 0 0 120px rgba(59, 130, 246, 0.16)"
                }}
              />

              <AnimatePresence>
                {isComplete ? (
                  <motion.div
                    key={`sweep-${sweepKey}`}
                    className="pointer-events-none absolute inset-y-[-30%] left-[-35%] w-[45%] rotate-[18deg] bg-gradient-to-r from-transparent via-white/15 to-transparent mix-blend-screen"
                    initial={{ x: "-30%", opacity: 0 }}
                    animate={{ x: "190%", opacity: [0, 1, 0] }}
                    exit={{ opacity: 0 }}
                    transition={{
                      duration: 0.5,
                      ease: "easeInOut",
                      delay: 0.08
                    }}
                  />
                ) : null}
              </AnimatePresence>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </MotionConfig>
  );
}
