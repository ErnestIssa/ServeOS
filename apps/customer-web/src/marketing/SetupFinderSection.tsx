import { PRODUCT_SCREENSHOT_SRCS } from "./productEcosystemImgs";
import { Reveal } from "./motion";
import { BtnPrimary } from "./ui";
import { pageGutter } from "./styles";

const MARQUEE_TRACK = [...PRODUCT_SCREENSHOT_SRCS, ...PRODUCT_SCREENSHOT_SRCS];

const MARQUEE_ROWS: Array<{ animationClass: string; duration: string; offset: number }> = [
  { animationClass: "setup-marquee-left", duration: "38s", offset: 0 },
  { animationClass: "setup-marquee-right", duration: "44s", offset: 3 },
  { animationClass: "setup-marquee-left", duration: "36s", offset: 6 }
];

function ServeOsWordmark() {
  return (
    <span className="whitespace-nowrap font-display font-extrabold tracking-tight text-white">
      Serve
      <span className="bg-gradient-to-r from-violet-400 via-blue-400 to-violet-300 bg-clip-text text-transparent">
        OS
      </span>
    </span>
  );
}

function SetupImageMarquee() {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-center gap-3 opacity-95 sm:gap-4">
      {MARQUEE_ROWS.map((row) => {
        const rowTiles = [
          ...MARQUEE_TRACK.slice(row.offset),
          ...MARQUEE_TRACK.slice(0, row.offset)
        ];

        return (
          <div key={row.animationClass + row.offset} className="overflow-hidden">
            <div
              className={`flex w-max gap-3 sm:gap-4 ${row.animationClass}`}
              style={{ animationDuration: row.duration }}
            >
              {[...rowTiles, ...rowTiles].map((src, i) => (
                <div
                  key={`${src}-${i}`}
                  className="h-28 w-[5.5rem] shrink-0 overflow-hidden rounded-2xl border border-white/15 shadow-[0_8px_28px_rgba(0,0,0,0.35)] sm:h-36 sm:w-28 lg:h-44 lg:w-32"
                >
                  <img src={src} alt="" className="h-full w-full object-cover object-top" aria-hidden />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

type Props = {
  onFindSetup: () => void;
};

export function SetupFinderSection({ onFindSetup }: Props) {
  return (
    <section id="pricing" className="relative scroll-mt-16 overflow-hidden py-24 sm:py-32 lg:py-44">
      <SetupImageMarquee />

      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-950/55 via-slate-950/78 to-slate-950/92"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(124,58,237,0.22)_0%,transparent_62%)]"
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 backdrop-blur-[1.5px]" aria-hidden />

      <div className={`relative z-10 mx-auto max-w-6xl text-center lg:max-w-none ${pageGutter}`}>
        <Reveal>
          <h2 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.45)] sm:text-5xl md:text-6xl lg:text-7xl xl:text-[5.75rem]">
            How much <ServeOsWordmark /> do you need?
          </h2>
          <div className="mt-10 sm:mt-12">
            <BtnPrimary
              onClick={onFindSetup}
              className="px-10 py-4 text-base font-extrabold shadow-[0_8px_32px_rgba(124,58,237,0.45)] sm:px-12 sm:py-5 sm:text-lg"
            >
              Find My Setup
            </BtnPrimary>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
