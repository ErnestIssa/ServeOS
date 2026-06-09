import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ServeOsWordmark } from "../signup/SignupShell";
import {
  ADMIN_NAV_GROUPS,
  ADMIN_QUICK_ACTIONS,
  ADMIN_THEME_ICONS,
  ADMIN_TOP_ICONS,
  ADMIN_TOP_TOOL_HINTS,
  defaultGroupHref,
  readAdminHash,
  readAdminTheme,
  readOwnerContactName,
  readSidebarPinned,
  writeAdminTheme,
  writeSidebarPinned,
  type AdminNavGroup,
  type AdminTheme
} from "./adminNavContent";
import { AdminRestaurantSelector, AdminTypingSearch } from "./adminTopChrome";
import { FOOTER_SUPPORT_EMAIL } from "../marketing/footerContent";
import { ADMIN_WORKSPACE_FAB, fabToneClasses } from "../marketing/fabTone";
import { useAdminWorkspaceFabTone } from "../marketing/useAdminWorkspaceFabTone";

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

export function AdminThemeFab({ theme, onToggle }: { theme: AdminTheme; onToggle: () => void }) {
  const isDark = theme === "dark";
  const fabTone = useAdminWorkspaceFabTone(true);
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      data-admin-theme-fab-tone={fabTone}
      className={`admin-theme-fab fixed z-[90] flex h-14 w-14 items-center justify-center rounded-full border backdrop-blur-md transition-all duration-300 hover:scale-110 ${ADMIN_WORKSPACE_FAB.theme} ${fabToneClasses(fabTone)}`}
    >
      <img
        src={isDark ? ADMIN_THEME_ICONS.dark : ADMIN_THEME_ICONS.light}
        alt=""
        className={`object-contain ${isDark ? "h-7 w-7" : "h-6 w-6"} ${
          fabTone === "dark" ? "brightness-0 invert" : "brightness-0 contrast-125"
        }`}
      />
    </button>
  );
}

function isItemActive(href: string, hash: string) {
  if (!hash) return href === "#control-room";
  return href === hash;
}

function isGroupActive(group: AdminNavGroup, hash: string) {
  return group.items.some((item) => isItemActive(item.href, hash));
}

function NavGroupIcon({ src }: { src: string }) {
  return <img src={src} alt="" className="admin-side-group-icon-img" draggable={false} />;
}

