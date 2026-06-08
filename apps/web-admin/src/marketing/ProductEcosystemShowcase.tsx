import { useMemo } from "react";
import {
  CHECKOUT_SCREENSHOT,
  pickRandomScreenshots
} from "./productEcosystemImgs";
import {
  INTEGRATION_PARTNERS,
  MOBILE_NESTED_CARDS,
  PRODUCT_ECOSYSTEM_CARDS,
  type ProductSurfaceCard
} from "./productEcosystemSurfaces";

const VARIANT_STYLES: Record<
  ProductSurfaceCard["variant"],
  { shell: string; title: string; body: string; tag: string }
> = {
  "hero-dark": {
    shell:
      "rounded-[1.5rem] border border-white/10 bg-slate-950/65 shadow-[0_10px_40px_rgba(0,0,0,0.32)] backdrop-blur-xl text-white",
    title: "font-display text-2xl font-extrabold tracking-tight text-white sm:text-3xl",
    body: "mt-3 text-sm leading-relaxed text-slate-300 sm:text-base",
    tag: "border-white/15 bg-white/10 text-violet-200"
  },
  "glass-light": {
    shell:
      "rounded-[1.25rem] border border-blue-200/55 bg-white/80 shadow-[0_9px_30px_rgba(59,130,246,0.12)] backdrop-blur-xl text-slate-900",
    title: "font-display text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl",
    body: "mt-2 text-xs leading-relaxed text-slate-600 sm:text-sm",
    tag: "border-blue-200/70 bg-blue-50/80 text-blue-800"
  },
  kds: {
    shell:
      "rounded-[1.25rem] border border-emerald-200/55 bg-gradient-to-br from-emerald-50/95 via-white/85 to-teal-50/80 shadow-[0_9px_28px_rgba(16,185,129,0.14)] text-slate-900",
    title: "font-display text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl",
    body: "mt-2 text-xs leading-relaxed text-slate-600 sm:text-sm",
    tag: "border-emerald-200/80 bg-emerald-50 text-emerald-800"
  },
  checkout: {
    shell:
      "rounded-[1.25rem] border border-violet-300/45 bg-gradient-to-br from-violet-600 to-blue-700 shadow-[0_10px_34px_rgba(124,58,237,0.3)] text-white",
    title: "font-display text-xl font-extrabold tracking-tight text-white sm:text-2xl",
    body: "mt-2 text-xs leading-relaxed text-violet-100 sm:text-sm",
    tag: "border-white/20 bg-white/10 text-violet-100"
  },
  integrations: {
    shell:
      "rounded-[1.5rem] border border-slate-700/80 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 shadow-[0_12px_36px_rgba(15,23,42,0.45)] text-white",
    title: "font-display text-2xl font-extrabold tracking-tight text-white sm:text-3xl",
    body: "mt-2 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base",
    tag: "border-white/15 bg-white/5 text-slate-200"
  }
};

const COMPACT_VARIANT_STYLES: Record<
  "kds" | "checkout",
  { shell: string; title: string; body: string; tag: string }
> = {
  kds: {
    shell:
      "rounded-xl border border-emerald-200/55 bg-gradient-to-br from-emerald-50/95 via-white/90 to-teal-50/80 shadow-[0_4px_16px_rgba(16,185,129,0.12)] text-slate-900",
    title: "font-display text-sm font-extrabold tracking-tight text-slate-900 sm:text-base",
    body: "mt-1 text-[10px] leading-snug text-slate-600 sm:text-[11px]",
    tag: "border-emerald-200/80 bg-emerald-50 text-emerald-800"
  },
  checkout: {
    shell:
      "rounded-xl border border-violet-300/45 bg-gradient-to-br from-violet-600 to-blue-700 shadow-[0_4px_16px_rgba(124,58,237,0.22)] text-white",
    title: "font-display text-sm font-extrabold tracking-tight text-white sm:text-base",
    body: "mt-1 text-[10px] leading-snug text-violet-100 sm:text-[11px]",
    tag: "border-white/20 bg-white/10 text-violet-100"
  }
};

const COMPACT_INTEGRATIONS_STYLES = {
  shell:
    "rounded-[1.25rem] border border-slate-700/80 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 shadow-[0_8px_28px_rgba(15,23,42,0.4)] text-white",
  title: "font-display text-lg font-extrabold tracking-tight text-white sm:text-xl",
  body: "mt-1.5 text-xs leading-snug text-slate-300 sm:text-sm",
  tag: "border-white/15 bg-white/5 text-slate-200"
};

