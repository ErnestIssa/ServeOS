import { useEffect, useState, type CSSProperties, type RefObject } from "react";

const NAV_MIN_TOP_PX = 92;
const MOBILE_NAV_MIN_TOP_PX = 72;
const DESKTOP_MIN_WIDTH = 1024;
const FOOTER_FADE_PX = 56;

function readFooterTop(): number | null {
  const footer = document.querySelector("[data-marketing-footer]");
  return footer ? footer.getBoundingClientRect().top : null;
}

function footerFadeOpacity(footerTop: number | null, panelTop: number, panelHeight: number): number {
  if (footerTop === null) return 1;
  const panelBottom = panelTop + panelHeight;
  const gap = footerTop - panelBottom;
  if (gap <= 0) return 0;
  if (gap >= FOOTER_FADE_PX) return 1;
  return gap / FOOTER_FADE_PX;
}

/** Pin sidebar TOC — aligns with main content top, hides as footer approaches. */
export function useLegalSidebarTocPin(
  columnRef: RefObject<HTMLElement | null>,
  navRef: RefObject<HTMLElement | null>,
  contentAnchorRef: RefObject<HTMLElement | null>,
  enabled: boolean
): CSSProperties {
  const [style, setStyle] = useState<CSSProperties>({ visibility: "hidden", opacity: 0 });

  useEffect(() => {
    if (!enabled) return;

    const update = () => {
      const column = columnRef.current;
      const nav = navRef.current;
      const content = contentAnchorRef.current;
      if (!column || !nav || !content || window.innerWidth < DESKTOP_MIN_WIDTH) {
        setStyle({ visibility: "hidden", opacity: 0 });
        return;
      }

      const columnRect = column.getBoundingClientRect();
      if (columnRect.width < 8) {
        setStyle({ visibility: "hidden", opacity: 0 });
        return;
      }

      const contentTop = content.getBoundingClientRect().top;
      const top = Math.max(NAV_MIN_TOP_PX, contentTop);
      const navHeight = nav.offsetHeight;
      const footerTop = readFooterTop();
      const opacity = footerFadeOpacity(footerTop, top, navHeight);
      const hidden = opacity <= 0.02;

      setStyle({
        position: "fixed",
        top: `${top}px`,
        left: `${columnRect.left}px`,
        width: `${columnRect.width}px`,
        maxHeight: `calc(100dvh - ${top + 16}px)`,
        visibility: hidden ? "hidden" : "visible",
        opacity,
        transform: hidden ? "translateY(10px)" : "translateY(0)",
        pointerEvents: hidden ? "none" : "auto",
        zIndex: 30,
        transition: "opacity 0.28s ease, transform 0.28s ease, top 0.15s ease"
      });
    };

    update();
    const ro = new ResizeObserver(update);
    if (columnRef.current) ro.observe(columnRef.current);
    if (navRef.current) ro.observe(navRef.current);
    if (contentAnchorRef.current) ro.observe(contentAnchorRef.current);
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);

    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [enabled, columnRef, navRef, contentAnchorRef]);

  return style;
}

/** Pin mobile TOC bar — aligns with article top, fades before footer. */
export function useLegalMobileTocPin(
  articleRef: RefObject<HTMLElement | null>,
  barRef: RefObject<HTMLElement | null>,
  enabled: boolean
): { style: CSSProperties; spacerHeight: number } {
  const [style, setStyle] = useState<CSSProperties>({ visibility: "hidden", opacity: 0 });
  const [spacerHeight, setSpacerHeight] = useState(0);

  useEffect(() => {
    if (!enabled) return;

    const update = () => {
      const article = articleRef.current;
      const bar = barRef.current;
      if (!bar) return;

      const barHeight = bar.offsetHeight;
      const isMobile = window.innerWidth < DESKTOP_MIN_WIDTH;
      setSpacerHeight(isMobile ? barHeight + 8 : 0);

      if (!article || !isMobile) {
        setStyle({ visibility: "hidden", opacity: 0 });
        return;
      }

      const articleRect = article.getBoundingClientRect();
      const contentTop = articleRect.top;
      const top = Math.max(MOBILE_NAV_MIN_TOP_PX, contentTop);
      const footerTop = readFooterTop();
      const opacity = footerFadeOpacity(footerTop, top, barHeight);
      const hidden = opacity <= 0.02;

      setStyle({
        position: "fixed",
        top: `${top}px`,
        left: `${articleRect.left}px`,
        width: `${articleRect.width}px`,
        visibility: hidden ? "hidden" : "visible",
        opacity,
        transform: hidden ? "translateY(8px)" : "translateY(0)",
        pointerEvents: hidden ? "none" : "auto",
        zIndex: 30,
        transition: "opacity 0.28s ease, transform 0.28s ease, top 0.15s ease"
      });
    };

    update();
    const ro = new ResizeObserver(update);
    if (articleRef.current) ro.observe(articleRef.current);
    if (barRef.current) ro.observe(barRef.current);
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);

    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [enabled, articleRef, barRef]);

  return { style, spacerHeight };
}
