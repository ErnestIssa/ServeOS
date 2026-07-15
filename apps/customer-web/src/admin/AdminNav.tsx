import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ServeOsWordmark } from "../signup/SignupShell";
import {
  ADMIN_BILLING_CATEGORIES,
  ADMIN_HELP_CATEGORIES,
  ADMIN_NAV_GROUPS,
  ADMIN_NOTIFICATION_CATEGORIES,
  ADMIN_QUICK_LINKS,
  ADMIN_THEME_ICONS,
  ADMIN_TOP_HASHES,
  ADMIN_TOP_ICONS,
  ADMIN_TOP_TOOL_HINTS,
  ADMIN_VENUE_CONTROL_HASH,
  isBillingNavActive,
  isHelpNavActive,
  isNotificationsNavActive,
  readAdminTheme,
  readUserDisplayName,
  readSidebarPinned,
  readSideNavScroll,
  writeAdminTheme,
  writeSidebarPinned,
  writeSideNavScroll,
  type AdminNavGroup,
  type AdminTheme
} from "./adminNavContent";
import { ADMIN_NAV_SYNC_EVENT, buildNavHref, parseAdminRoute } from "./adminWorkspaceRouting";
import { AdminGlobalSearchModal } from "./AdminGlobalSearchModal";
import { AdminRestaurantSelector, AdminTypingSearch } from "./adminTopChrome";
import { useAdminHash } from "./useAdminHash";
import { useAdminPopoverMount } from "./useAdminPopoverMount";
import { useModalScrollLock } from "../lib/modalScrollLock";

export function useAdminTheme() {
  const [theme, setTheme] = useState<AdminTheme>(readAdminTheme);
  function toggleTheme() {
    setTheme((prev) => {
      const next: AdminTheme = prev === "dark" ? "light" : "dark";
      writeAdminTheme(next);
      return next;
    });
  }
  return { theme, toggleTheme };
}

/** Exactly one sidebar item is active — matched by preset id, not duplicate hrefs. */
function isItemActive(itemId: string, hash: string) {
  const route = parseAdminRoute(hash);
  return route.kind === "workspace" && route.presetId === itemId;
}

/** Group icon highlights only when collapsed; expanded nav shows item active state only. */
function isGroupActive(group: AdminNavGroup, hash: string, expanded: boolean) {
  if (expanded) return false;
  const route = parseAdminRoute(hash);
  return route.kind === "workspace" && route.workspaceId === group.workspaceId;
}

function NavGroupIcon({ src }: { src: string }) {
  return <img src={src} alt="" className="admin-side-group-icon-img" draggable={false} />;
}

/** Nav list height settles after expand/collapse CSS transitions. */
const SIDE_NAV_LAYOUT_MS = 680;

function clampNavScrollTop(scrollEl: HTMLElement, top: number) {
  const max = Math.max(0, scrollEl.scrollHeight - scrollEl.clientHeight);
  return Math.min(max, Math.max(0, top));
}

