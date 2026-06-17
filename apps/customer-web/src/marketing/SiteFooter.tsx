import type { ReactNode } from "react";
import {
  FOOTER_ADDRESS_LINES,
  FOOTER_APP_STORES,
  FOOTER_HOURS,
  FOOTER_LEGAL,
  FOOTER_LINK_COLUMNS,
  FOOTER_LINK_HOVER,
  FOOTER_PHONE_DISPLAY,
  FOOTER_SECTION_TITLE,
  FOOTER_SOCIAL,
  FOOTER_SUPPORT_EMAIL,
  type FooterLinkGroup,
  type FooterLinkItem
} from "./footerContent";
import type { LegalSlug } from "../legal/legalRoutes";
import { runNavAction, type NavHandlers } from "./navActions";
import { contentWrap, pageGutter } from "./styles";

type Props = {
  onHowItWorks: () => void;
  onGoLegal?: (slug: LegalSlug) => void;
};

function ServeOsLogo({ className = "text-2xl" }: { className?: string }) {
  return (
    <p className={`font-display font-extrabold tracking-tight text-white ${className}`}>
      Serve<span className="text-violet-400">OS</span>
    </p>
  );
}

function FooterColumn({ group, handlers }: { group: FooterLinkGroup; handlers: NavHandlers }) {
  return (
    <div>
      <h3 className={FOOTER_SECTION_TITLE}>{group.title}</h3>
      <ul className="mt-4 space-y-2.5">
        {group.items.map((item) => (
          <li key={item.label}>
            <FooterLink item={item} handlers={handlers} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function FooterLink({ item, handlers }: { item: FooterLinkItem; handlers: NavHandlers }) {
  return (
    <button
      type="button"
      className={`text-sm text-slate-400 hover:text-white ${FOOTER_LINK_HOVER}`}
      onClick={() => runNavAction(item.action, handlers)}
    >
      {item.label}
    </button>
  );
}

function FooterBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className={FOOTER_SECTION_TITLE}>{title}</h3>
      <div className="mt-4">{children}</div>
    </div>
  );
}

export function SiteFooter({ onHowItWorks, onGoLegal }: Props) {
  const handlers: NavHandlers = { onHowItWorks, onGoLegal };
  const year = new Date().getFullYear();

  return (
    <footer data-marketing-footer className="relative mt-8 border-t border-slate-800/80 bg-slate-950 text-slate-400">
      <div className={`${contentWrap} ${pageGutter} py-14 lg:py-16`}>
        <div className="max-w-xl border-b border-slate-800 pb-10 lg:max-w-2xl">
          <ServeOsLogo className="text-2xl" />
          <p className="mt-3 text-base font-semibold text-slate-200">Powering modern restaurant operations</p>
        </div>

        <div className="mt-10 grid gap-10 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {FOOTER_LINK_COLUMNS.map((group) => (
            <FooterColumn key={group.id} group={group} handlers={handlers} />
          ))}
        </div>

        <div className="mt-12 grid gap-10 border-t border-slate-800 pt-10 lg:grid-cols-3 lg:gap-12">
          <FooterBlock title="Contact information">
            <div className="space-y-5 text-sm">
              <div>
                <p className="font-semibold text-slate-200">Headquarters</p>
                <p className="mt-1 text-slate-400">
                  {FOOTER_ADDRESS_LINES.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </p>
              </div>
              <div>
                <p className="font-semibold text-slate-200">Contact us</p>
                <p className="mt-2 text-slate-400">{FOOTER_HOURS}</p>
                <p className="mt-2">
                  <span className="text-slate-500">Phone: </span>
                  <span className="text-slate-300">{FOOTER_PHONE_DISPLAY}</span>
                </p>
                <p className="mt-1">
                  <span className="text-slate-500">Email: </span>
                  <a
                    href={`mailto:${FOOTER_SUPPORT_EMAIL}`}
                    className={`text-violet-300 hover:text-violet-200 ${FOOTER_LINK_HOVER}`}
                  >
                    {FOOTER_SUPPORT_EMAIL}
                  </a>
                </p>
                <p className="mt-2 text-slate-500">
                  Live chat: available during support hours through the platform.
                </p>
              </div>
            </div>
          </FooterBlock>

          <FooterBlock title="Follow us">
            <ul className="flex flex-wrap items-center gap-4">
              {FOOTER_SOCIAL.map((s) => (
                <li key={s.label}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    className="inline-flex rounded-lg p-1 transition duration-200 hover:scale-110 hover:opacity-90"
                  >
                    <img
                      src={s.iconSrc}
                      alt=""
                      width={32}
                      height={32}
                      className="h-8 w-8 object-contain"
                      aria-hidden
                    />
                  </a>
                </li>
              ))}
            </ul>
          </FooterBlock>

          <FooterBlock title="Download the app">
            <p className="mb-3 text-sm font-semibold text-slate-300">Mobile app</p>
            <div className="flex flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
              {FOOTER_APP_STORES.map((store) => (
                <a
                  key={store.shortLabel}
                  href={store.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={store.label}
                  className="inline-flex items-center justify-center gap-2.5 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-slate-600 hover:bg-slate-800"
                >
                  <img
                    src={store.iconSrc}
                    alt=""
                    width={20}
                    height={20}
                    className={store.iconClass}
                    aria-hidden
                  />
                  {store.shortLabel}
                </a>
              ))}
            </div>
          </FooterBlock>
        </div>

        <div className="mt-10 flex flex-col gap-8 border-t border-slate-800 pt-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <h3 className={FOOTER_SECTION_TITLE}>Legal</h3>
            <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
              {FOOTER_LEGAL.map((item) => (
                <li key={item.label}>
                  <FooterLink item={item} handlers={handlers} />
                </li>
              ))}
            </ul>
          </div>
          <div className="shrink-0 sm:pt-0.5">
            <ServeOsLogo className="text-xl sm:text-2xl" />
          </div>
        </div>

        <div className="mt-10 border-t border-slate-800 pt-8 text-center text-xs text-slate-500">
          <p className="text-slate-400">© {year} ServeOS. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
