import { useCallback, useEffect, useRef, useState } from "react";
import { lockPageScroll } from "./lockPageScroll";
import { MarketingSearchPanel, useMarketingSearchQuery } from "./MarketingSearchPanel";
import { useSearchPanelHeight } from "./useSearchPanelHeight";
import { MobileMarketingNav } from "./MobileMarketingNav";
import { NavLoginMenu } from "./NavLoginMenu";
import { NavMegaMenuPanel } from "./NavMegaMenuPanel";
import { NAV_MEGA_MENUS } from "./navContent";
import type { NavHandlers } from "./navActions";
import { runNavAction } from "./navActions";
import { useNavAutoHide } from "./useNavAutoHide";
import { useNavScrollState } from "./useNavScrollState";
import { bookDemo, startFreeTrial } from "./ui";
import { btnPrimary, btnSecondary, contentWrap, mobileBar, pageGutter } from "./styles";

type Props = {
  onHome: () => void;
  onHowItWorks: () => void;
  onGoPricing?: () => void;
  heroMode?: boolean;
};

const FLOAT_GUTTER = "px-5 sm:px-7 md:px-10 lg:px-10 xl:px-14 2xl:px-16";
const NAV_MOTION = "duration-[650ms] ease-[cubic-bezier(0.22,1,0.36,1)]";
const PANEL_SIZE_TRANSITION =
  "height 650ms cubic-bezier(0.22, 1, 0.36, 1), max-height 650ms cubic-bezier(0.22, 1, 0.36, 1), opacity 650ms cubic-bezier(0.22, 1, 0.36, 1)";

function NavChevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`ml-0.5 h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden
    >
      <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3-3" strokeLinecap="round" />
    </svg>
  );
}

export function SiteNav({ onHome, onHowItWorks, onGoPricing, heroMode = false }: Props) {
  const scrolled = useNavScrollState(heroMode);
  const darkNav = heroMode && !scrolled;

  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchDark, setSearchDark] = useState(false);
  const [searchContentH, setSearchContentH] = useState(0);
  const [navBarHeight, setNavBarHeight] = useState(60);
  const [searchPanelClosing, setSearchPanelClosing] = useState(false);
  const { query, setQuery, reset: resetSearchQuery } = useMarketingSearchQuery();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchScrollRef = useRef<HTMLDivElement>(null);
  const searchPanelRef = useRef<HTMLDivElement>(null);
  const navBarRowRef = useRef<HTMLDivElement>(null);
  const searchPanelHeightPx = useSearchPanelHeight(searchOpen, searchContentH, navBarHeight);
  const searchPanelVisible = searchOpen || searchPanelClosing;

  const navAutoHide = useNavAutoHide(!searchOpen && !searchPanelClosing);
  const navVisible = navAutoHide || searchOpen || searchPanelClosing;
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const chromeDark = searchOpen ? searchDark : darkNav;

  const handlers: NavHandlers = {
    onHowItWorks,
    onPricing: onGoPricing
  };

  const closeMenus = useCallback(() => {
    setActiveMenu(null);
    setLoginOpen(false);
  }, []);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchPanelClosing(true);
    resetSearchQuery();
  }, [resetSearchQuery]);

  useEffect(() => {
    const el = navBarRowRef.current;
    if (!el) return;
    const report = () => setNavBarHeight(el.offsetHeight);
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!searchPanelClosing) return;
    const el = searchPanelRef.current;
    if (!el) {
      setSearchPanelClosing(false);
      setSearchContentH(0);
      return;
    }
    const finish = () => {
      setSearchPanelClosing(false);
      setSearchContentH(0);
    };
    const onEnd = (e: TransitionEvent) => {
      if (e.target !== el || e.propertyName !== "height") return;
      finish();
    };
    el.addEventListener("transitionend", onEnd);
    const fallback = window.setTimeout(finish, 720);
    return () => {
      el.removeEventListener("transitionend", onEnd);
      window.clearTimeout(fallback);
    };
  }, [searchPanelClosing]);

  useEffect(() => {
    if (!navAutoHide) closeMenus();
  }, [navAutoHide, closeMenus]);

  useEffect(() => {
    if (searchOpen) closeMenus();
  }, [searchOpen, closeMenus]);

  useEffect(() => {
    if (!searchOpen && !searchPanelClosing) return;
    const unlock = lockPageScroll();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSearch();
    };
    document.addEventListener("keydown", onKey);
    const t = searchOpen ? window.setTimeout(() => searchInputRef.current?.focus(), 420) : undefined;
    return () => {
      if (t !== undefined) window.clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      unlock();
    };
  }, [searchOpen, searchPanelClosing, closeSearch]);

  const openMenu = (id: string) => {
    if (searchOpen) return;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setLoginOpen(false);
    setActiveMenu(id);
  };

  const scheduleCloseMenu = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setActiveMenu(null), 120);
  };

  const cancelCloseMenu = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };

  const openSearch = useCallback(() => {
    closeMenus();
    setMobileOpen(false);
    setSearchPanelClosing(false);
    setSearchDark(darkNav);
    setSearchOpen(true);
  }, [closeMenus, darkNav]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        openSearch();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openSearch]);

  useEffect(() => {
    const onScroll = () => {
      if (window.scrollY > 48) closeMenus();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [closeMenus]);

  const textMuted = chromeDark ? "text-white/75 hover:text-white" : "text-slate-600 hover:text-violet-800";
  const textMain = chromeDark ? "text-white/90 hover:text-white" : "text-slate-800 hover:text-violet-800";
  const iconBtn = chromeDark
    ? "text-white/80 hover:bg-white/10 hover:text-white"
    : "text-slate-600 hover:bg-slate-900/5 hover:text-slate-900";

  const barChrome = chromeDark
    ? "border-white/15 bg-slate-950/50 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl"
    : "border-white/60 bg-white/80 shadow-[0_12px_40px_rgba(15,23,42,0.1)] backdrop-blur-xl";

  const searchChromeExpanded = chromeDark
    ? "shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
    : "shadow-[0_20px_60px_rgba(15,23,42,0.14)]";

  const divider = chromeDark ? "border-white/10" : "border-slate-200/70";
  const inputClass = chromeDark
    ? "text-white placeholder:text-white/45"
    : "text-slate-900 placeholder:text-slate-400";

  return (
    <>
      <div
        className={`fixed inset-0 z-[48] bg-slate-950/40 backdrop-blur-md transition-opacity ${NAV_MOTION} ${
          searchPanelVisible ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden={!searchPanelVisible}
      >
        <button
          type="button"
          className="absolute inset-0"
          aria-label="Close search"
          tabIndex={searchOpen ? 0 : -1}
          onClick={closeSearch}
        />
      </div>

      <div
        className={`fixed inset-x-0 top-0 z-50 flex justify-center pt-3 transition-[transform,opacity] ${NAV_MOTION} will-change-transform md:pt-4 ${FLOAT_GUTTER} ${
          navVisible ? "pointer-events-none translate-y-0 opacity-100" : "pointer-events-none -translate-y-[calc(100%+1rem)] opacity-0"
        }`}
        aria-hidden={!navVisible}
      >
        <header
          className={`pointer-events-auto flex w-full max-w-6xl min-h-0 flex-col overflow-hidden rounded-2xl border transition-[border-color,box-shadow,background-color] ${NAV_MOTION} lg:max-w-none ${barChrome} ${
            searchOpen ? `max-h-[calc(100dvh-1.5rem)] ${searchChromeExpanded}` : ""
          }`}
          onMouseLeave={searchOpen ? undefined : scheduleCloseMenu}
        >
          <div
            ref={navBarRowRef}
            className="flex h-14 shrink-0 items-center justify-between gap-3 px-4 sm:px-5 lg:h-[3.75rem] lg:px-6"
          >
            <button
              type="button"
              onClick={() => {
                closeMenus();
                if (searchOpen) closeSearch();
                onHome();
              }}
              className={`font-display shrink-0 text-lg font-extrabold tracking-tight transition ${
                chromeDark ? "text-white" : "text-slate-900"
              }`}
            >
              Serve
              <span
                className={
                  chromeDark ? "text-white/90" : "bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent"
                }
              >
                OS
              </span>
            </button>

            {searchOpen ? (
              <div className="flex min-w-0 flex-1 items-center gap-2 lg:gap-3">
                <SearchIcon className={`h-5 w-5 shrink-0 ${chromeDark ? "text-violet-300" : "text-violet-500"}`} />
                <input
                  ref={searchInputRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search features, integrations, guides…"
                  className={`min-w-0 flex-1 bg-transparent text-base font-semibold outline-none lg:text-lg ${inputClass}`}
                  autoComplete="off"
                  aria-label="Search ServeOS"
                />
              </div>
            ) : (
              <>
                <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Main">
                  {NAV_MEGA_MENUS.map((menu) => (
                    <div
                      key={menu.id}
                      onMouseEnter={() => {
                        cancelCloseMenu();
                        openMenu(menu.id);
                      }}
                    >
                      <button
                        type="button"
                        className={`flex items-center rounded-lg px-3 py-2 text-sm font-semibold transition ${textMain} ${
                          activeMenu === menu.id ? (chromeDark ? "bg-white/10" : "bg-violet-50/90") : ""
                        }`}
                        aria-expanded={activeMenu === menu.id}
                        aria-haspopup="true"
                      >
                        {menu.label}
                        <NavChevron open={activeMenu === menu.id} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${textMain}`}
                    onClick={() => {
                      closeMenus();
                      runNavAction({ type: "pricing" }, handlers);
                    }}
                  >
                    Pricing
                  </button>
                </nav>

                <div className="flex items-center gap-1 sm:gap-2">
                  <button
                    type="button"
                    onClick={openSearch}
                    className={`hidden rounded-lg p-2.5 transition lg:inline-flex ${iconBtn}`}
                    aria-label="Search"
                  >
                    <SearchIcon className="h-5 w-5" />
                  </button>

                  <div className="relative hidden sm:block">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveMenu(null);
                        setLoginOpen((v) => !v);
                      }}
                      className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${textMuted}`}
                      aria-expanded={loginOpen}
                    >
                      Login
                    </button>
                    <NavLoginMenu
                      open={loginOpen}
                      onClose={() => setLoginOpen(false)}
                      darkSurface={chromeDark}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={startFreeTrial}
                    className={`hidden rounded-full px-5 py-2 text-sm font-bold transition sm:inline-flex ${
                      chromeDark
                        ? "bg-white text-violet-800 shadow-lg hover:bg-violet-50"
                        : btnPrimary + " !py-2 !text-sm"
                    }`}
                  >
                    Start free trial
                  </button>

                  <button
                    type="button"
                    className={`rounded-lg p-2.5 lg:hidden ${iconBtn}`}
                    aria-label="Open menu"
                    onClick={() => {
                      closeMenus();
                      setMobileOpen(true);
                    }}
                  >
                    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              </>
            )}

            {searchOpen ? (
              <button
                type="button"
                onClick={closeSearch}
                className={`shrink-0 rounded-lg p-2.5 transition ${iconBtn}`}
                aria-label="Close search"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            ) : null}
          </div>

          {!searchOpen ? (
            <div
              className={`hidden overflow-hidden transition-[grid-template-rows,opacity] lg:grid ${NAV_MOTION} ${
                activeMenu
                  ? "pointer-events-auto grid-rows-[1fr] opacity-100"
                  : "pointer-events-none grid-rows-[0fr] opacity-0"
              }`}
              onMouseEnter={cancelCloseMenu}
            >
              <div className={`min-h-0 ${activeMenu ? `border-t ${divider}` : ""}`}>
                {activeMenu ? (
                  <NavMegaMenuPanel
                    menu={NAV_MEGA_MENUS.find((m) => m.id === activeMenu)!}
                    darkSurface={chromeDark}
                    handlers={handlers}
                    onClose={() => setActiveMenu(null)}
                  />
                ) : null}
              </div>
            </div>
          ) : null}

          <div
            ref={searchPanelRef}
            className={`flex min-h-0 flex-col overflow-hidden border-t ${divider} ${
              searchPanelVisible ? "pointer-events-auto" : "pointer-events-none"
            }`}
            style={{
              height: `${searchPanelHeightPx}px`,
              maxHeight: `${searchPanelHeightPx}px`,
              opacity: searchPanelHeightPx > 0 ? 1 : 0,
              transition: PANEL_SIZE_TRANSITION
            }}
          >
            <div
              ref={searchScrollRef}
              className="min-h-0 w-full flex-1 touch-pan-y overflow-x-hidden overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]"
              onWheel={(e) => e.stopPropagation()}
            >
              {searchPanelVisible ? (
                <MarketingSearchPanel
                  darkSurface={searchDark}
                  query={query}
                  onClose={closeSearch}
                  handlers={handlers}
                  onContentHeight={setSearchContentH}
                  maxPanelHeightPx={searchPanelHeightPx}
                />
              ) : null}
            </div>
          </div>
        </header>
      </div>

      <MobileMarketingNav
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        handlers={handlers}
        onOpenSearch={openSearch}
      />
    </>
  );
}

export function MobileCtaBar({ onBookDemo }: { onBookDemo?: () => void }) {
  return (
    <div
      className={`${mobileBar} ${pageGutter} lg:hidden`}
      style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
    >
      <button
        type="button"
        onClick={onBookDemo ?? bookDemo}
        className={`flex-1 rounded-full py-2.5 text-sm font-bold ${btnSecondary} !px-3`}
      >
        Book demo
      </button>
      <button
        type="button"
        onClick={startFreeTrial}
        className={`flex-1 rounded-full py-2.5 text-sm font-bold text-white ${btnPrimary}`}
      >
        Free trial
      </button>
    </div>
  );
}
