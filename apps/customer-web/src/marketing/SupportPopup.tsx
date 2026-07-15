import { useEffect, useRef, useState, type ReactNode } from "react";
import { SupportAgentThread } from "@serveos/agents";
import { readAdminTheme } from "../admin/adminNavContent";
import { FOOTER_SUPPORT_EMAIL } from "./footerContent";
import {
  SUPPORT_POPUP_FAQS,
  SUPPORT_POPUP_HOME_FAQS,
  SUPPORT_POPUP_SUBTITLE,
  SUPPORT_POPUP_TITLE
} from "./supportPopupContent";
import {
  getSupportGreetingEmoji
} from "./supportPopupGreeting";
import { useSupportUserName } from "./useSupportUserName";
import { ServeOsWordmark } from "../signup/SignupShell";
import { fabToneClasses, FAB_BRAND_CLASSES } from "./fabTone";
import { useAdminWorkspaceFabTone } from "./useAdminWorkspaceFabTone";
import { useSupportFabTone } from "./useSupportFabTone";
import { bookDemo, scrollToId, startFreeTrial } from "./ui";

type Props = {
  isVisible: boolean;
  onOpen: () => void;
  onClose: () => void;
  marketingScrollTone?: boolean;
  workspaceLocked?: boolean;
  /** Admin dashboard chrome — uses theme-aware FAB colors (independent of session lock). */
  adminWorkspaceChrome?: boolean;
  /** Optional display name override for the compact home greeting. */
  loggedInUserName?: string | null;
  fabClassName?: string;
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

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
    </svg>
  );
}

function ExpandWideIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 3h6v6M9 21H3v-6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 3l-7 7M3 21l7-7" />
    </svg>
  );
}

function ShrinkWideIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 3H3v6M15 21h6v-6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l7 7M21 21l-7-7" />
    </svg>
  );
}

function HomeNavIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1v-9.5z" />
    </svg>
  );
}

function HelpNavIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.09 9a3 3 0 115.82 1c0 2-3 2-3 4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 17h.01" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

function MessagesNavIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.77 9.77 0 01-4-.8L3 20l1.2-3.6C3.51 15.04 3 13.57 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      />
    </svg>
  );
}

type CompactTab = "home" | "help" | "messages";

const COMPACT_NAV_ITEMS: { id: CompactTab; label: string; Icon: typeof HomeNavIcon }[] = [
  { id: "home", label: "Home", Icon: HomeNavIcon },
  { id: "help", label: "Help", Icon: HelpNavIcon },
  { id: "messages", label: "Messages", Icon: MessagesNavIcon }
];

const COMPACT_TAB_ORDER: CompactTab[] = ["home", "help", "messages"];

function compactTabIndex(tab: CompactTab) {
  return COMPACT_TAB_ORDER.indexOf(tab);
}

type TabTransition = "from-left" | "from-right" | "from-center";

function CompactTabPane({
  tab,
  transition,
  children
}: {
  tab: CompactTab;
  transition: TabTransition;
  children: ReactNode;
}) {
  return (
    <div
      key={tab}
      className={`support-popup-pane support-popup-pane--${transition}`}
      data-tab={tab}
    >
      {children}
    </div>
  );
}

function SupportPopupNavChevronRight() {
  return (
    <svg
      className="support-popup-nav-chevron support-popup-nav-chevron--right"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden
    >
      <path d="M4.5 2.5L8 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function SendMessageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M22 2L11 13" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  );
}

function BackChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function ClearSearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function SupportPopupHomeHero({ userName }: { userName: string }) {
  const greetingEmoji = getSupportGreetingEmoji();
  return (
    <div className="support-popup-home-hero">
      <p className="support-popup-home-greeting">
        Hi {userName}
        <span className="support-popup-home-greeting-emoji" aria-hidden>
          {" "}
          {greetingEmoji}
        </span>
      </p>
      <p className="support-popup-home-tagline">How can we help?</p>
    </div>
  );
}

function SearchFieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path strokeLinecap="round" d="M20 20l-3.5-3.5" />
    </svg>
  );
}

type WideViewMode = "overview" | "search" | "faq";
type WideReturnView = "compact" | "search" | "overview";

function SupportPopupHomeSearchPanel({
  onOpenSearch,
  onOpenFaq
}: {
  onOpenSearch: () => void;
  onOpenFaq: (faqId: string) => void;
}) {
  return (
    <div className="support-popup-home-search-card">
      <button type="button" className="support-popup-home-search-trigger" onClick={onOpenSearch}>
        <span className="support-popup-home-search-placeholder">Search for help...</span>
        <SearchFieldIcon className="support-popup-home-search-icon" />
      </button>
      <ul className="support-popup-home-faq-list">
        {SUPPORT_POPUP_HOME_FAQS.map((item) => (
          <li key={item.id} className="support-popup-home-faq-item">
            <button type="button" className="support-popup-home-faq-row" onClick={() => onOpenFaq(item.id)}>
              <span className="support-popup-home-faq-question">{item.q}</span>
              <SupportPopupNavChevronRight />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SupportPopupWideFaq({ faq }: { faq: (typeof SUPPORT_POPUP_FAQS)[number] }) {
  return (
    <article className="support-popup-wide-faq">
      <h3 className="support-popup-wide-faq-question">{faq.q}</h3>
      <p className="support-popup-wide-faq-answer">{faq.a}</p>
    </article>
  );
}

function SupportPopupWideSearch({
  query,
  onQueryChange,
  onSelectFaq
}: {
  query: string;
  onQueryChange: (value: string) => void;
  onSelectFaq: (faqId: string) => void;
}) {
  const normalized = query.trim().toLowerCase();
  const results = normalized
    ? SUPPORT_POPUP_FAQS.filter(
        (item) =>
          item.q.toLowerCase().includes(normalized) || item.a.toLowerCase().includes(normalized)
      )
    : SUPPORT_POPUP_FAQS;

  return (
    <div className="support-popup-wide-search">
      <label className="support-popup-wide-search-label">
        <span className="sr-only">Search for help</span>
        <div className="support-popup-wide-search-field">
          <input
            type="search"
            className="support-popup-wide-search-input"
            placeholder="Search for help..."
            autoComplete="off"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            autoFocus
          />
          {query ? (
            <button
              type="button"
              className="support-popup-home-search-action support-popup-home-search-action--clear"
              aria-label="Clear search"
              onClick={() => onQueryChange("")}
            >
              <ClearSearchIcon className="support-popup-home-search-icon" />
            </button>
          ) : (
            <span className="support-popup-home-search-action" aria-hidden>
              <SearchFieldIcon className="support-popup-home-search-icon" />
            </span>
          )}
        </div>
      </label>
      <p className="support-popup-wide-search-label-text">
        {normalized ? "Results" : "Recommended"}
      </p>
      <ul className="support-popup-wide-search-list">
        {results.map((item) => (
          <li key={item.id} className="support-popup-wide-search-item">
            <button type="button" className="support-popup-home-faq-row" onClick={() => onSelectFaq(item.id)}>
              <span className="support-popup-home-faq-question">{item.q}</span>
              <SupportPopupNavChevronRight />
            </button>
          </li>
        ))}
      </ul>
      {results.length === 0 ? (
        <p className="support-popup-wide-search-empty">No matches found. Try another phrase.</p>
      ) : null}
    </div>
  );
}

function SupportPopupHomeTab({
  userName,
  onGoToMessages,
  onOpenSearch,
  onOpenFaq
}: {
  userName: string;
  onGoToMessages: () => void;
  onOpenSearch: () => void;
  onOpenFaq: (faqId: string) => void;
}) {
  return (
    <div className="support-popup-home-layout">
      <SupportPopupHomeHero userName={userName} />
      <SupportPopupHomeSearchPanel onOpenSearch={onOpenSearch} onOpenFaq={onOpenFaq} />
      <div className="support-popup-home-spacer" aria-hidden />
      <button type="button" className="support-popup-home-message-cta" onClick={onGoToMessages}>
        <span>Send us a message</span>
        <SendMessageIcon className="h-5 w-5" />
      </button>
    </div>
  );
}

type MessagesViewTransition = "from-left" | "from-right" | "from-center";

function MessagesViewPane({
  view,
  transition,
  children
}: {
  view: "inbox" | "thread";
  transition: MessagesViewTransition;
  children: ReactNode;
}) {
  return (
    <div
      key={view}
      className={`support-popup-messages-view support-popup-messages-view--${transition}`}
      data-view={view}
    >
      {children}
    </div>
  );
}

function SupportPopupMessagesInbox({ onStartThread }: { onStartThread: () => void }) {
  return (
    <div className="support-popup-messages-layout">
      <div className="support-popup-messages-empty-state">
        <MessagesNavIcon className="support-popup-messages-empty-icon" />
        <p className="support-popup-messages-empty-title">No messages</p>
        <p className="support-popup-messages-empty-subtitle">
          Messages from the team will be shown here
        </p>
      </div>
      <button type="button" className="support-popup-home-message-cta" onClick={onStartThread}>
        <span>Send us a message</span>
        <SendMessageIcon className="h-5 w-5" />
      </button>
    </div>
  );
}

type BodyProps = {
  openFaqs: Record<string, boolean>;
  workspaceLocked: boolean;
  compactTab: CompactTab;
  wideOpen: boolean;
  wideView: WideViewMode;
  wideFaqId: string | null;
  wideSearchQuery: string;
  onWideSearchQueryChange: (value: string) => void;
  onOpenWideFaqFromSearch: (faqId: string) => void;
  onOpenSearch: () => void;
  onOpenFaq: (faqId: string) => void;
  userName: string;
  messagesThreadOpen: boolean;
  messagesViewTransition: MessagesViewTransition;
  onStartMessagesThread: () => void;
  onGoToMessages: () => void;
  onToggleFaq: (id: string) => void;
  onClose: () => void;
  onHowItWorks?: () => void;
  onViewPricing?: () => void;
};

function SupportPopupSalesCard({
  workspaceLocked,
  onClose,
  onViewPricing
}: Pick<BodyProps, "workspaceLocked" | "onClose" | "onViewPricing">) {
  if (!workspaceLocked) {
    return (
      <div className="support-popup-sales-card">
        <p className="support-popup-sales-title">Sales & onboarding</p>
        <p className="support-popup-sales-meta">
          Monday–Friday 09:00–17:00 · {FOOTER_SUPPORT_EMAIL}
        </p>
        <button
          type="button"
          className="support-popup-btn support-popup-btn--gradient"
          onClick={() => {
            startFreeTrial();
            onClose();
          }}
        >
          Start free trial
        </button>
        <button
          type="button"
          className="support-popup-btn support-popup-btn--link"
          onClick={() => {
            (onViewPricing ?? (() => scrollToId("pricing")))();
            onClose();
          }}
        >
          View pricing →
        </button>
      </div>
    );
  }

  return (
    <div className="support-popup-sales-card">
      <p className="support-popup-sales-title">Workspace support</p>
      <p className="support-popup-sales-meta">
        Monday–Friday 09:00–17:00 · {FOOTER_SUPPORT_EMAIL}
      </p>
    </div>
  );
}

function SupportPopupBody({
  openFaqs,
  workspaceLocked,
  compactTab,
  wideOpen,
  wideView,
  wideFaqId,
  wideSearchQuery,
  onWideSearchQueryChange,
  onOpenWideFaqFromSearch,
  onOpenSearch,
  onOpenFaq,
  userName,
  messagesThreadOpen,
  messagesViewTransition,
  onStartMessagesThread,
  onGoToMessages,
  onToggleFaq,
  onClose,
  onHowItWorks,
  onViewPricing
}: BodyProps) {
  const faqList = (
    <ul className="support-popup-faq-list">
      {SUPPORT_POPUP_FAQS.map((item) => {
        const open = !!openFaqs[item.id];
        return (
          <li key={item.id} className="support-popup-faq-item">
            <button
              type="button"
              className="support-popup-faq-trigger"
              onClick={() => onToggleFaq(item.id)}
              aria-expanded={open}
            >
              <span className="support-popup-faq-question">{item.q}</span>
              <span className={`support-popup-faq-chevron${open ? " is-open" : ""}`} aria-hidden>
                ▾
              </span>
            </button>
            {open ? <p className="support-popup-faq-answer">{item.a}</p> : null}
          </li>
        );
      })}
    </ul>
  );

  const salesCard = (
    <SupportPopupSalesCard
      workspaceLocked={workspaceLocked}
      onClose={onClose}
      onViewPricing={onViewPricing}
    />
  );

  if (!wideOpen) {
    if (compactTab === "home") {
      return (
        <SupportPopupHomeTab
          userName={userName}
          onGoToMessages={onGoToMessages}
          onOpenSearch={onOpenSearch}
          onOpenFaq={onOpenFaq}
        />
      );
    }

    if (compactTab === "help") {
      return (
        <>
          <p className="support-popup-section-label">Common questions</p>
          {faqList}
        </>
      );
    }

    return (
      <MessagesViewPane
        view={messagesThreadOpen ? "thread" : "inbox"}
        transition={messagesViewTransition}
      >
        {messagesThreadOpen ? (
          <SupportAgentThread />
        ) : (
          <SupportPopupMessagesInbox onStartThread={onStartMessagesThread} />
        )}
      </MessagesViewPane>
    );
  }

  const selectedWideFaq = wideFaqId
    ? SUPPORT_POPUP_FAQS.find((item) => item.id === wideFaqId)
    : undefined;

  if (wideView === "search") {
    return (
      <SupportPopupWideSearch
        query={wideSearchQuery}
        onQueryChange={onWideSearchQueryChange}
        onSelectFaq={onOpenWideFaqFromSearch}
      />
    );
  }

  if (wideView === "faq" && selectedWideFaq) {
    return <SupportPopupWideFaq faq={selectedWideFaq} />;
  }

  return (
    <>
      <p className="support-popup-section-label">Common questions</p>
      {faqList}

      <div className="support-popup-actions">
        <button
          type="button"
          className="support-popup-btn support-popup-btn--primary"
          onClick={() => {
            window.location.href = `mailto:${FOOTER_SUPPORT_EMAIL}?subject=ServeOS%20support`;
            onClose();
          }}
        >
          Contact support
        </button>
        <button
          type="button"
          className="support-popup-btn support-popup-btn--secondary"
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
            className="support-popup-btn support-popup-btn--ghost"
            onClick={() => {
              onHowItWorks();
              onClose();
            }}
          >
            How ServeOS works
          </button>
        ) : null}
      </div>

      {salesCard}
    </>
  );
}

export function SupportPopup({
  isVisible,
  onOpen,
  onClose,
  marketingScrollTone = true,
  workspaceLocked = false,
  adminWorkspaceChrome = false,
  fabClassName = "bottom-24 right-4 md:bottom-6 md:right-6",
  loggedInUserName,
  onHowItWorks,
  onViewPricing,
  onFindSetup
}: Props) {
  const [openFaqs, setOpenFaqs] = useState<Record<string, boolean>>({});
  const [compactTab, setCompactTab] = useState<CompactTab>("home");
  const [messagesThreadOpen, setMessagesThreadOpen] = useState(false);
  const [messagesViewTransition, setMessagesViewTransition] =
    useState<MessagesViewTransition>("from-center");
  const [tabTransition, setTabTransition] = useState<TabTransition>("from-center");
  const [wideOpen, setWideOpen] = useState(false);
  const [wideView, setWideView] = useState<WideViewMode>("overview");
  const [wideFaqId, setWideFaqId] = useState<string | null>(null);
  const [wideSearchQuery, setWideSearchQuery] = useState("");
  const [wideReturnView, setWideReturnView] = useState<WideReturnView>("compact");
  const [panelPresent, setPanelPresent] = useState(false);
  const [panelAnimated, setPanelAnimated] = useState(false);
  const [adminTheme, setAdminTheme] = useState(readAdminTheme);
  const overlayRef = useRef<HTMLDivElement>(null);
  const scrollLightFab = useSupportFabTone(!isVisible && !adminWorkspaceChrome);
  const adminFabTone = useAdminWorkspaceFabTone(adminWorkspaceChrome);
  const fabTone = adminWorkspaceChrome
    ? adminFabTone
    : marketingScrollTone && scrollLightFab
      ? "light"
      : "dark";
  const userName = useSupportUserName(workspaceLocked, loggedInUserName);

  const resetWideState = () => {
    setWideView("overview");
    setWideFaqId(null);
    setWideSearchQuery("");
    setWideReturnView("compact");
  };

  const closeWide = () => {
    setWideOpen(false);
    resetWideState();
  };

  const openWideOverview = () => {
    resetWideState();
    setWideView("overview");
    setWideOpen(true);
  };

  const openWideSearch = () => {
    resetWideState();
    setWideReturnView("compact");
    setWideView("search");
    setWideOpen(true);
  };

  const openWideFaq = (faqId: string, returnView: WideReturnView = "compact") => {
    setWideFaqId(faqId);
    setWideReturnView(returnView);
    setWideView("faq");
    setWideOpen(true);
  };

  const openWideFaqFromSearch = (faqId: string) => {
    openWideFaq(faqId, "search");
  };

  const handleWideBack = () => {
    if (wideView === "faq" && wideReturnView === "search") {
      setWideView("search");
      setWideFaqId(null);
      return;
    }
    closeWide();
  };

  const selectCompactTab = (next: CompactTab) => {
    if (next === compactTab) return;
    const prevIdx = compactTabIndex(compactTab);
    const nextIdx = compactTabIndex(next);
    setTabTransition(
      nextIdx > prevIdx ? "from-right" : nextIdx < prevIdx ? "from-left" : "from-center"
    );
    if (next !== "messages") setMessagesThreadOpen(false);
    setCompactTab(next);
  };

  const openMessagesThread = () => {
    setMessagesViewTransition("from-right");
    setMessagesThreadOpen(true);
  };

  const closeMessagesThread = () => {
    setMessagesViewTransition("from-left");
    setMessagesThreadOpen(false);
  };

  useEffect(() => {
    if (!isVisible) {
      setWideOpen(false);
      resetWideState();
      setCompactTab("home");
      setMessagesThreadOpen(false);
      setMessagesViewTransition("from-center");
      setTabTransition("from-center");
    }
  }, [isVisible]);

  useEffect(() => {
    if (isVisible) {
      setPanelPresent(true);
      let raf2 = 0;
      const raf1 = window.requestAnimationFrame(() => {
        raf2 = window.requestAnimationFrame(() => setPanelAnimated(true));
      });
      return () => {
        window.cancelAnimationFrame(raf1);
        window.cancelAnimationFrame(raf2);
      };
    }
    setPanelAnimated(false);
    const timer = window.setTimeout(() => setPanelPresent(false), 820);
    return () => window.clearTimeout(timer);
  }, [isVisible]);

  useEffect(() => {
    if (!wideOpen || !adminWorkspaceChrome) return;
    setAdminTheme(readAdminTheme());
  }, [wideOpen, adminWorkspaceChrome]);

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
      if (e.key !== "Escape") return;
      if (wideOpen) {
        if (wideView === "faq" && wideReturnView === "search") {
          handleWideBack();
        } else {
          closeWide();
        }
        return;
      }
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isVisible, wideOpen, wideView, wideReturnView, onClose]);

  const toggleFaq = (id: string) => {
    setOpenFaqs((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const fabDismiss = isVisible;
  const panelOpen = panelAnimated || wideOpen;
  const backdropActive = isVisible && panelOpen;

  useEffect(() => {
    if (panelOpen) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && overlayRef.current?.contains(active)) {
      active.blur();
    }
  }, [panelOpen]);

  const compactHomeTab = !wideOpen && compactTab === "home";
  const compactMessagesTab = !wideOpen && compactTab === "messages";
  const compactMessagesThread = compactMessagesTab && messagesThreadOpen;
  const wideSubView = wideOpen && wideView !== "overview";
  const dialogAnchorClass = adminWorkspaceChrome
    ? "support-popup-dialog--anchor-admin"
    : "support-popup-dialog--anchor-marketing";

  const body = (
    <SupportPopupBody
      openFaqs={openFaqs}
      workspaceLocked={workspaceLocked}
      compactTab={compactTab}
      wideOpen={wideOpen}
      wideView={wideView}
      wideFaqId={wideFaqId}
      wideSearchQuery={wideSearchQuery}
      onWideSearchQueryChange={setWideSearchQuery}
      onOpenWideFaqFromSearch={openWideFaqFromSearch}
      onOpenSearch={openWideSearch}
      onOpenFaq={(faqId) => openWideFaq(faqId, "compact")}
      userName={userName}
      messagesThreadOpen={messagesThreadOpen}
      messagesViewTransition={messagesViewTransition}
      onStartMessagesThread={openMessagesThread}
      onGoToMessages={() => selectCompactTab("messages")}
      onToggleFaq={toggleFaq}
      onClose={onClose}
      onHowItWorks={onHowItWorks}
      onViewPricing={onViewPricing}
    />
  );

  return (
    <>
      {panelPresent ? (
      <div
        ref={overlayRef}
        className={`support-popup-overlay${wideOpen ? " support-popup-overlay--wide" : ""}${
          panelPresent ? " is-present" : ""
        }`}
        role="presentation"
        inert={!panelOpen ? true : undefined}
      >
        <button
          type="button"
          className={`support-popup-backdrop${backdropActive ? " is-active" : ""}`}
          aria-label="Close support"
          tabIndex={isVisible && !wideOpen ? 0 : -1}
          onClick={() => {
            if (!wideOpen) onClose();
          }}
        />

        <div
          role="dialog"
          aria-modal="true"
          aria-label={SUPPORT_POPUP_TITLE}
          className={`support-popup-dialog ${dialogAnchorClass}${wideOpen ? " support-popup-dialog--fullscreen" : ""}${
            wideSubView ? " support-popup-dialog--wide-subview" : ""
          }${panelOpen ? " is-open" : ""}`}
          data-theme={wideOpen && adminWorkspaceChrome ? adminTheme : undefined}
        >
          <button
            type="button"
            onClick={closeWide}
            className="support-popup-wide-toggle support-popup-wide-toggle--corner"
            aria-label="Exit wide view"
            aria-pressed={wideOpen}
            tabIndex={wideOpen && !wideSubView ? 0 : -1}
          >
            <ShrinkWideIcon className="h-5 w-5" />
          </button>

          <div className="support-popup-chrome">
          {wideSubView ? (
            <header className="support-popup-header support-popup-header--compact support-popup-header--wide-sub">
              <button
                type="button"
                className="support-popup-header-back"
                aria-label="Back"
                onClick={handleWideBack}
              >
                <BackChevronIcon className="h-5 w-5" />
              </button>
              <div className="support-popup-header-main support-popup-header-main--spacer" aria-hidden />
            </header>
          ) : (
          <header
            className={`support-popup-header support-popup-header--compact${
              compactHomeTab ? " support-popup-header--home-tab" : ""
            }${compactMessagesTab && !compactMessagesThread ? " support-popup-header--messages-tab" : ""}${
              compactMessagesThread ? " support-popup-header--messages-thread" : ""
            }`}
          >
            {compactMessagesThread ? (
              <>
                <button
                  type="button"
                  className="support-popup-header-back"
                  aria-label="Back to messages"
                  onClick={closeMessagesThread}
                >
                  <BackChevronIcon className="h-5 w-5" />
                </button>
                <div className="support-popup-header-thread-peer">
                  <p className="support-popup-thread-peer-name">Serveos AI</p>
                  <p className="support-popup-thread-peer-sub">The team can also help</p>
                </div>
              </>
            ) : compactHomeTab ? (
              <div className="support-popup-header-main support-popup-header-brand">
                <ServeOsWordmark className="support-popup-header-brand-wordmark" />
              </div>
            ) : compactMessagesTab ? (
              <h2 className="support-popup-title support-popup-title--centered">Messages</h2>
            ) : (
              <div className="support-popup-header-main">
                <h2 className="support-popup-title">{SUPPORT_POPUP_TITLE}</h2>
                <p className="support-popup-subtitle">{SUPPORT_POPUP_SUBTITLE}</p>
              </div>
            )}
            <div className="support-popup-header-action">
              <button
                type="button"
                onClick={openWideOverview}
                className="support-popup-wide-toggle support-popup-wide-toggle--expand"
                aria-label="Open wide view"
                aria-pressed={false}
                tabIndex={wideOpen ? -1 : 0}
              >
                <ExpandWideIcon className="h-5 w-5" />
              </button>
            </div>
          </header>
          )}

          {wideOpen && wideView === "overview" ? (
          <div className="support-popup-wide-head">
            <h2 className="support-popup-title">{SUPPORT_POPUP_TITLE}</h2>
            <p className="support-popup-subtitle">{SUPPORT_POPUP_SUBTITLE}</p>
          </div>
          ) : null}

          <div
            className={`support-popup-scroll${
              !wideOpen ? " support-popup-scroll--compact-tabs" : ""
            }`}
          >
            {wideOpen ? (
              body
            ) : (
              <CompactTabPane tab={compactTab} transition={tabTransition}>
                {body}
              </CompactTabPane>
            )}
          </div>

          {!wideOpen ? (
            <nav className="support-popup-compact-nav" aria-label="Support sections">
              {COMPACT_NAV_ITEMS.map(({ id, label, Icon }) => {
                const active = compactTab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    className={`support-popup-compact-nav-item${active ? " is-active" : ""}`}
                    aria-current={active ? "page" : undefined}
                    onClick={() => selectCompactTab(id)}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </nav>
          ) : null}
          </div>
        </div>
      </div>
      ) : null}

      <button
        type="button"
        data-support-icon
        data-support-fab-tone={fabTone}
        onClick={() => {
          if (!isVisible) {
            onOpen();
            return;
          }
          if (wideOpen) {
            closeWide();
            return;
          }
          onClose();
        }}
        aria-label={fabDismiss ? "Close support" : "Open support"}
        aria-expanded={isVisible}
        className={`support-popup-fab z-[10002] flex h-14 w-14 items-center justify-center rounded-full border transition-[transform,box-shadow] duration-[260ms] ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.97] ${fabClassName} ${
          fabDismiss ? "support-popup-fab--dismiss" : "hover:scale-105"
        } ${
          adminWorkspaceChrome ? FAB_BRAND_CLASSES : fabToneClasses(fabTone)
        }${!adminWorkspaceChrome && !fabDismiss ? " backdrop-blur-md" : ""}`}
      >
        <span className="support-popup-fab-icon support-popup-fab-icon--chat" aria-hidden>
          <ChatIcon className="h-6 w-6" />
        </span>
        <span className="support-popup-fab-icon support-popup-fab-icon--chevron" aria-hidden>
          <ChevronDownIcon className="h-6 w-6" />
        </span>
      </button>
    </>
  );
}