function NavGroupBlock({
  group,
  groupIndex,
  hash,
  expanded,
  onNavigate,
  onItemClick
}: {
  group: AdminNavGroup;
  groupIndex: number;
  hash: string;
  expanded: boolean;
  onNavigate?: () => void;
  onItemClick?: () => void;
}) {
  const groupActive = isGroupActive(group, hash, expanded);

  return (
    <div
      className="admin-side-group"
      style={{ "--nav-group-index": groupIndex } as CSSProperties}
    >
      <div
        aria-label={group.label}
        className={`admin-side-group-head ${groupActive ? "admin-side-group-head--active" : ""}`}
      >
        <span className="admin-side-group-icon" aria-hidden>
          <NavGroupIcon src={group.icon} />
        </span>
        <span
          className={`admin-side-group-label-text ${groupActive ? "admin-side-group-label-text--active" : ""}`}
        >
          {group.label}
        </span>
      </div>
      <ul className="admin-side-group-items" aria-hidden={!expanded}>
        {group.items.map((item, itemIndex) => {
          const active = isItemActive(item.id, hash);
          return (
            <li
              key={item.id}
              className="admin-side-group-item"
              style={{ "--nav-item-index": itemIndex } as CSSProperties}
            >
              <a
                href={item.href}
                onClick={() => {
                  onItemClick?.();
                  onNavigate?.();
                }}
                aria-current={active && expanded ? "page" : undefined}
                className={`admin-side-link flex items-center gap-2 rounded-lg py-1.5 pl-3 pr-2 text-[13px] transition ${
                  active ? "admin-side-link--active" : ""
                }`}
              >
                <span className="admin-side-link-label truncate">{item.label}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function AdminSideNav({
  pinned,
  onPinnedChange,
  mobileOpen = false,
  onMobileClose,
  onExpandedChange,
  variant = "desktop"
}: {
  pinned: boolean;
  onPinnedChange: (pinned: boolean) => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  onExpandedChange?: (expanded: boolean) => void;
  variant?: "desktop" | "mobile";
}) {
  const [hovered, setHovered] = useState(false);
  const hash = useAdminHash();
  const navRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const savedScrollTop = useRef(readSideNavScroll());
  const scrollPersistTimer = useRef<number | null>(null);
  const restoreTimer = useRef<number | null>(null);
  const restoreRaf = useRef<number | null>(null);
  const expandedRef = useRef(false);

  const expanded = pinned || hovered || variant === "mobile";
  const isMobile = variant === "mobile";
  const lockPageScroll = isMobile ? mobileOpen : hovered;

  useModalScrollLock(isMobile && mobileOpen);

  expandedRef.current = expanded;

  const persistNavScroll = useCallback(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl || !expandedRef.current) return;
    const next = clampNavScrollTop(scrollEl, scrollEl.scrollTop);
    savedScrollTop.current = next;
    writeSideNavScroll(next);
  }, []);

  const applySavedNavScroll = useCallback(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;
    scrollEl.scrollTop = savedScrollTop.current;
  }, []);

  const scheduleNavScrollRestore = useCallback(() => {
    if (restoreTimer.current) window.clearTimeout(restoreTimer.current);
    if (restoreRaf.current) window.cancelAnimationFrame(restoreRaf.current);

    applySavedNavScroll();
    restoreRaf.current = window.requestAnimationFrame(() => {
      applySavedNavScroll();
      restoreTimer.current = window.setTimeout(applySavedNavScroll, SIDE_NAV_LAYOUT_MS);
    });
  }, [applySavedNavScroll]);

  useEffect(() => {
    if (isMobile) {
      onExpandedChange?.(false);
      return;
    }
    onExpandedChange?.(expanded);
  }, [expanded, isMobile, onExpandedChange]);

  useEffect(() => {
    const root = document.documentElement;
    const useLegacySideScrollLock = !isMobile && lockPageScroll;
    if (!useLegacySideScrollLock) {
      root.classList.remove("admin-side-scroll-lock");
      return;
    }
    root.classList.add("admin-side-scroll-lock");
    return () => root.classList.remove("admin-side-scroll-lock");
  }, [isMobile, lockPageScroll]);

  useEffect(() => {
    const node = navRef.current;
    if (!node || !lockPageScroll) return;

    const onWheel = (e: WheelEvent) => {
      const scrollEl = node.querySelector<HTMLElement>(".admin-side-nav-scroll");
      if (!scrollEl || !expanded) {
        e.preventDefault();
        return;
      }
      const { scrollTop, scrollHeight, clientHeight } = scrollEl;
      const scrollingUp = e.deltaY < 0;
      const scrollingDown = e.deltaY > 0;
      const atTop = scrollTop <= 0;
      const atBottom = scrollTop + clientHeight >= scrollHeight - 1;
      if ((atTop && scrollingUp) || (atBottom && scrollingDown)) {
        e.preventDefault();
      }
    };

    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [lockPageScroll, expanded]);

  useEffect(() => {
    if (!expanded) return;
    scheduleNavScrollRestore();
  }, [expanded, scheduleNavScrollRestore]);

  useEffect(() => {
    if (!isMobile || !mobileOpen) return;
    scheduleNavScrollRestore();
  }, [isMobile, mobileOpen, scheduleNavScrollRestore]);

  useEffect(() => {
    if (!expanded) return;
    const scrollEl = scrollRef.current;
    const content = scrollEl?.querySelector<HTMLElement>(".admin-side-groups");
    if (!scrollEl || !content) return;

    const onResize = () => applySavedNavScroll();
    const ro = new ResizeObserver(onResize);
    ro.observe(content);

    return () => ro.disconnect();
  }, [expanded, applySavedNavScroll]);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl || !expanded) return;

    const onScroll = () => {
      if (scrollPersistTimer.current) window.clearTimeout(scrollPersistTimer.current);
      scrollPersistTimer.current = window.setTimeout(() => persistNavScroll(), 50);
    };

    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scrollEl.removeEventListener("scroll", onScroll);
      if (scrollPersistTimer.current) window.clearTimeout(scrollPersistTimer.current);
    };
  }, [expanded, persistNavScroll]);

  useEffect(
    () => () => {
      if (restoreTimer.current) window.clearTimeout(restoreTimer.current);
      if (restoreRaf.current) window.cancelAnimationFrame(restoreRaf.current);
      if (scrollPersistTimer.current) window.clearTimeout(scrollPersistTimer.current);
    },
    []
  );

  function handleNavMouseEnter() {
    if (isMobile) return;
    setHovered(true);
  }

  function handleNavMouseLeave() {
    if (isMobile) return;
    persistNavScroll();
    setHovered(false);
  }

  function handleNavItemClick() {
    persistNavScroll();
  }

  function togglePin() {
    persistNavScroll();
    const next = !pinned;
    onPinnedChange(next);
    writeSidebarPinned(next);
  }

  const nav = (
    <nav
      ref={navRef}
      className={`admin-side-nav flex h-full flex-col ${
        isMobile ? "w-[var(--admin-side-expanded)]" : expanded ? "admin-side-nav--expanded" : "admin-side-nav--collapsed"
      }`}
      style={{ "--nav-open": expanded ? 1 : 0 } as CSSProperties}
      aria-label="Admin navigation"
      onMouseEnter={handleNavMouseEnter}
      onMouseLeave={handleNavMouseLeave}
    >
      <div className="admin-side-nav-glow pointer-events-none absolute inset-0" aria-hidden />

      <div
        ref={scrollRef}
        className={`admin-side-nav-scroll relative flex-1 overflow-x-hidden px-2 pb-2 pt-3 ${
          expanded ? "overflow-y-auto" : "overflow-y-hidden"
        }`}
      >
        <div className="admin-side-groups space-y-0.5">
          {ADMIN_NAV_GROUPS.map((group, groupIndex) => (
            <NavGroupBlock
              key={group.id}
              group={group}
              groupIndex={groupIndex}
              hash={hash}
              expanded={expanded}
              onNavigate={isMobile ? onMobileClose : undefined}
              onItemClick={handleNavItemClick}
            />
          ))}
        </div>
      </div>

      <div className="admin-side-pin-row relative border-t p-2">
        <button
          type="button"
          onClick={togglePin}
          aria-label={pinned ? "Unpin sidebar" : "Pin sidebar open"}
          className={`admin-side-pin-btn flex w-full items-center rounded-lg py-2 text-left text-xs font-semibold transition ${
            pinned ? "admin-side-pin-btn--active" : ""
          }`}
        >
          <span className="admin-side-pin-icon flex shrink-0 items-center justify-center" aria-hidden>
            <img
              src="/icons/right-arrow.png"
              alt=""
              className={`admin-side-pin-arrow ${pinned ? "admin-side-pin-arrow--pinned" : ""}`}
            />
          </span>
          <span className="admin-side-pin-label sr-only">{pinned ? "Unpin sidebar" : "Pin sidebar open"}</span>
        </button>
      </div>
    </nav>
  );

  if (isMobile) {
    return (
      <>
        <div
          className={`admin-side-mobile-backdrop fixed inset-0 z-[65] bg-slate-950/50 backdrop-blur-[2px] transition-opacity duration-300 ease-out lg:hidden ${
            mobileOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
          }`}
          onClick={onMobileClose}
          aria-hidden={!mobileOpen}
        />
        <aside
          className={`admin-side-mobile-drawer fixed bottom-0 left-0 top-0 z-[66] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:hidden ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {nav}
        </aside>
      </>
    );
  }

  return (
    <aside
      className="admin-side-shell fixed bottom-0 left-0 z-[60] hidden lg:block"
      style={{ top: "var(--admin-top-h)" }}
    >
      {nav}
    </aside>
  );
}

function useAdminSidebarPinned() {
  const [pinned, setPinned] = useState(readSidebarPinned);
  return { pinned, setPinned };
}

type Restaurant = { id: string; name: string };

function NavChevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`ml-0.5 h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden
    >
      <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function useHoverMenu(closeDelayMs = 140) {
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function openNow() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setOpen(true);
  }

  function closeSoon() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setOpen(false), closeDelayMs);
  }

  return { open, openNow, closeSoon, setOpen };
}

type BubbleArrow = "center" | "end";

function AdminBubbleShell({
  arrow,
  children,
  className = ""
}: {
  arrow: BubbleArrow;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`admin-top-bubble admin-top-bubble--arrow-${arrow} ${className}`.trim()}
      role="dialog"
      aria-modal="false"
    >
      {children}
    </div>
  );
}

