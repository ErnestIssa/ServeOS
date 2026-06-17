import { useEffect, useRef, type ReactNode } from "react";
import { useLegalMobileTocPin, useLegalSidebarTocPin } from "./useLegalTocPin";
import { scrollToLegalSection, useLegalScrollSpy } from "./useLegalScrollSpy";

type TocItem = { id: string; title: string };

function TocLinks({
  items,
  activeId,
  variant
}: {
  items: TocItem[];
  activeId: string;
  variant: "sidebar" | "mobile";
}) {
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    if (variant !== "mobile" || !listRef.current) return;
    const active = listRef.current.querySelector(".legal-toc-item.is-active");
    active?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeId, variant]);

  const activeIndex = Math.max(
    0,
    items.findIndex((item) => item.id === activeId)
  );
  const progress =
    items.length > 1 ? ((activeIndex + 1) / items.length) * 100 : items.length ? 100 : 0;

  return (
    <div className={`legal-toc-panel legal-toc-panel--${variant}`}>
      {variant === "sidebar" ? (
        <div className="legal-toc-progress" aria-hidden>
          <div className="legal-toc-progress-track">
            <div className="legal-toc-progress-fill" style={{ height: `${progress}%` }} />
          </div>
        </div>
      ) : null}

      <p className="legal-toc-heading">On this page</p>

      {variant === "mobile" ? (
        <div className="legal-toc-mobile-progress" aria-hidden>
          <div className="legal-toc-mobile-progress-fill" style={{ width: `${progress}%` }} />
        </div>
      ) : null}

      <ol
        ref={variant === "mobile" ? listRef : undefined}
        className={`legal-toc-list${variant === "mobile" ? " legal-toc-list--mobile" : ""}`}
      >
        {items.map((item, index) => {
          const isActive = item.id === activeId;
          const isPassed = index < activeIndex;
          return (
            <li
              key={item.id}
              className={[
                "legal-toc-item",
                isActive ? "is-active" : "",
                isPassed ? "is-passed" : ""
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <a
                href={`#${item.id}`}
                className="legal-toc-link"
                aria-current={isActive ? "location" : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  scrollToLegalSection(item.id);
                }}
              >
                {variant === "sidebar" ? (
                  <span className="legal-toc-marker" aria-hidden>
                    <span className="legal-toc-marker-dot" />
                  </span>
                ) : null}
                <span className="legal-toc-link-label">{item.title}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function LegalTableOfContentsLayout({
  items,
  pageKey,
  article
}: {
  items: TocItem[];
  pageKey: string;
  article: ReactNode;
}) {
  const columnRef = useRef<HTMLElement>(null);
  const sidebarNavRef = useRef<HTMLElement>(null);
  const articleRef = useRef<HTMLElement>(null);
  const mobileBarRef = useRef<HTMLDivElement>(null);

  const activeId = useLegalScrollSpy(
    items.map((item) => item.id),
    pageKey
  );

  const sidebarPinStyle = useLegalSidebarTocPin(
    columnRef,
    sidebarNavRef,
    articleRef,
    items.length > 0
  );
  const { style: mobilePinStyle, spacerHeight } = useLegalMobileTocPin(
    articleRef,
    mobileBarRef,
    items.length > 0
  );

  if (!items.length) return <article className="legal-article">{article}</article>;

  return (
    <>
      <aside ref={columnRef} className="legal-toc-aside" aria-label="On this page">
        <nav ref={sidebarNavRef} className="legal-toc legal-toc--pinned" style={sidebarPinStyle}>
          <TocLinks items={items} activeId={activeId} variant="sidebar" />
        </nav>
      </aside>

      <article ref={articleRef} className="legal-article legal-article--with-toc">
        <div
          ref={mobileBarRef}
          className="legal-toc-mobile legal-toc-mobile--pinned"
          style={mobilePinStyle}
          aria-label="On this page"
        >
          <TocLinks items={items} activeId={activeId} variant="mobile" />
        </div>
        <div
          className="legal-toc-mobile-spacer"
          style={{ height: spacerHeight > 0 ? `${spacerHeight}px` : undefined }}
          aria-hidden
        />
        {article}
      </article>
    </>
  );
}
