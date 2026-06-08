import {
  CONNECTED_MODULES,
  FAQ_ITEMS,
  INDUSTRIES,
  PRODUCT_SURFACES,
  TESTIMONIALS
} from "./marketing/constants";
import { EcosystemStack } from "./marketing/EcosystemStack";
import { FlowPipeline } from "./marketing/FlowPipeline";
import { Reveal } from "./marketing/motion";
import { SetupFinderSection } from "./marketing/SetupFinderSection";
import { SiteFooter } from "./marketing/SiteFooter";
import { MobileCtaBar, SiteNav } from "./marketing/SiteNav";
import {
  bodyMuted,
  contentWrap,
  darkGlassPanel,
  glassPanel,
  glassPanelLg,
  contentWrapNarrow,
  marketingRoot,
  pageGutter,
  pageSection
} from "./marketing/styles";
import {
  bookDemo,
  BtnPrimary,
  BtnSecondary,
  OsCard,
  scrollToId,
  SectionEyebrow,
  SectionTitle,
  startFreeTrial
} from "./marketing/ui";

type Props = {
  onHowItWorks: () => void;
  onFindSetup: () => void;
};

export function LandingPage({ onHowItWorks, onFindSetup }: Props) {
  const onHome = () => scrollToId("top");

  return (
    <div className={`${marketingRoot} pb-28 md:pb-0`}>
      <SiteNav
        heroMode
        onHome={onHome}
        onHowItWorks={onHowItWorks}
        onGoPricing={() => scrollToId("pricing")}
      />
      <MobileCtaBar />

      <section
        id="top"
        className="relative scroll-mt-16 overflow-hidden pb-28 pt-28 text-white sm:pb-32 sm:pt-32 lg:pb-36 lg:pt-36"
      >
        <div className="marketing-hero-vignette pointer-events-none absolute inset-0 z-0" aria-hidden />
        <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[58%] overflow-hidden" aria-hidden>
          <div className="absolute -right-[18%] top-0 h-[min(70vw,480px)] w-[min(70vw,480px)] rounded-full bg-violet-600/20 blur-[100px]" />
          <div className="absolute -left-[12%] top-[8%] h-[min(50vw,320px)] w-[min(50vw,320px)] rounded-full bg-blue-600/10 blur-[90px]" />
        </div>

        <div className={`relative z-[1] ${contentWrap} ${pageGutter}`}>
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-violet-200 backdrop-blur-md">
                Restaurant operating system
              </p>
              <h1 className="font-display mt-5 text-4xl font-extrabold leading-[1.06] tracking-tight sm:text-5xl lg:text-[3.25rem]">
                Run your entire restaurant from{" "}
                <span className="bg-gradient-to-r from-violet-300 via-blue-300 to-violet-300 bg-clip-text text-transparent">
                  one system
                </span>
              </h1>
              <p className="mt-6 text-lg leading-relaxed text-slate-300">
                Orders, reservations, staff, payments, kitchen displays, checkouts, and customer experiences — all
                connected in real time.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <BtnPrimary onClick={startFreeTrial}>Start free trial</BtnPrimary>
                <button
                  type="button"
                  onClick={bookDemo}
                  className="rounded-full border border-white/25 bg-white/10 px-6 py-3 text-sm font-bold text-white backdrop-blur-md transition hover:bg-white/15"
                >
                  Book demo
                </button>
              </div>
              <p className="mt-6 text-sm text-slate-400">
                Built for owners, managers, and operators — from independents to multi-location groups.
              </p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_8px_40px_rgba(0,0,0,0.25)] backdrop-blur-xl lg:p-8">
              <EcosystemStack heroDark />
            </div>
          </div>
        </div>
      </section>

      <section id="features" className={pageSection}>
        <div className={`${contentWrap} ${pageGutter}`}>
          <Reveal>
            <SectionEyebrow>Everything connected</SectionEyebrow>
            <SectionTitle>One OS. Six operational modules.</SectionTitle>
            <p className={`mt-4 max-w-2xl lg:max-w-3xl ${bodyMuted}`}>
              Operating-system style modules — not marketing fluff. Each layer shares the same live data.
            </p>
          </Reveal>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CONNECTED_MODULES.map((m) => (
              <OsCard key={m.id} title={m.title} icon={m.icon}>
                {m.body}
              </OsCard>
            ))}
          </div>
        </div>
      </section>

      <section className={pageSection}>
        <div className={`${contentWrap} ${pageGutter}`}>
          <Reveal>
            <SectionEyebrow>The ServeOS flow</SectionEyebrow>
            <SectionTitle>One journey from guest to insight</SectionTitle>
            <p className={`mt-4 max-w-2xl ${bodyMuted}`}>
              This timeline sells the product better than paragraphs — every step feeds the next.
            </p>
          </Reveal>
          <Reveal className={`mt-10 ${glassPanelLg} p-6 sm:p-10`}>
            <FlowPipeline />
          </Reveal>
          <p className="mt-6 text-center">
            <button
              type="button"
              onClick={onHowItWorks}
              className="text-sm font-bold text-violet-700 underline-offset-4 transition hover:text-violet-900 hover:underline"
            >
              See the full workflow →
            </button>
          </p>
        </div>
      </section>

      <section className={pageSection}>
        <div className={`${contentWrap} ${pageGutter}`}>
          <Reveal>
            <SectionEyebrow>Why restaurants switch</SectionEyebrow>
            <SectionTitle>Stop paying for five disconnected systems</SectionTitle>
          </Reveal>
          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            <article className={`${glassPanel} p-6`}>
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Traditional setup</h3>
              <ul className="mt-4 space-y-2 text-sm text-slate-700">
                {["POS vendor", "Reservation vendor", "KDS vendor", "Staff app", "Loyalty app"].map((x) => (
                  <li key={x} className="flex gap-2">
                    <span className="text-slate-400">—</span>
                    {x}
                  </li>
                ))}
              </ul>
              <p className="mt-6 font-display text-2xl font-black text-slate-300">5 systems</p>
            </article>
            <article className="rounded-2xl border border-violet-300/40 bg-gradient-to-br from-violet-600 to-blue-600 p-6 text-white shadow-[0_4px_24px_rgba(124,58,237,0.22)]">
              <h3 className="text-sm font-bold uppercase tracking-wide text-violet-200">ServeOS</h3>
              <ul className="mt-4 space-y-3 text-sm font-semibold">
                <li>One login</li>
                <li>One platform</li>
                <li>One data source</li>
              </ul>
            </article>
            <article className={`${glassPanel} p-6`}>
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Result</h3>
              <ul className="mt-4 space-y-3 text-sm font-semibold text-slate-800">
                <li>Faster service</li>
                <li>Lower total cost of tools</li>
                <li>Better guest experience</li>
              </ul>
            </article>
          </div>
        </div>
      </section>

      <section className={pageSection}>
        <div className={`${contentWrap} ${pageGutter}`}>
          <Reveal>
            <SectionEyebrow>Product ecosystem</SectionEyebrow>
            <SectionTitle>Bigger than reservations or POS alone</SectionTitle>
          </Reveal>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PRODUCT_SURFACES.map((p, i) => (
              <OsCard key={p.title} title={p.title} icon={["📱", "🖥", "▣", "◎", "⬡"][i]}>
                {p.body}
              </OsCard>
            ))}
          </div>
        </div>
      </section>

      <section id="solutions" className={pageSection}>
        <div className={`${contentWrap} ${pageGutter}`}>
          <Reveal>
            <SectionEyebrow>Solutions</SectionEyebrow>
            <SectionTitle>Adapts to how you operate</SectionTitle>
          </Reveal>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {INDUSTRIES.map((ind) => (
              <OsCard key={ind.title} title={ind.title}>
                {ind.body}
              </OsCard>
            ))}
          </div>
        </div>
      </section>

      <SetupFinderSection onFindSetup={onFindSetup} />

      <section className={pageSection}>
        <div className={`${contentWrap} ${pageGutter}`}>
          <Reveal>
            <SectionEyebrow>Early partners</SectionEyebrow>
            <SectionTitle>What operators are saying</SectionTitle>
          </Reveal>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {TESTIMONIALS.map((t) => (
              <blockquote key={t.name} className={`${glassPanel} p-6`}>
                <p className="text-sm italic leading-relaxed text-slate-700">&ldquo;{t.quote}&rdquo;</p>
                <footer className="mt-4 text-xs font-bold text-slate-500">
                  {t.name} · {t.role}
                </footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className={pageSection}>
        <div className={`${contentWrap} ${pageGutter}`}>
          <div className={contentWrapNarrow}>
          <Reveal>
            <SectionEyebrow>Resources</SectionEyebrow>
            <SectionTitle>Frequently asked questions</SectionTitle>
          </Reveal>
          <div className={`mt-8 ${glassPanel} p-0`}>
            {FAQ_ITEMS.map((item) => (
              <details key={item.q} className="group border-b border-white/40 px-5 py-4 last:border-b-0">
                <summary className="cursor-pointer list-none text-sm font-bold text-slate-900 marker:content-none">
                  <span className="flex items-center justify-between gap-4">
                    {item.q}
                    <span className="text-violet-500 transition-transform group-open:rotate-45">+</span>
                  </span>
                </summary>
                <p className={`mt-3 text-sm leading-relaxed ${bodyMuted}`}>{item.a}</p>
              </details>
            ))}
          </div>
          </div>
        </div>
      </section>

      <section id="final-cta" className={`${pageSection} pb-8`}>
        <div className={`${contentWrap} ${pageGutter}`}>
          <Reveal>
            <div className={`px-8 py-14 text-center sm:px-12 ${darkGlassPanel}`}>
              <h2 className="font-display text-3xl font-extrabold sm:text-4xl">
                Ready to simplify your restaurant operations?
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-slate-300">
                Join operators who run service, kitchen, and guest experience on one connected platform.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <BtnPrimary onClick={startFreeTrial}>Start free trial</BtnPrimary>
                <BtnSecondary onClick={bookDemo}>Book demo</BtnSecondary>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <SiteFooter onHowItWorks={onHowItWorks} />
    </div>
  );
}
