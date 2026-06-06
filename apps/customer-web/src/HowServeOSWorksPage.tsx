import { HOW_IT_WORKS_FLOW, TAGLINE } from "./marketing/constants";
import { FlowPipeline } from "./marketing/FlowPipeline";
import { Reveal } from "./marketing/motion";
import { SiteFooter } from "./marketing/SiteFooter";
import { SiteNav } from "./marketing/SiteNav";
import {
  bodyMuted,
  contentWrap,
  contentWrapNarrow,
  darkGlassPanel,
  glassPanel,
  glassPanelLg,
  marketingRoot,
  pageGutter,
  pageSection
} from "./marketing/styles";
import { bookDemo, BtnPrimary, BtnSecondary, SectionEyebrow, SectionTitle, startFreeTrial } from "./marketing/ui";

type Props = {
  onHome: () => void;
  onGoFeatures: () => void;
  onGoPricing: () => void;
};

export function HowServeOSWorksPage({ onHome, onGoFeatures, onGoPricing }: Props) {
  return (
    <div className={`${marketingRoot} pb-24 md:pb-0`}>
      <SiteNav
        onHome={onHome}
        onHowItWorks={onHome}
        onGoPricing={onGoPricing}
      />

      <section className={`${pageSection} pb-12 pt-24 sm:pt-28`}>
        <div className={`${contentWrap} ${pageGutter}`}>
          <p className="inline-flex rounded-full border border-violet-200/50 bg-white/50 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-violet-800 backdrop-blur-md">
            How ServeOS works
          </p>
          <h1 className="font-display mt-5 max-w-3xl text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:max-w-5xl">
            From guest intent to owner insight —{" "}
            <span className="bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent">
              one continuous flow
            </span>
          </h1>
          <p className={`mt-6 max-w-2xl text-lg ${bodyMuted}`}>{TAGLINE}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <BtnPrimary onClick={startFreeTrial}>Start free trial</BtnPrimary>
            <BtnSecondary onClick={bookDemo}>Book demo</BtnSecondary>
          </div>
        </div>
      </section>

      <section className={pageSection}>
        <div className={`${contentWrap} ${pageGutter}`}>
          <Reveal>
            <SectionTitle>End-to-end journey</SectionTitle>
            <p className={`mt-4 max-w-2xl ${bodyMuted}`}>
              Restaurant owners buy when they see the workflow — not a feature grid. This is how ServeOS connects
              every touchpoint.
            </p>
          </Reveal>
          <Reveal className={`mt-12 ${glassPanelLg} p-6 sm:p-10`}>
            <FlowPipeline />
          </Reveal>
        </div>
      </section>

      <section className={pageSection}>
        <div className={`${contentWrap} ${pageGutter}`}>
          <Reveal>
            <SectionEyebrow>Layer by layer</SectionEyebrow>
            <SectionTitle>What happens at each step</SectionTitle>
          </Reveal>
          <ol className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {HOW_IT_WORKS_FLOW.map((item, i) => (
              <li key={item.step} className={`${glassPanel} p-6`}>
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-blue-600 text-xs font-bold text-white">
                  {i + 1}
                </span>
                <h3 className="mt-3 text-lg font-bold text-slate-900">{item.step}</h3>
                <p className={`mt-2 text-sm leading-relaxed ${bodyMuted}`}>{item.detail}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className={`${pageSection} pb-16`}>
        <div className={`${contentWrap} ${pageGutter}`}>
          <Reveal>
            <div className={`${contentWrapNarrow} px-8 py-14 text-center ${darkGlassPanel}`}>
              <h2 className="font-display text-3xl font-extrabold">See it on your floor</h2>
              <p className="mt-4 text-slate-300">
                Book a walkthrough with our team or start a trial — we&apos;ll help you map your first venue in under a
                day.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <BtnPrimary onClick={startFreeTrial}>Start free trial</BtnPrimary>
                <BtnSecondary onClick={bookDemo}>Book demo</BtnSecondary>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <SiteFooter onHowItWorks={onHome} />
    </div>
  );
}