function AdminBubbleHeader({
  title,
  description,
  descriptionClassName
}: {
  title: string;
  description?: string;
  descriptionClassName?: string;
}) {
  return (
    <div className="admin-bubble-header">
      <p className="admin-bubble-title">{title}</p>
      {description ? (
        <p className={`admin-bubble-desc ${descriptionClassName ?? ""}`.trim()}>{description}</p>
      ) : null}
    </div>
  );
}

function AdminBubbleKicker({ children }: { children: ReactNode }) {
  return <p className="admin-bubble-kicker">{children}</p>;
}

function AdminTopToolIcon({ src, className = "" }: { src: string; className?: string }) {
  return (
    <span
      className={`admin-top-tool-icon ${className}`.trim()}
      style={
        {
          "--admin-icon-src": `url("${src}")`
        } as CSSProperties
      }
      aria-hidden
    />
  );
}

function AdminBubbleThemeRow({ theme, onToggle }: { theme: AdminTheme; onToggle: () => void }) {
  const isDark = theme === "dark";
  return (
    <div className="admin-bubble-theme-row">
      <div className="admin-bubble-theme-row-copy">
        <span className="admin-bubble-item-title">{isDark ? "Light" : "Dark"}</span>
        <span className="admin-bubble-item-desc">{isDark ? "Switch to light appearance" : "Switch to dark appearance"}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        className={`admin-bubble-theme-toggle${isDark ? " admin-bubble-theme-toggle--dark" : ""}`}
        onClick={onToggle}
      >
        <span className="admin-bubble-theme-toggle-track" aria-hidden>
          <span className="admin-bubble-theme-toggle-icon admin-bubble-theme-toggle-icon--light">
            <img src={ADMIN_THEME_ICONS.light} alt="" draggable={false} />
          </span>
          <span className="admin-bubble-theme-toggle-icon admin-bubble-theme-toggle-icon--dark">
            <img src={ADMIN_THEME_ICONS.dark} alt="" draggable={false} />
          </span>
          <span className="admin-bubble-theme-toggle-thumb" />
        </span>
      </button>
    </div>
  );
}

