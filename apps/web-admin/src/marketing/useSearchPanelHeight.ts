import { useEffect, useState } from "react";

/** Viewport cap for search body (below floating nav bar + top inset). */
export function getSearchViewportCapPx(navBarHeightPx: number) {
  if (typeof window === "undefined") return 480;
  const topInset = 20;
  const bottomBreathing = 16;
  const available = window.innerHeight - topInset - navBarHeightPx - bottomBreathing;
  return Math.max(180, available);
}

/** Animated panel height: content-sized up to viewport cap; shrinks when content decreases. */
export function useSearchPanelHeight(
  searchOpen: boolean,
  contentHeight: number,
  navBarHeightPx: number
) {
  const [panelHeightPx, setPanelHeightPx] = useState(0);

  useEffect(() => {
    const update = () => {
      if (!searchOpen) {
        setPanelHeightPx(0);
        return;
      }
      const cap = getSearchViewportCapPx(navBarHeightPx);
      const content = contentHeight > 0 ? contentHeight : 48;
      setPanelHeightPx(Math.min(content, cap));
    };

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [searchOpen, contentHeight, navBarHeightPx]);

  return panelHeightPx;
}
