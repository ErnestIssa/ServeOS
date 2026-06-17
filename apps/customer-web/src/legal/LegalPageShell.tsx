import { useEffect, useMemo } from "react";
import { SiteFooter } from "../marketing/SiteFooter";
import { MobileCtaBar, SiteNav } from "../marketing/SiteNav";
import { contentWrap, marketingRoot, pageGutter, pageSection } from "../marketing/styles";
import { LegalTableOfContentsLayout } from "./LegalTableOfContents";
import { LegalBlockRenderer } from "./LegalBlockRenderer";
import { LEGAL_CENTER_CARDS } from "./legalPages";
import type { LegalPageDef, LegalSlug } from "./types";

type Props = {
  page: LegalPageDef;
  onHome: () => void;
  onHowItWorks: () => void;
  onGoPricing: () => void;
  onGoLogin: () => void;
  onGoLegal: (slug: LegalSlug) => void;
};

function LegalCenterHub({ onGoLegal }: { onGoLegal: (slug: LegalSlug) => void }) {
  return (
    <div className="legal-hub-grid">
      {LEGAL_CENTER_CARDS.map((group) => (
        <div key={group.group} className="legal-hub-group">
          <h3 className="legal-hub-group-title">{group.group}</h3>
          <ul className="legal-hub-list">
            {group.items.map((item) => (
              <li key={item.slug}>
                <button type="button" className="legal-hub-card" onClick={() => onGoLegal(item.slug)}>
                  <span className="legal-hub-card-label">{item.label}</span>
                  <span className="legal-hub-card-desc">{item.description}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function LegalPageShell({
  page,
  onHome,
  onHowItWorks,
  onGoPricing,
  onGoLogin,
  onGoLegal
}: Props) {
  const isHub = page.slug === "center";
  const toc = useMemo(
    () => (isHub ? [] : page.sections.map((s) => ({ id: s.id, title: s.title }))),
    [isHub, page.sections]
  );

  useEffect(() => {
    const prev = document.title;
    document.title = `${page.title} · ServeOS`;
    return () => {
      document.title = prev;
    };
  }, [page.title]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [page.slug]);

  return (
    <div className={`${marketingRoot} legal-page pb-28 md:pb-0`}>
      <SiteNav
        heroMode
        onHome={onHome}
        onHowItWorks={onHowItWorks}
        onGoPricing={onGoPricing}
        onGoLogin={onGoLogin}
        onGoLegal={onGoLegal}
      />
      <MobileCtaBar />

      <section className="relative scroll-mt-16 overflow-hidden pb-16 pt-28 text-white sm:pb-20 sm:pt-32 lg:pb-24">
        <div className="marketing-hero-vignette pointer-events-none absolute inset-0 z-0" aria-hidden />
        <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[58%] overflow-hidden" aria-hidden>
          <div className="absolute -right-[18%] top-0 h-[min(70vw,480px)] w-[min(70vw,480px)] rounded-full bg-violet-600/20 blur-[100px]" />
          <div className="absolute -left-[12%] top-[8%] h-[min(50vw,320px)] w-[min(50vw,320px)] rounded-full bg-blue-600/10 blur-[90px]" />
        </div>

        <div className={`relative z-[1] ${contentWrap} ${pageGutter}`}>
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-violet-200 backdrop-blur-md">
            {page.eyebrow}
          </p>
          <h1 className="font-display legal-title mt-5 max-w-4xl text-4xl font-extrabold leading-[1.06] tracking-tight text-white sm:text-5xl">
            {page.title}
          </h1>
          <p className="legal-summary mt-6 max-w-2xl text-lg leading-relaxed text-slate-300">
            {page.summary}
          </p>
          <p className="legal-updated mt-6 text-sm text-slate-400">Last updated {page.lastUpdated}</p>
        </div>
      </section>

      <section className={`${pageSection} legal-body-section`}>
        <div className={`${contentWrap} ${pageGutter}`}>
          <div className="legal-layout">
            {isHub ? (
              <article className="legal-article legal-article--full">
                <LegalCenterHub onGoLegal={onGoLegal} />
              </article>
            ) : (
              <LegalTableOfContentsLayout
                items={toc}
                pageKey={page.slug}
                article={
                  <>
                    {page.sections.map((section) => (
                      <section key={section.id} id={section.id} className="legal-section">
                        <h2 className="legal-section-title">{section.title}</h2>
                        <LegalBlockRenderer blocks={section.blocks} onGoLegal={onGoLegal} />
                      </section>
                    ))}

                    {page.relatedLinks && page.relatedLinks.length > 0 ? (
                      <footer className="legal-related">
                        <h3 className="legal-related-title">Related documents</h3>
                        <div className="legal-related-links">
                          {page.relatedLinks.map((link) => (
                            <button
                              key={link.slug}
                              type="button"
                              className="legal-related-link"
                              onClick={() => onGoLegal(link.slug)}
                            >
                              {link.label}
                            </button>
                          ))}
                        </div>
                      </footer>
                    ) : null}
                  </>
                }
              />
            )}
          </div>
        </div>
      </section>

      <SiteFooter onHowItWorks={onHowItWorks} onGoLegal={onGoLegal} />
    </div>
  );
}