function AdminBubbleMenuItem({
  href,
  title,
  description,
  onClick,
  danger = false
}: {
  href?: string;
  title: string;
  description?: string;
  onClick?: () => void;
  danger?: boolean;
}) {
  const cls = `admin-bubble-menu-item${danger ? " admin-bubble-menu-item--danger" : ""}`;
  const inner = (
    <>
      <span className="admin-bubble-item-title">{title}</span>
      {description ? <span className="admin-bubble-item-desc">{description}</span> : null}
    </>
  );

  if (href) {
    return (
      <a href={href} className={cls} onClick={onClick}>
        {inner}
      </a>
    );
  }

  return (
    <button type="button" className={`${cls} w-full text-left`} onClick={onClick}>
      {inner}
    </button>
  );
}

function AdminBubbleCta({ href, children, onClick }: { href: string; children: ReactNode; onClick?: () => void }) {
  return (
    <a href={href} className="admin-bubble-cta" onClick={onClick}>
      {children}
    </a>
  );
}

function AdminHoverBubble({
  open,
  onOpenNow,
  onCloseSoon,
  arrow,
  anchor = arrow === "end" ? "end" : "center",
  children,
  panel
}: {
  open: boolean;
  onOpenNow: () => void;
  onCloseSoon: () => void;
  arrow: BubbleArrow;
  anchor?: "center" | "end";
  children: ReactNode;
  panel: ReactNode;
}) {
  const { mounted, visible } = useAdminPopoverMount(open);

  return (
    <div className="relative" onMouseEnter={onOpenNow} onMouseLeave={onCloseSoon}>
      {children}
      {mounted ? (
        <div
          className={`admin-top-bubble-anchor admin-top-bubble-anchor--${anchor} ${visible ? "admin-top-bubble-anchor--visible" : ""}`.trim()}
          onMouseEnter={onOpenNow}
          onMouseLeave={onCloseSoon}
        >
          <AdminBubbleShell arrow={arrow}>{panel}</AdminBubbleShell>
        </div>
      ) : null}
    </div>
  );
}

