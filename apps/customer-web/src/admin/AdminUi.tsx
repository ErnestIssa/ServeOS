import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { ServeOsWordmark } from "../signup/SignupShell";
import { btnPrimary, btnSecondary, contentWrap, eyebrow, glassPanel, pageGutter, sectionTitle } from "../marketing/styles";

export const adminMain = `relative mx-auto w-full max-w-6xl pb-28 pt-6 lg:max-w-none lg:pb-10 lg:pt-8 ${pageGutter}`;

export const inputBase =
  "w-full rounded-xl border border-slate-200/90 bg-white/90 px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-200/60 disabled:cursor-not-allowed disabled:opacity-50";

export const labelCls = "grid gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500";

export const subPanelCls =
  "rounded-xl border border-slate-200/80 bg-white/85 p-5 shadow-[0_2px_12px_rgba(15,23,42,0.04)]";

export const btnPrimarySm =
  "rounded-full bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-2 text-xs font-bold text-white shadow-[0_4px_16px_rgba(124,58,237,0.22)] transition hover:from-violet-500 hover:to-blue-500 disabled:cursor-not-allowed disabled:opacity-45";

export const btnSecondarySm =
  "rounded-full border border-slate-200/80 bg-white/80 px-4 py-2 text-xs font-bold text-slate-700 backdrop-blur-md transition hover:border-violet-200 hover:bg-white disabled:cursor-not-allowed disabled:opacity-45";

export function AdminHeader({
  signedIn,
  activeVenue,
  onSignOut,
  onHome
}: {
  signedIn: boolean;
  activeVenue?: string;
  onSignOut: () => void;
  onHome?: () => void;
}) {
  const navLink =
    "rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-white/60 hover:text-violet-800";

  return (
    <header className={`sticky top-0 z-50 ${pageGutter} pt-4 sm:pt-5`}>
      <div
        className={`${contentWrap} flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/50 bg-white/55 px-4 py-3 shadow-[0_8px_32px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:px-5`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={onHome} className="text-xl sm:text-2xl">
            <ServeOsWordmark />
          </button>
          <span className="rounded-full border border-violet-200/70 bg-gradient-to-r from-violet-50 to-blue-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-violet-800">
            Admin
          </span>
        </div>

        {signedIn ? (
          <nav className="hidden items-center gap-1 md:flex" aria-label="Admin sections">
            <a href="#menu-admin" className={navLink}>
              Menu
            </a>
            <a href="#orders" className={navLink}>
              Orders
            </a>
          </nav>
        ) : null}

        <div className="flex items-center gap-2 sm:gap-3">
          {signedIn && activeVenue ? (
            <span className="hidden max-w-[12rem] truncate text-xs font-medium text-slate-500 sm:inline">
              {activeVenue}
            </span>
          ) : null}
          {signedIn ? (
            <button type="button" onClick={onSignOut} className={btnSecondarySm}>
              Sign out
            </button>
          ) : (
            <span className="text-xs text-slate-500">Sign in to manage your venues</span>
          )}
        </div>
      </div>
    </header>
  );
}

export function AdminPanel({ id, children, className = "" }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <section
      id={id}
      className={`scroll-mt-28 ${glassPanel} p-6 shadow-[0_16px_50px_rgba(15,23,42,0.06)] backdrop-blur-xl sm:p-7 lg:scroll-mt-24 ${className}`}
    >
      {children}
    </section>
  );
}

export function AdminSectionHeader({
  eyebrowText,
  title,
  description,
  action
}: {
  eyebrowText?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        {eyebrowText ? <p className={eyebrow}>{eyebrowText}</p> : null}
        <h2 className={`${sectionTitle} ${eyebrowText ? "" : "mt-0"} text-2xl sm:text-3xl`}>{title}</h2>
        {description ? <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function AdminWelcomeBanner() {
  return (
    <div className="rounded-2xl border border-violet-200/60 bg-gradient-to-br from-violet-50/90 via-white/80 to-blue-50/90 p-5 shadow-[0_8px_28px_rgba(124,58,237,0.12)] backdrop-blur-md sm:p-6">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-violet-700/90">Workspace ready</p>
      <p className="mt-2 font-display text-lg font-bold text-slate-900 sm:text-xl">You&apos;re signed in</p>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
        Manage your venues, menu, and live orders below. Your session stays active in this browser.
      </p>
    </div>
  );
}

export function AdminLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <label className={`${labelCls} ${className}`}>{children}</label>;
}

export function AdminInput({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${inputBase} ${className}`} {...props} />;
}

export function AdminSelect({ className = "", children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${inputBase} ${className}`} {...props}>
      {children}
    </select>
  );
}

export function AdminBtnPrimary({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={`${btnPrimarySm} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function AdminBtnSecondary({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={`${btnSecondarySm} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function AdminBtnPrimaryLg({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={`${btnPrimary} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function AdminBtnSecondaryLg({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={`${btnSecondary} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function AdminStatusLine({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p className="rounded-xl border border-slate-200/80 bg-white/70 px-3 py-2 text-xs font-medium text-slate-600">
      {children}
    </p>
  );
}

export function AdminVenueCard({ name, id, role }: { name: string; id: string; role: string }) {
  return (
    <div className={`${subPanelCls} flex flex-col gap-1`}>
      <div className="font-display text-sm font-bold text-slate-900">{name}</div>
      <div className="break-all font-mono text-[11px] text-slate-500">ID: {id}</div>
      <div className="text-xs text-slate-500">Role: {role}</div>
    </div>
  );
}

export function AdminEmptyState({ children }: { children: ReactNode }) {
  return <p className="text-sm text-slate-500">{children}</p>;
}
