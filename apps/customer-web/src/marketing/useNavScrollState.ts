import { useEffect, useState } from "react";

/** True once the user has scrolled past the hero band (glass nav). */
export function useNavScrollState(heroMode: boolean, threshold = 72) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!heroMode) {
      setScrolled(true);
      return;
    }

    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [heroMode, threshold]);

  return scrolled;
}
