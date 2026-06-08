import { useEffect, useState } from "react";

/**
 * White FAB on dark regions (hero, footer); dark FAB on light ambient sections.
 */
export function useSupportFabTone(enabled: boolean) {
  const [lightTone, setLightTone] = useState(true);

  useEffect(() => {
    if (!enabled) {
      setLightTone(false);
      return;
    }

    const hero = document.getElementById("top");
    const footer = document.querySelector("[data-marketing-footer]");

    const obs = new IntersectionObserver(
      (entries) => {
        const onDark = entries.some((e) => e.isIntersecting && e.intersectionRatio > 0.08);
        setLightTone(onDark);
      },
      { root: null, rootMargin: "-20% 0px -55% 0px", threshold: [0, 0.08, 0.2] }
    );

    if (hero) obs.observe(hero);
    if (footer) obs.observe(footer);

    return () => obs.disconnect();
  }, [enabled]);

  return lightTone;
}
