import { useEffect, useRef } from "react";
import { LOGIN_OPTIONS } from "./navContent";
import { scrollToId } from "./ui";

type Props = {
  open: boolean;
  onClose: () => void;
  darkSurface: boolean;
};

export function NavLoginMenu({ open, onClose, darkSurface }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className={`absolute right-0 top-[calc(100%+8px)] z-[60] min-w-[240px] overflow-hidden rounded-xl border py-1.5 shadow-xl ${
        darkSurface
          ? "border-white/10 bg-slate-900/95 backdrop-blur-2xl"
          : "border-white/60 bg-white/95 backdrop-blur-xl"
      }`}
    >
      {LOGIN_OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          className={`flex w-full flex-col px-4 py-3 text-left transition ${
            darkSurface ? "hover:bg-white/8" : "hover:bg-violet-50/90"
          }`}
          onClick={() => {
            onClose();
            if (opt.id === "customer") {
              scrollToId("final-cta");
              return;
            }
            if (opt.href) {
              window.open(opt.href, "_blank", "noopener,noreferrer");
              return;
            }
            scrollToId("final-cta");
          }}
        >
          <span className={`text-sm font-semibold ${darkSurface ? "text-white" : "text-slate-900"}`}>{opt.label}</span>
          <span className={`text-xs ${darkSurface ? "text-slate-400" : "text-slate-500"}`}>{opt.description}</span>
        </button>
      ))}
    </div>
  );
}