function NavGroupBlock({
  group,
  groupIndex,
  hash,
  expanded,
  onNavigate
}: {
  group: AdminNavGroup;
  groupIndex: number;
  hash: string;
  expanded: boolean;
  onNavigate?: () => void;
}) {
  const groupActive = isGroupActive(group, hash);
  const groupHref = defaultGroupHref(group);

  return (
    <div
      className="admin-side-group"
      style={{ "--nav-group-index": groupIndex } as CSSProperties}
    >
      <a
        href={groupHref}
        title={group.label}
        onClick={onNavigate}
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
      </a>
      <ul className="admin-side-group-items" aria-hidden={!expanded}>
        {group.items.map((item, itemIndex) => {
          const active = isItemActive(item.href, hash);
          return (
            <li
              key={item.id}
              className="admin-side-group-item"
              style={{ "--nav-item-index": itemIndex } as CSSProperties}
            >
              <a
                href={item.href}
                onClick={onNavigate}
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
  variant = "desktop"
}: {
  pinned: boolean;
  onPinnedChange: (pinned: boolean) => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  variant?: "desktop" | "mobile";
}) {
  const [hovered, setHovered] = useState(false);
  const [hash, setHash] = useState(readAdminHash);
  const navRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const savedScrollTop = useRef(0);

  useEffect(() => {
    const onHash = () => setHash(readAdminHash());
    window.addEventListener("hashchange", onHash);
    onHash();
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const expanded = pinned || hovered || variant === "mobile";
  const isMobile = variant === "mobile";
  const lockPageScroll = isMobile ? mobileOpen : hovered;

  useEffect(() => {
    const root = document.documentElement;
    if (!lockPageScroll) {
      root.classList.remove("admin-side-scroll-lock");
      return;
    }
    root.classList.add("admin-side-scroll-lock");
    return () => root.classList.remove("admin-side-scroll-lock");
  }, [lockPageScroll]);

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
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    const active =
      scrollEl.querySelector<HTMLElement>('.admin-side-link[aria-current="page"]') ??
      scrollEl.querySelector<HTMLElement>(".admin-side-link--active");
    if (!active) return;

    const pad = 14;
    const scrollRect = scrollEl.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();

    if (activeRect.top < scrollRect.top + pad) {
      scrollEl.scrollTop -= scrollRect.top + pad - activeRect.top;
    } else if (activeRect.bottom > scrollRect.bottom - pad) {
      scrollEl.scrollTop += activeRect.bottom - (scrollRect.bottom - pad);
    }
    savedScrollTop.current = scrollEl.scrollTop;
  }, [hash]);

  function restoreNavScroll() {
    const scrollEl = scrollRef.current;
    if (scrollEl) scrollEl.scrollTop = savedScrollTop.current;
  }

  function handleNavMouseEnter() {
    if (isMobile) return;
    setHovered(true);
    window.requestAnimationFrame(() => {
      restoreNavScroll();
      window.setTimeout(restoreNavScroll, 420);
    });
  }

  function handleNavMouseLeave() {
    if (isMobile) return;
    const scrollEl = scrollRef.current;
    if (scrollEl) savedScrollTop.current = scrollEl.scrollTop;
    setHovered(false);
  }

  function togglePin() {
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
            />
          ))}
        </div>
      </div>

      <div className="admin-side-pin-row relative border-t p-2">
        <button
          type="button"
          onClick={togglePin}
          title={pinned ? "Unpin sidebar" : "Pin sidebar open"}
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
          className={`admin-side-mobile-backdrop fixed inset-0 z-[65] bg-slate-950/50 backdrop-blur-[2px] transition-opacity lg:hidden ${
            mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          onClick={onMobileClose}
          aria-hidden={!mobileOpen}
        />
        <aside
          className={`admin-side-mobile-drawer fixed bottom-0 left-0 top-0 z-[66] transition-transform duration-300 lg:hidden ${
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
      className={`admin-side-shell fixed bottom-0 left-0 z-[60] hidden lg:block ${
        pinned ? "admin-side-shell--pinned" : ""
      }`}
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

function AdminBubbleHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="admin-bubble-header">
      <p className="admin-bubble-title">{title}</p>
      {description ? <p className="admin-bubble-desc">{description}</p> : null}
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
  return (
    <div className="relative" onMouseEnter={onOpenNow} onMouseLeave={onCloseSoon}>
      {children}
      {open ? (
        <div
          className={`admin-top-bubble-anchor admin-top-bubble-anchor--${anchor}`.trim()}
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
  arrow = "center"
}: {
  src: string;
  label: string;
  badge?: boolean;
  href: string;
  hint: { title: string; description: string; cta: string };
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
      <a href={href} aria-label={label} className="admin-top-tool-btn relative flex h-9 w-9 shrink-0 items-center justify-center transition">
        <AdminTopToolIcon src={src} />
        {badge ? <span className="admin-top-tool-badge" /> : null}
      </a>
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
      <AdminBubbleHeader title={ADMIN_TOP_TOOL_HINTS.profile.title} description={ADMIN_TOP_TOOL_HINTS.profile.description} />
      {ownerEmail ? <p className="admin-profile-menu-email truncate px-3 pb-1 text-[11px]">{ownerEmail}</p> : null}
      <div className="admin-bubble-body admin-bubble-body--menu">
        <AdminBubbleMenuItem
          href="#config-restaurant"
          title="Account"
          description={ownerDisplayName}
          onClick={onNavigate}
        />
        <AdminBubbleMenuItem
          href="#config-restaurant"
          title="Settings"
          description="Restaurant configuration"
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
  onLogoPress,
  onSignOut,
  onOpenMobileNav,
  venueSwitching
}: {
  restaurants: Restaurant[];
  selectedRestaurantId: string;
  onSelectRestaurant: (id: string) => void;
  ownerSignupProfile?: unknown;
  ownerEmail?: string | null;
  onLogoPress: () => void;
  onSignOut: () => void;
  onOpenMobileNav?: () => void;
  venueSwitching?: boolean;
}) {
  const quickMenu = useHoverMenu();
  const profileMenu = useHoverMenu();

  const ownerDisplayName = readOwnerContactName(ownerSignupProfile);
  const ownerInitial = (ownerDisplayName.charAt(0) || "O").toUpperCase();
  const selectedRestaurantName = restaurants.find((r) => r.id === selectedRestaurantId)?.name ?? "";
  const platformHelpHref = `mailto:${FOOTER_SUPPORT_EMAIL}?subject=ServeOS%20platform%20help`;

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
            <AdminTypingSearch ownerSignupProfile={ownerSignupProfile} restaurantName={selectedRestaurantName} />
          </div>
        </div>

        <div className="admin-top-actions ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5">
          <div className="admin-top-tools hidden items-center gap-0.5 rounded-xl border px-1 py-0.5 sm:flex">
            <AdminToolBubbleButton
              label="Platform help"
              src={ADMIN_TOP_ICONS.help}
              href={platformHelpHref}
              hint={ADMIN_TOP_TOOL_HINTS.help}
            />
            <AdminToolBubbleButton
              label="Add staff"
              src={ADMIN_TOP_ICONS.addUser}
              href="#config-staff"
              hint={ADMIN_TOP_TOOL_HINTS.addUser}
            />
            <AdminToolBubbleButton
              label="Notifications"
              src={ADMIN_TOP_ICONS.notifications}
              href="#control-alerts"
              hint={ADMIN_TOP_TOOL_HINTS.notifications}
              badge
            />
            <AdminToolBubbleButton
              label="Billing"
              src={ADMIN_TOP_ICONS.billing}
              href="#config-payments"
              hint={ADMIN_TOP_TOOL_HINTS.billing}
            />
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
                    <AdminBubbleKicker>{ADMIN_TOP_TOOL_HINTS.quickActions.kicker}</AdminBubbleKicker>
                    {ADMIN_QUICK_ACTIONS.map((action) => (
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
                ownerDisplayName={ownerDisplayName}
                onSignOut={onSignOut}
                onNavigate={() => profileMenu.setOpen(false)}
              />
            }
          >
            <button
              type="button"
              aria-expanded={profileMenu.open}
              aria-haspopup="menu"
              className="admin-profile-btn flex items-center gap-2 rounded-xl border py-1 pl-1 pr-2.5 transition"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-blue-600 text-xs font-bold text-white shadow-sm">
                {ownerInitial}
              </span>
              <span className="admin-profile-label hidden max-w-[9rem] truncate text-xs font-semibold lg:inline">
                {ownerDisplayName}
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
  onLogoPress: () => void;
  onSignOut: () => void;
  venueSwitching?: boolean;
}) {
  const { pinned, setPinned } = useAdminSidebarPinned();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="admin-workspace min-h-[100dvh]">
      <AdminTopNav
        restaurants={restaurants}
        selectedRestaurantId={selectedRestaurantId}
        onSelectRestaurant={onSelectRestaurant}
        ownerSignupProfile={ownerSignupProfile}
        ownerEmail={ownerEmail}
        onLogoPress={onLogoPress}
        onSignOut={onSignOut}
        onOpenMobileNav={() => setMobileNavOpen(true)}
        venueSwitching={venueSwitching}
      />

      <AdminSideNav pinned={pinned} onPinnedChange={setPinned} />
      <AdminSideNav
        variant="mobile"
        pinned={false}
        onPinnedChange={() => {}}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />

      <div className={`admin-workspace-main transition-[margin] duration-300 ease-out ${pinned ? "admin-workspace-main--pinned" : ""}`}>
        {children}
      </div>
    </div>
  );
}
