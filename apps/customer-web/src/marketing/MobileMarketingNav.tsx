import { useState } from "react";
import { NAV_MEGA_MENUS } from "./navContent";
import { runNavAction, type NavHandlers } from "./navActions";
import { bookDemo, startFreeTrial } from "./ui";

type Props = {
  open: boolean;
  onClose: () => void;
  handlers: NavHandlers;
  onOpenSearch: () => void;
  onGoLogin?: () => void;
};

export function MobileMarketingNav({ open, onClose, handlers, onOpenSearch, onGoLogin }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] lg:hidden" role="presentation">
      <button type="button" className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" aria-label="Close menu" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 flex w-[min(100%,320px)] flex-col border-l border-white/40 bg-white/95 shadow-2xl backdrop-blur-2xl">
        <div className="flex items-center justify-between border-b border-slate-200/80 px-5 py-4">
          <span className="font-display text-lg font-extrabold text-slate-900">Menu</span>
          <button type="button" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Mobile">
          <button
            type="button"
            className="mb-3 flex w-full items-center gap-2 rounded-xl border border-slate-200/80 px-4 py-3 text-sm font-semibold text-slate-700"
            onClick={() => {
              onOpenSearch();
              onClose();
            }}
          >
            Search…
          </button>
          {NAV_MEGA_MENUS.map((menu) => (
            <div key={menu.id} className="mb-1">
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-bold text-slate-900"
                onClick={() => setExpanded(expanded === menu.id ? null : menu.id)}
              >
                {menu.label}
                <span className="text-slate-400">{expanded === menu.id ? "−" : "+"}</span>
              </button>
              {expanded === menu.id ? (
                <ul className="mb-2 space-y-0.5 pl-3">
                  {menu.columns.flatMap((c) => c.items).map((item) => (
                    <li key={item.label}>
                      <button
                        type="button"
                        className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-600 hover:bg-violet-50"
                        onClick={() => {
                          runNavAction(item.action, handlers);
                          onClose();
                        }}
                      >
                        {item.label}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
          <button
            type="button"
            className="mt-2 w-full rounded-lg px-3 py-2.5 text-left text-sm font-bold text-slate-900"
            onClick={() => {
              runNavAction({ type: "pricing" }, handlers);
              onClose();
            }}
          >
            Pricing
          </button>
          <button
            type="button"
            className="mt-1 w-full rounded-lg px-3 py-2.5 text-left text-sm font-bold text-slate-900"
            onClick={() => {
              onClose();
              if (onGoLogin) {
                onGoLogin();
                return;
              }
              if (window.location.pathname !== "/login") {
                window.history.pushState({ view: "login" }, "", "/login");
                window.dispatchEvent(new PopStateEvent("popstate"));
              }
            }}
          >
            Login
          </button>
        </nav>
        <div className="flex flex-col gap-2 border-t border-slate-200/80 p-4">
          <button type="button" className="rounded-full border border-slate-200 py-2.5 text-sm font-bold" onClick={bookDemo}>
            Book demo
          </button>
          <button
            type="button"
            className="rounded-full bg-gradient-to-r from-violet-600 to-blue-600 py-2.5 text-sm font-bold text-white"
            onClick={startFreeTrial}
          >
            Start free trial
          </button>
        </div>
      </div>
    </div>
  );
}
