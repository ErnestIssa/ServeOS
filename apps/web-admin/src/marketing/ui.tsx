import type { ReactNode } from "react";
import { DEMO_MAILTO, WEB_ADMIN_URL } from "./constants";
import { glassPanel, eyebrow, sectionTitle, btnPrimary, btnSecondary } from "./styles";

export function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "auto", block: "start" });
}

export function SectionEyebrow({ children }: { children: ReactNode }) {
  return <p className={eyebrow}>{children}</p>;
}

export function SectionTitle({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h2 className={`${sectionTitle} ${className}`}>{children}</h2>;
}

export function OsCard({
  title,
  children,
  className = "",
  icon
}: {
  title: string;
  children: ReactNode;
  className?: string;
  icon?: string;
}) {
  return (
    <article className={`${glassPanel} p-6 ${className}`}>
      {icon ? (
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-100/90 to-blue-100/90 text-sm font-bold text-violet-800">
          {icon}
        </div>
      ) : null}
      <h3 className={`text-base font-bold text-slate-900 ${icon ? "mt-3" : ""}`}>{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{children}</p>
    </article>
  );
}

export function BtnPrimary({
  children,
  onClick,
  className = ""
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button type="button" onClick={onClick} className={`${btnPrimary} ${className}`}>
      {children}
    </button>
  );
}

export function BtnSecondary({
  children,
  onClick,
  className = ""
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button type="button" onClick={onClick} className={`${btnSecondary} ${className}`}>
      {children}
    </button>
  );
}

export function startFreeTrial() {
  if (WEB_ADMIN_URL) {
    window.open(WEB_ADMIN_URL, "_blank", "noopener,noreferrer");
    return;
  }
  scrollToId("pricing");
}

export function bookDemo() {
  window.location.href = DEMO_MAILTO;
}

export function loginControlCenter() {
  if (WEB_ADMIN_URL) {
    window.open(WEB_ADMIN_URL, "_blank", "noopener,noreferrer");
    return;
  }
  scrollToId("final-cta");
}