function RoundedScreenshot({
  src,
  alt,
  maxHeightClass
}: {
  src: string;
  alt: string;
  maxHeightClass: string;
}) {
  return (
    <div className="flex w-full items-center justify-center">
      <div className={`inline-flex max-w-full overflow-hidden rounded-2xl shadow-[0_6px_20px_rgba(15,23,42,0.14)] ${maxHeightClass}`}>
        <img src={src} alt={alt} className={`block w-full object-contain ${maxHeightClass}`} />
      </div>
    </div>
  );
}

function FullScreenshot({
  src,
  alt,
  compact = false
}: {
  src: string;
  alt: string;
  compact?: boolean;
}) {
  return (
    <RoundedScreenshot
      src={src}
      alt={alt}
      maxHeightClass={
        compact ? "max-h-[min(22vh,9.5rem)]" : "max-h-[min(52.5vh,24rem)]"
      }
    />
  );
}

function MobileScreenshotStrip({ sources }: { sources: string[] }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {sources.map((src, i) => (
        <RoundedScreenshot
          key={src}
          src={src}
          alt={`ServeOS mobile screenshot ${i + 1}`}
          maxHeightClass="max-h-[min(48.75vh,21rem)]"
        />
      ))}
    </div>
  );
}

function IntegrationHub({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`relative flex flex-1 items-center justify-center ${
        compact
          ? "mt-3 min-h-[8rem] lg:mt-0 lg:min-h-[9rem] lg:max-w-[11rem]"
          : "mt-4 min-h-[10.5rem] lg:mt-0 lg:min-h-[12rem] lg:max-w-[16.5rem]"
      }`}
    >
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 320 240" aria-hidden>
        {INTEGRATION_PARTNERS.map((node, i) => {
          if (i === 0) return null;
          const angle = ((i - 1) / (INTEGRATION_PARTNERS.length - 1)) * Math.PI * 2 - Math.PI / 2;
          const x = 160 + Math.cos(angle) * 108;
          const y = 120 + Math.sin(angle) * 82;
          return (
            <line
              key={node.id}
              x1={160}
              y1={120}
              x2={x}
              y2={y}
              stroke="rgba(167,139,250,0.35)"
              strokeWidth="1.5"
              strokeDasharray="4 6"
            />
          );
        })}
      </svg>
      <div
        className={`absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl border border-violet-400/35 bg-gradient-to-br from-violet-600 to-blue-600 shadow-[0_0_24px_rgba(124,58,237,0.35)] ${
          compact ? "h-9 w-9" : "h-12 w-12"
        }`}
      >
        <span className={`font-display font-black text-white ${compact ? "text-[8px]" : "text-[10px]"}`}>
          ServeOS
        </span>
      </div>
      {INTEGRATION_PARTNERS.map((node, i) => {
        const angle = (i / INTEGRATION_PARTNERS.length) * Math.PI * 2 - Math.PI / 2;
        const left = 50 + Math.cos(angle) * 42;
        const top = 50 + Math.sin(angle) * 38;
        return (
          <div
            key={node.id}
            className="group/logo absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5 transition duration-300 hover:scale-110"
            style={{ left: `${left}%`, top: `${top}%` }}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/10 shadow-lg backdrop-blur-sm transition group-hover/logo:border-violet-300/40 group-hover/logo:bg-white/15">
              {node.text ? (
                <span className="font-display text-xs font-black text-violet-200">{node.text}</span>
              ) : (
                <img src={node.src} alt="" width={20} height={20} className="h-5 w-5 object-contain" aria-hidden />
              )}
            </div>
            <span className="text-[8px] font-bold uppercase tracking-wide text-slate-300">{node.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function CardScreenshots({
  card,
  mobileSources,
  adminSource,
  kdsSource
}: {
  card: ProductSurfaceCard;
  mobileSources: string[];
  adminSource: string;
  kdsSource: string;
}) {
  const compact = card.size === "compact";

  switch (card.imageMode) {
    case "triple-random":
      return <MobileScreenshotStrip sources={mobileSources} />;
    case "single-random":
      return (
        <FullScreenshot src={adminSource} alt="ServeOS admin dashboard screenshot" />
      );
    case "checkout-fixed":
      return (
        <FullScreenshot
          src={CHECKOUT_SCREENSHOT}
          alt="ServeOS checkout screen screenshot"
          compact={compact}
        />
      );
    case "kds-random":
      return (
        <FullScreenshot
          src={kdsSource}
          alt="ServeOS kitchen display screenshot"
          compact={compact}
        />
      );
    default:
      return null;
  }
}

function CompactNestedCard({
  card,
  kdsSource
}: {
  card: ProductSurfaceCard;
  kdsSource: string;
}) {
  const styles = COMPACT_VARIANT_STYLES[card.variant as "kds" | "checkout"];

  return (
    <article className={`flex h-full flex-col overflow-hidden p-2.5 sm:p-3 ${styles.shell}`}>
      <CardScreenshots
        card={card}
        mobileSources={[]}
        adminSource=""
        kdsSource={kdsSource}
      />
      <div className="mt-2 flex flex-1 flex-col">
        <div className="flex items-center gap-1">
          <span className="text-sm" aria-hidden>
            {card.symbol}
          </span>
          <h4 className={styles.title}>{card.title}</h4>
        </div>
        <p className={`${styles.body} line-clamp-2`}>{card.body}</p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {card.tags.map((tag) => (
            <span
              key={tag}
              className={`rounded-full border px-1.5 py-px text-[7px] font-bold uppercase tracking-wide ${styles.tag}`}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}

function SurfaceCard({
  card,
  mobileSources,
  adminSource,
  kdsSource
}: {
  card: ProductSurfaceCard;
  mobileSources: string[];
  adminSource: string;
  kdsSource: string;
}) {
  const isCompactIntegrations = card.id === "integrations" && card.size === "compact";
  const styles = isCompactIntegrations
    ? COMPACT_INTEGRATIONS_STYLES
    : VARIANT_STYLES[card.variant];
  const isHero = card.id === "mobile";
  const isIntegrations = card.variant === "integrations";

  const copyBlock = (
    <div className={`relative ${isIntegrations || isHero ? "" : "mt-4"}`}>
      <div className="flex items-center gap-1.5">
        <span className={isCompactIntegrations ? "text-base" : "text-lg"} aria-hidden>
          {card.symbol}
        </span>
        <h3 className={styles.title}>{card.title}</h3>
      </div>
      <p className={styles.body}>{card.body}</p>
      <div className={`flex flex-wrap ${isCompactIntegrations ? "mt-2 gap-1" : "mt-3 gap-1.5"}`}>
        {card.tags.map((tag) => (
          <span
            key={tag}
            className={`rounded-full border font-bold uppercase tracking-wide ${styles.tag} ${
              isCompactIntegrations
                ? "px-2 py-px text-[8px]"
                : "px-2.5 py-0.5 text-[9px]"
            }`}
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );

  return (
    <article
      className={`${card.layoutClass} group relative flex flex-col overflow-hidden transition duration-500 hover:-translate-y-1 ${
        isCompactIntegrations ? "p-3 sm:p-4" : "p-4 sm:p-5 lg:p-6"
      } ${styles.shell} ${isIntegrations ? "lg:flex-row lg:items-center lg:gap-4" : ""}`}
    >
      {isHero ? (
        <div
          className="pointer-events-none absolute -right-14 -top-14 h-40 w-40 rounded-full bg-violet-600/20 blur-3xl"
          aria-hidden
        />
      ) : null}

      {isHero ? (
        <>
          <CardScreenshots
            card={card}
            mobileSources={mobileSources}
            adminSource={adminSource}
            kdsSource={kdsSource}
          />
          <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:items-start">
            {copyBlock}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
              {MOBILE_NESTED_CARDS.map((nestedCard) => (
                <CompactNestedCard key={nestedCard.id} card={nestedCard} kdsSource={kdsSource} />
              ))}
            </div>
          </div>
        </>
      ) : isIntegrations ? (
        <>
          <div className="relative min-w-0 flex-1">{copyBlock}</div>
          <IntegrationHub compact={isCompactIntegrations} />
        </>
      ) : (
        <>
          <CardScreenshots
            card={card}
            mobileSources={mobileSources}
            adminSource={adminSource}
            kdsSource={kdsSource}
          />
          {copyBlock}
        </>
      )}
    </article>
  );
}

export function ProductEcosystemShowcase() {
  const { mobileSources, adminSource, kdsSource } = useMemo(() => {
    const mobile = pickRandomScreenshots(3);
    const admin = pickRandomScreenshots(1)[0];
    const kds = pickRandomScreenshots(1, [CHECKOUT_SCREENSHOT])[0];
    return { mobileSources: mobile, adminSource: admin, kdsSource: kds };
  }, []);

  return (
    <div className="mt-9 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12 lg:grid-rows-[auto_auto] lg:gap-4 lg:pb-2">
      {PRODUCT_ECOSYSTEM_CARDS.map((card) => (
        <SurfaceCard
          key={card.id}
          card={card}
          mobileSources={mobileSources}
          adminSource={adminSource}
          kdsSource={kdsSource}
        />
      ))}
    </div>
  );
}
