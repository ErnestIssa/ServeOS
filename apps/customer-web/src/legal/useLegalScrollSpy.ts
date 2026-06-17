import { useEffect, useState } from "react";

const NAV_OFFSET_PX = 96;

export function useLegalScrollSpy(sectionIds: string[], resetKey: string): string {
  const [activeId, setActiveId] = useState(sectionIds[0] ?? "");

  useEffect(() => {
    if (!sectionIds.length) {
      setActiveId("");
      return;
    }

    setActiveId(sectionIds[0]);

    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));

    if (!elements.length) return;

    const pickActive = () => {
      const marker = window.scrollY + NAV_OFFSET_PX;
      let current = sectionIds[0];
      for (const el of elements) {
        const top = el.getBoundingClientRect().top + window.scrollY;
        if (top <= marker + 4) current = el.id;
      }
      setActiveId(current);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
          return;
        }
        pickActive();
      },
      { root: null, rootMargin: `-${NAV_OFFSET_PX}px 0px -55% 0px`, threshold: [0, 0.12, 0.4] }
    );

    elements.forEach((el) => observer.observe(el));
    pickActive();
    window.addEventListener("scroll", pickActive, { passive: true });
    window.addEventListener("resize", pickActive);

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", pickActive);
      window.removeEventListener("resize", pickActive);
    };
  }, [sectionIds.join("|"), resetKey]);

  return activeId;
}

export function scrollToLegalSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}
