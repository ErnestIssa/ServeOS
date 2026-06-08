import { ECOSYSTEM_STACK } from "./constants";

type Props = { heroDark?: boolean };

/** Vertical connected stack — static, no pulsing indicators. */
export function EcosystemStack({ heroDark = false }: Props) {
  return (
    <div className="relative mx-auto w-full max-w-[280px] lg:max-w-none">
      <div
        className={`absolute left-1/2 top-6 bottom-6 w-px -translate-x-1/2 bg-gradient-to-b ${
          heroDark ? "from-violet-400/50 via-blue-400/30 to-teal-400/25" : "from-violet-300/70 via-blue-300/50 to-teal-300/40"
        }`}
        aria-hidden
      />

      <ul className="relative space-y-3">
        {ECOSYSTEM_STACK.map((label, i) => (
          <li key={label}>
            <div
              className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3.5 backdrop-blur-md ${
                i === 0
                  ? "border-violet-300/50 bg-gradient-to-r from-violet-600 to-blue-600 text-white shadow-[0_4px_20px_rgba(124,58,237,0.2)]"
                  : "border-white/60 bg-white/70 text-slate-900 shadow-[0_2px_12px_rgba(15,23,42,0.05)]"
              }`}
            >
              <span className="text-sm font-semibold">{label}</span>
              {i < ECOSYSTEM_STACK.length - 1 ? (
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider ${
                    i === 0 ? "text-violet-200" : heroDark ? "text-violet-300/70" : "text-violet-400/80"
                  }`}
                >
                  ↕
                </span>
              ) : (
                <span
                  className="h-2 w-2 rounded-full bg-emerald-400/90"
                  title="Live sync"
                  aria-hidden
                />
              )}
            </div>
          </li>
        ))}
      </ul>
      <p
        className={`mt-5 text-center text-[11px] font-bold uppercase tracking-[0.2em] ${
          heroDark ? "text-violet-300/60" : "text-violet-600/70"
        }`}
      >
        Connected in real time
      </p>
    </div>
  );
}
