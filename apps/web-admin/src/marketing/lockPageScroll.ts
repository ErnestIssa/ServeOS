/** Prevent background scroll while search (or overlays) are open. */
export function lockPageScroll(): () => void {
  const scrollY = window.scrollY;
  const { style } = document.body;
  const prevOverflow = style.overflow;
  const prevPosition = style.position;
  const prevTop = style.top;
  const prevWidth = style.width;

  document.documentElement.style.overflow = "hidden";
  style.overflow = "hidden";
  style.position = "fixed";
  style.top = `-${scrollY}px`;
  style.width = "100%";

  return () => {
    document.documentElement.style.overflow = "";
    style.overflow = prevOverflow;
    style.position = prevPosition;
    style.top = prevTop;
    style.width = prevWidth;
    window.scrollTo(0, scrollY);
  };
}