function AdminToolBubbleButton({
  src,
  label,
  badge,
  href,
  hint,
  active = false,
  arrow = "center"
}: {
  src: string;
  label: string;
  badge?: boolean;
  href: string;
  hint: { title: string; description: string; cta: string };
  active?: boolean;
  arrow?: BubbleArrow;
}) {
  const menu = useHoverMenu();

  return (
    <AdminHoverBubble
      open={menu.open}
      onOpenNow={menu.openNow}
      onCloseSoon={menu.closeSoon}
      arrow={arrow}
      panel={
        <>
          <AdminBubbleHeader title={hint.title} description={hint.description} />
          <div className="admin-bubble-body">
            <AdminBubbleCta href={href} onClick={() => menu.setOpen(false)}>
              {hint.cta}
            </AdminBubbleCta>
          </div>
        </>
      }
    >
      <button
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        aria-current={active ? "page" : undefined}
        className={`admin-top-tool-btn relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition ${active ? "admin-top-tool-btn--active" : ""}`}
      >
        <AdminTopToolIcon src={src} />
        {badge ? <span className="admin-top-tool-badge" /> : null}
      </button>
    </AdminHoverBubble>
  );
}

function ProfileMenuPanel({
  ownerEmail,
  ownerDisplayName,
  onSignOut,
  onNavigate
}: {
  ownerEmail?: string | null;
  ownerDisplayName: string;
  onSignOut: () => void;
  onNavigate?: () => void;
}) {
  return (
    <>
      <AdminBubbleHeader
        title={ADMIN_TOP_TOOL_HINTS.profile.title}
        description={ownerEmail?.trim() || undefined}
        descriptionClassName="truncate"
      />
      <div className="admin-bubble-body">
        <AdminBubbleCta href={ADMIN_TOP_HASHES.profile} onClick={onNavigate}>
          Open profile
        </AdminBubbleCta>
      </div>
      <div className="admin-bubble-body admin-bubble-body--menu">
        <AdminBubbleMenuItem
          href={ADMIN_VENUE_CONTROL_HASH}
          title="Venue profile"
          description="Identity and locations"
          onClick={onNavigate}
        />
        <div className="admin-bubble-divider" />
        <AdminBubbleMenuItem danger title="Sign out" onClick={() => { onNavigate?.(); onSignOut(); }} />
      </div>
    </>
  );
}

