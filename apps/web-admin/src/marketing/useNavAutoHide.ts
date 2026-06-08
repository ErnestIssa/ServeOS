import { useEffect, useRef, useState } from "react";

const TOP_ALWAYS_VISIBLE = 64;
const SCROLL_DELTA = 6;

/** Hide on scroll down, reveal on scroll up; always visible near top of page. */
export function useNavAutoHide(enabled = true) {
  const [visible, setVisible] = useState(true);
  const lastY = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setVisible(true);
      return;
    }

    lastY.current = window.scrollY;

    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const y = window.scrollY;
        const delta = y - lastY.current;

        if (y <= TOP_ALWAYS_VISIBLE) {
          setVisible(true);
        } else if (delta > SCROLL_DELTA) {
          setVisible(false);
        } else if (delta < -SCROLL_DELTA) {
          setVisible(true);
        }

        lastY.current = y;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [enabled]);

  return visible;
}
