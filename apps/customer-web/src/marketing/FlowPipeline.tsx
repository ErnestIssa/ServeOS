import { SERVEOS_FLOW } from "./constants";

type Props = {
  variant?: "horizontal" | "vertical";
  className?: string;
};

export function FlowPipeline({ variant = "horizontal", className = "" }: Props) {
  if (variant === "vertical") {
    return (
      <ol className={`mx-auto max-w-md space-y-0 ${className}`}>
        {SERVEOS_FLOW.map((step, i) => (
          <li key={step} className="relative flex gap-4 pb-8 last:pb-0">
            {i < SERVEOS_FLOW.length - 1 ? (
              <span
                className="absolute left-[15px] top-9 h-[calc(100%-12px)] w-0.5 bg-gradient-to-b from-violet-300/80 to-blue-300/40"
                aria-hidden
              />
            ) : null}
            <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-violet-200/80 bg-gradient-to-br from-violet-600 to-blue-600 text-[10px] font-bold text-white">
              {i + 1}
            </span>
            <p className="pt-0.5 text-sm font-bold text-slate-900">{step}</p>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <ol
      className={`grid w-full grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 ${className}`}
    >
      {SERVEOS_FLOW.map((step, i) => (
        <li key={step} className="flex flex-col items-center text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/60 bg-white/70 text-[10px] font-extrabold text-violet-800 shadow-[0_2px_12px_rgba(15,23,42,0.06)] backdrop-blur-sm">
            {step.slice(0, 2).toUpperCase()}
          </div>
          <span className="mt-3 text-[11px] font-bold leading-snug text-slate-700 sm:text-xs">{step}</span>
          {i < SERVEOS_FLOW.length - 1 ? (
            <span className="sr-only">then</span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