function AdminTopNav({
  restaurants,
  selectedRestaurantId,
  onSelectRestaurant,
  ownerSignupProfile,
  ownerEmail,
  userDisplayName,
  canManageBilling = false,
  theme,
  onToggleTheme,
  onLogoPress,
  onSignOut,
  onOpenMobileNav,
  onOpenSearch,
  venueSwitching
}: {
  restaurants: Restaurant[];
  selectedRestaurantId: string;
  onSelectRestaurant: (id: string) => void;
  ownerSignupProfile?: unknown;
  ownerEmail?: string | null;
  userDisplayName?: string;
  canManageBilling?: boolean;
  theme: AdminTheme;
  onToggleTheme: () => void;
  onLogoPress: () => void;
  onSignOut: () => void;
  onOpenMobileNav?: () => void;
  onOpenSearch: () => void;
  venueSwitching?: boolean;
}) {
  const quickMenu = useHoverMenu();
  const notificationsMenu = useHoverMenu();
  const billingMenu = useHoverMenu();
  const helpMenu = useHoverMenu();
  const profileMenu = useHoverMenu();

  const hash = useAdminHash();
  const profileDisplayName =
    userDisplayName?.trim() ||
    readUserDisplayName({
      email: ownerEmail ?? undefined,
      signupProfile: ownerSignupProfile
    });
  const profileInitial = (profileDisplayName.charAt(0) || "S").toUpperCase();
  const selectedRestaurantName = restaurants.find((r) => r.id === selectedRestaurantId)?.name ?? "";
  const profileActive = hash === ADMIN_TOP_HASHES.profile;

  return (
    <header className="admin-top-nav fixed inset-x-0 top-0 z-[70]">
      <div className="flex h-[var(--admin-top-h)] items-center gap-2 px-3 sm:gap-3 sm:px-4">
        <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-3">
          {onOpenMobileNav ? (
            <button
              type="button"
              className="admin-top-icon-btn flex h-8 w-8 items-center justify-center rounded-lg lg:hidden"
              aria-label="Open navigation"
              onClick={onOpenMobileNav}
            >
              <AdminTopToolIcon src="/icons/application-customer-mobile-svgrepo-com.svg" className="!h-5 !w-5" />
            </button>
          ) : null}

          <button
            type="button"
            onClick={onLogoPress}
            aria-label="Sign out of ServeOS"
            className="shrink-0 text-base sm:text-lg"
          >
            <ServeOsWordmark />
          </button>

          <div className="admin-top-divider hidden h-5 w-px sm:block" aria-hidden />

          <AdminRestaurantSelector
            restaurants={restaurants}
            selectedRestaurantId={selectedRestaurantId}
            onSelectRestaurant={onSelectRestaurant}
            switching={venueSwitching}
          />
        </div>

        <div className="hidden min-w-0 flex-1 justify-center px-2 md:flex">
          <div className="w-full max-w-2xl lg:max-w-3xl">
            <AdminTypingSearch
              ownerSignupProfile={ownerSignupProfile}
              userDisplayName={profileDisplayName}
              ownerEmail={ownerEmail}
              restaurantName={selectedRestaurantName}
              onOpenSearch={onOpenSearch}
            />
          </div>
        </div>

        <div className="admin-top-actions ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5">
          <div className="admin-top-tools hidden items-center gap-0.5 rounded-xl border px-1 py-0.5 sm:flex">
            <AdminHoverBubble
              open={helpMenu.open}
              onOpenNow={helpMenu.openNow}
              onCloseSoon={helpMenu.closeSoon}
              arrow="center"
              panel={
                <>
                  <AdminBubbleHeader title={ADMIN_TOP_TOOL_HINTS.help.title} />
                  <div className="admin-bubble-body admin-bubble-body--menu">
                    {ADMIN_HELP_CATEGORIES.map((section) => (
                      <AdminBubbleMenuItem
                        key={section.id}
                        href={section.href}
                        title={section.label}
                        onClick={() => helpMenu.setOpen(false)}
                      />
                    ))}
                  </div>
                </>
              }
            >
              <button
                type="button"
                aria-expanded={helpMenu.open}
                aria-haspopup="menu"
                aria-label="Platform help"
                aria-current={isHelpNavActive(hash) ? "page" : undefined}
                className={`admin-top-tool-btn relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition ${
                  isHelpNavActive(hash) ? "admin-top-tool-btn--active" : ""
                }`}
              >
                <AdminTopToolIcon src={ADMIN_TOP_ICONS.help} />
              </button>
            </AdminHoverBubble>
            <AdminToolBubbleButton
              label="Staff management"
              src={ADMIN_TOP_ICONS.addUser}
              href={ADMIN_TOP_HASHES.addStaff}
              hint={ADMIN_TOP_TOOL_HINTS.addUser}
              active={hash === ADMIN_TOP_HASHES.addStaff}
            />
            <AdminHoverBubble
              open={notificationsMenu.open}
              onOpenNow={notificationsMenu.openNow}
              onCloseSoon={notificationsMenu.closeSoon}
              arrow="center"
              panel={
                <>
                  <AdminBubbleHeader title={ADMIN_TOP_TOOL_HINTS.notifications.title} />
                  <div className="admin-bubble-body admin-bubble-body--menu">
                    {ADMIN_NOTIFICATION_CATEGORIES.map((channel) => (
                      <AdminBubbleMenuItem
                        key={channel.id}
                        href={channel.href}
                        title={channel.label}
                        onClick={() => notificationsMenu.setOpen(false)}
                      />
                    ))}
                  </div>
                </>
              }
            >
              <button
                type="button"
                aria-expanded={notificationsMenu.open}
                aria-haspopup="menu"
                aria-label="Notifications"
                aria-current={isNotificationsNavActive(hash) ? "page" : undefined}
                className={`admin-top-tool-btn relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition ${
                  isNotificationsNavActive(hash) ? "admin-top-tool-btn--active" : ""
                }`}
              >
                <AdminTopToolIcon src={ADMIN_TOP_ICONS.notifications} />
                <span className="admin-top-tool-badge" />
              </button>
            </AdminHoverBubble>
            {canManageBilling ? (
              <AdminHoverBubble
                open={billingMenu.open}
                onOpenNow={billingMenu.openNow}
                onCloseSoon={billingMenu.closeSoon}
                arrow="center"
                panel={
                  <>
                    <AdminBubbleHeader title={ADMIN_TOP_TOOL_HINTS.billing.title} />
                    <div className="admin-bubble-body admin-bubble-body--menu">
                      {ADMIN_BILLING_CATEGORIES.map((section) => (
                        <AdminBubbleMenuItem
                          key={section.id}
                          href={section.href}
                          title={section.label}
                          onClick={() => billingMenu.setOpen(false)}
                        />
                      ))}
                    </div>
                  </>
                }
              >
                <button
                  type="button"
                  aria-expanded={billingMenu.open}
                  aria-haspopup="menu"
                  aria-label="Billing"
                  aria-current={isBillingNavActive(hash) ? "page" : undefined}
                  className={`admin-top-tool-btn relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition ${
                    isBillingNavActive(hash) ? "admin-top-tool-btn--active" : ""
                  }`}
                >
                  <AdminTopToolIcon src={ADMIN_TOP_ICONS.billing} />
                </button>
              </AdminHoverBubble>
            ) : null}
            <AdminHoverBubble
              open={quickMenu.open}
              onOpenNow={quickMenu.openNow}
              onCloseSoon={quickMenu.closeSoon}
              arrow="center"
              panel={
                <>
                  <AdminBubbleHeader
                    title={ADMIN_TOP_TOOL_HINTS.quickActions.title}
                    description={ADMIN_TOP_TOOL_HINTS.quickActions.description}
                  />
                  <div className="admin-bubble-body admin-bubble-body--menu">
                    <AdminBubbleThemeRow theme={theme} onToggle={onToggleTheme} />
                    {ADMIN_QUICK_LINKS.map((action) => (
                      <AdminBubbleMenuItem
                        key={action.id}
                        href={action.href}
                        title={action.label}
                        onClick={() => quickMenu.setOpen(false)}
                      />
                    ))}
                  </div>
                </>
              }
            >
              <button
                type="button"
                aria-expanded={quickMenu.open}
                aria-haspopup="menu"
                aria-label="Quick actions"
                className="admin-top-tool-btn flex h-9 w-9 items-center justify-center transition"
              >
                <AdminTopToolIcon src={ADMIN_TOP_ICONS.menu} />
              </button>
            </AdminHoverBubble>
          </div>

          <AdminHoverBubble
            open={profileMenu.open}
            onOpenNow={profileMenu.openNow}
            onCloseSoon={profileMenu.closeSoon}
            arrow="end"
            anchor="end"
            panel={
              <ProfileMenuPanel
                ownerEmail={ownerEmail}
                ownerDisplayName={profileDisplayName}
                onSignOut={onSignOut}
                onNavigate={() => profileMenu.setOpen(false)}
              />
            }
          >
            <button
              type="button"
              aria-expanded={profileMenu.open}
              aria-haspopup="menu"
              aria-current={profileActive ? "page" : undefined}
              className={`admin-profile-btn flex items-center gap-2 rounded-xl border py-1 pl-1 pr-2.5 transition ${profileActive ? "admin-profile-btn--active" : ""}`}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-blue-600 text-xs font-bold text-white shadow-sm">
                {profileInitial}
              </span>
              <span className="admin-profile-label hidden max-w-[9rem] truncate text-xs font-semibold lg:inline">
                {profileDisplayName}
              </span>
              <span className="hidden lg:inline">
                <NavChevron open={profileMenu.open} />
              </span>
            </button>
          </AdminHoverBubble>
        </div>
      </div>

      <div className="admin-top-mobile-row flex items-center gap-2 px-3 py-2 sm:hidden">
        <select
          aria-label="Current restaurant"
          value={selectedRestaurantId}
          disabled={restaurants.length === 0 || venueSwitching}
          onChange={(e) => onSelectRestaurant(e.target.value)}
          className="admin-restaurant-switcher min-w-0 flex-1 truncate rounded-xl px-3 py-2 text-xs font-semibold"
        >
          <option value="">{restaurants.length === 0 ? "No venues" : venueSwitching ? "Switching…" : "Select venue…"}</option>
          {restaurants.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>
    </header>
  );
}

export function AdminWorkspaceShell({
  children,
  restaurants,
  selectedRestaurantId,
  onSelectRestaurant,
  ownerSignupProfile,
  ownerEmail,
  userDisplayName,
  canManageBilling = false,
  theme,
  onToggleTheme,
  onLogoPress,
  onSignOut,
  venueSwitching
}: {
  children: ReactNode;
  restaurants: Restaurant[];
  selectedRestaurantId: string;
  onSelectRestaurant: (id: string) => void;
  ownerSignupProfile?: unknown;
  ownerEmail?: string | null;
  userDisplayName?: string;
  canManageBilling?: boolean;
  theme: AdminTheme;
  onToggleTheme: () => void;
  onLogoPress: () => void;
  onSignOut: () => void;
  venueSwitching?: boolean;
}) {
  const { pinned, setPinned } = useAdminSidebarPinned();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [sideExpanded, setSideExpanded] = useState(() => readSidebarPinned());
  const shellDisplayName =
    userDisplayName?.trim() ||
    readUserDisplayName({
      email: ownerEmail ?? undefined,
      signupProfile: ownerSignupProfile
    });
  const selectedRestaurantName = restaurants.find((r) => r.id === selectedRestaurantId)?.name ?? "";

  return (
    <div
      className={`admin-workspace min-h-[100dvh] ${sideExpanded ? "admin-workspace--side-expanded" : ""}`}
    >
      <AdminTopNav
        restaurants={restaurants}
        selectedRestaurantId={selectedRestaurantId}
        onSelectRestaurant={onSelectRestaurant}
        ownerSignupProfile={ownerSignupProfile}
        ownerEmail={ownerEmail}
        userDisplayName={shellDisplayName}
        canManageBilling={canManageBilling}
        theme={theme}
        onToggleTheme={onToggleTheme}
        onLogoPress={onLogoPress}
        onSignOut={onSignOut}
        onOpenMobileNav={() => setMobileNavOpen(true)}
        onOpenSearch={() => setSearchOpen(true)}
        venueSwitching={venueSwitching}
      />

      <AdminGlobalSearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        restaurantName={selectedRestaurantName}
        ownerName={shellDisplayName}
      />

      <AdminSideNav pinned={pinned} onPinnedChange={setPinned} onExpandedChange={setSideExpanded} />
      <AdminSideNav
        variant="mobile"
        pinned={false}
        onPinnedChange={() => {}}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />

      <div className="admin-workspace-main">
        {children}
      </div>
    </div>
  );
}
