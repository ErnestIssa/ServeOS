import { useEffect, useState } from "react";
import { FOOTER_SUPPORT_EMAIL } from "./footerContent";
import {
  SUPPORT_POPUP_FAQS,
  SUPPORT_POPUP_SUBTITLE,
  SUPPORT_POPUP_TITLE
} from "./supportPopupContent";
import { useSupportFabTone } from "./useSupportFabTone";
import { bookDemo, scrollToId, startFreeTrial } from "./ui";

type Props = {
  isVisible: boolean;
  onOpen: () => void;
  onClose: () => void;
  marketingScrollTone?: boolean;
  onHowItWorks?: () => void;
  onViewPricing?: () => void;
  onFindSetup?: () => void;
};

function ChatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.77 9.77 0 01-4-.8L3 20l1.2-3.6C3.51 15.04 3 13.57 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      />
    </svg>
  );
}

export function SupportPopup({
  isVisible,
  onOpen,
  onClose,
  marketingScrollTone = true,
  onHowItWorks,
  onViewPricing,
  onFindSetup
}: Props) {
  const [openFaqs, setOpenFaqs] = useState<Record<string, boolean>>({});
  const lightFab = useSupportFabTone(marketingScrollTone && !isVisible);

  useEffect(() => {
    if (!isVisible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isVisible, onClose]);

  const toggleFaq = (id: string) => {
    setOpenFaqs((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const fabTone = lightFab
    ? "border-white/20 bg-white text-slate-900 shadow-[0_8px_32px_rgba(0,0,0,0.35)] hover:bg-slate-50"
    : "border-violet-500/30 bg-slate-900 text-white shadow-[0_8px_32px_rgba(124,58,237,0.35)] hover:bg-slate-800";

  return (
    <>
      <button
        type="button"
        data-support-icon
        data-support-fab-tone={lightFab ? "light" : "dark"}
        onClick={onOpen}
        aria-label="Open support"
        aria-expanded={isVisible}
        className={`fixed bottom-24 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full border transition-all duration-300 hover:scale-110 md:bottom-6 md:right-6 ${
          isVisible ? "pointer-events-none scale-0 opacity-0" : "scale-100 opacity-100"
        } ${fabTone}`}
      >
        <ChatIcon className="h-6 w-6" />
      </button>

      <div
        className={`fixed inset-0 z-[9999] flex items-center justify-end transition-opacity duration-500 ${
          isVisible ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        role="presentation"
        aria-hidden={!isVisible}
      >
        <button
          type="button"
          className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
          aria-label="Close support"
          tabIndex={isVisible ? 0 : -1}
          onClick={onClose}
        />

        <div
          role="dialog"
          aria-modal="true"
          aria-label={SUPPORT_POPUP_TITLE}
          className={`relative flex h-full max-h-[90vh] w-[min(100%,280px)] flex-col rounded-2xl bg-white shadow-[0_24px_80px_rgba(15,23,42,0.25)] transition-transform duration-500 ease-out md:m-4 md:h-auto md:max-h-[90vh] md:w-[500px] ${
            isVisible ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200/80 p-3 md:p-5">
            <div>
              <h2 className="font-display text-sm font-extrabold text-slate-900 md:text-lg">{SUPPORT_POPUP_TITLE}</h2>
              <p className="mt-1 text-xs text-slate-500 md:text-sm">{SUPPORT_POPUP_SUBTITLE}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              aria-label="Close"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto p-3 md:p-5">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-violet-700/80 md:text-sm">Common questions</p>
            <ul className="mt-3 space-y-2">
              {SUPPORT_POPUP_FAQS.map((item) => {
                const open = !!openFaqs[item.id];
                return (
                  <li key={item.id} className="overflow-hidden rounded-xl border border-slate-200/90">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left md:px-3 md:py-3"
                      onClick={() => toggleFaq(item.id)}
                      aria-expanded={open}
                    >
                      <span className="text-xs font-semibold text-slate-900 md:text-sm">{item.q}</span>
                      <span
                        className={`shrink-0 text-violet-600 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                        aria-hidden
                      >
                        ▾
                      </span>
                    </button>
                    {open ? (
                      <p className="border-t border-slate-100 px-3 pb-3 pt-2 text-xs leading-relaxed text-slate-600 md:text-sm">
                        {item.a}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>

            <div className="mt-6 space-y-2">
              <button
                type="button"
                className="w-full rounded-full bg-slate-900 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 md:py-3"
                onClick={() => {
                  window.location.href = `mailto:${FOOTER_SUPPORT_EMAIL}?subject=ServeOS%20support`;
                  onClose();
                }}
              >
                Contact support
              </button>
              <button
                type="button"
                className="w-full rounded-full border border-slate-200 py-2.5 text-sm font-bold text-slate-800 transition hover:border-violet-200 hover:bg-violet-50 md:py-3"
                onClick={() => {
                  bookDemo();
                  onClose();
                }}
              >
                Book a demo
              </button>
              {onHowItWorks ? (
                <button
                  type="button"
                  className="w-full rounded-full border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 md:py-2.5"
                  onClick={() => {
                    onHowItWorks();
                    onClose();
                  }}
                >
                  How ServeOS works
                </button>
              ) : null}
            </div>

            <div className="mt-6 rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 md:p-4">
              <p className="text-xs font-bold text-slate-800 md:text-sm">Sales & onboarding</p>
              <p className="mt-1 text-xs text-slate-500 md:text-sm">
                Monday–Friday 09:00–17:00 · {FOOTER_SUPPORT_EMAIL}
              </p>
              <button
                type="button"
                className="mt-3 w-full rounded-full bg-gradient-to-r from-violet-600 to-blue-600 py-2 text-xs font-bold text-white transition hover:from-violet-500 hover:to-blue-500 md:py-2.5 md:text-sm"
                onClick={() => {
                  startFreeTrial();
                  onClose();
                }}
              >
                Start free trial
              </button>
              <button
                type="button"
                className="mt-2 w-full text-xs font-semibold text-violet-700 hover:text-violet-900 md:text-sm"
                onClick={() => {
                  (onViewPricing ?? (() => scrollToId("pricing")))();
                  onClose();
                }}
              >
                View pricing →
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
