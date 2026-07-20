import { AmbientWebShell } from "@serveos/core-ambient";
import { useCallback, useEffect, useState } from "react";
import { AdminDashboardPage } from "./admin/AdminDashboardPage";
import { AccountLoginPage } from "./AccountLoginPage";
import { CommunicationPreferencesPage } from "./CommunicationPreferencesPage";
import { EmailTemplateGallery } from "./emails/EmailTemplateGallery";
import { WorkspaceEnrollmentPage } from "./enrollment/WorkspaceEnrollmentPage";
import { AccountSignupPage } from "./AccountSignupPage";
import { guardAppView, resolveAppViewForSession } from "./adminSessionGuard";
import {
  type AppView,
  legalSlugFromPath,
  syncUrlForLegal,
  syncUrlForView,
  viewFromPath
} from "./appNavigation";
import { hasInviteTokenInLocation } from "./inviteToken";
import { ADMIN_SESSION_EVENT, hasActiveAdminSession } from "./authStorage";
import { HowServeOSWorksPage } from "./HowServeOSWorksPage";
import { LandingPage } from "./LandingPage";
import { LegalPageView } from "./legal/LegalPageView";
import type { LegalSlug } from "./legal/legalRoutes";
import { pathForLegalSlug } from "./legal/legalRoutes";
import { ADMIN_WORKSPACE_FAB } from "./marketing/fabTone";
import { SupportPopup } from "./marketing/SupportPopup";
import { useSupportPopup } from "./marketing/useSupportPopup";
import { scrollToId } from "./marketing/ui";
import { GuestOrderingPage } from "./guest/GuestOrderingPage";
import { guestSessionIdFromPathname } from "./appNavigation";
import { useForbidButtonTitleTooltips } from "./lib/forbidButtonTitleTooltips";

export function App() {
  useForbidButtonTitleTooltips();
  const [view, setView] = useState<AppView>(() => resolveAppViewForSession(window.location.pathname));
  const [legalSlug, setLegalSlug] = useState<LegalSlug>(() => legalSlugFromPath(window.location.pathname));
  const [adminSession, setAdminSession] = useState(() => hasActiveAdminSession());
  const { isVisible: isSupportVisible, onOpen: onSupportOpen, onClose: onSupportClose } = useSupportPopup();

  useEffect(() => {
    const path = window.location.pathname.replace(/\/+$/, "") || "/";
    const slug = legalSlugFromPath(path);
    const canonical = pathForLegalSlug(slug);
    if (viewFromPath(path) === "legal" && path !== canonical) {
      syncUrlForLegal(slug, true);
    }
    if (viewFromPath(path) === "invite-accept" || (path === "/" && hasInviteTokenInLocation())) {
      syncUrlForView("invite-accept", true);
    }
    if (viewFromPath(path) === "login") {
      syncUrlForView("login", true);
    }
  }, []);

  useEffect(() => {
    const sync = () => setAdminSession(hasActiveAdminSession());
    window.addEventListener(ADMIN_SESSION_EVENT, sync);
    return () => window.removeEventListener(ADMIN_SESSION_EVENT, sync);
  }, []);

  useEffect(() => {
    setAdminSession(hasActiveAdminSession());
  }, [view]);

  const setAppView = useCallback((next: AppView, replace = false, slug: LegalSlug = "center") => {
    const guarded = guardAppView(next);
    setView(guarded);
    if (guarded === "legal") {
      setLegalSlug(slug);
      syncUrlForView("legal", replace || guarded !== next, slug);
    } else {
      syncUrlForView(guarded, replace || guarded !== next);
    }
    if (guarded !== "landing") window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  useEffect(() => {
    const onPopState = () => {
      const path = window.location.pathname;
      const next = resolveAppViewForSession(path);
      if (next === "legal") {
        setLegalSlug(legalSlugFromPath(path));
      }
      if (next !== viewFromPath(path)) {
        if (next === "legal") syncUrlForLegal(legalSlugFromPath(path), true);
        else syncUrlForView(next, true);
      }
      setView(next);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (!adminSession) return;
    if (viewFromPath(window.location.pathname) === "preferences") return;
    if (viewFromPath(window.location.pathname) === "email-templates") return;
    if (viewFromPath(window.location.pathname) === "invite-accept") return;
    if (viewFromPath(window.location.pathname) === "guest-order") return;
    setView("admin");
    if (viewFromPath(window.location.pathname) !== "admin") {
      syncUrlForView("admin", true);
    }
  }, [adminSession]);

  function goLanding(sectionId?: string) {
    setAppView("landing");
    if (sectionId) {
      requestAnimationFrame(() => scrollToId(sectionId));
    }
  }

  function goPricing() {
    if (view === "landing") scrollToId("pricing");
    else goLanding("pricing");
  }

  function goSignup() {
    setAppView("signup");
  }

  function goLogin() {
    setAppView("login");
  }

  function goLegal(slug: LegalSlug) {
    setAppView("legal", false, slug);
  }

  return (
    <AmbientWebShell variant="customer" parallax={false} className="font-ui">
      {view === "landing" ? (
        <LandingPage
          onHowItWorks={() => setAppView("how-it-works")}
          onFindSetup={goSignup}
          onGoLegal={goLegal}
        />
      ) : null}
      {view === "how-it-works" ? (
        <HowServeOSWorksPage
          onHome={() => goLanding("top")}
          onGoFeatures={() => goLanding("features")}
          onGoPricing={() => goLanding("pricing")}
          onGoLogin={goLogin}
          onGoLegal={goLegal}
        />
      ) : null}
      {view === "legal" ? (
        <LegalPageView
          slug={legalSlug}
          onHome={() => goLanding("top")}
          onHowItWorks={() => setAppView("how-it-works")}
          onGoPricing={goPricing}
          onGoLogin={goLogin}
          onGoLegal={goLegal}
        />
      ) : null}
      {view === "signup" ? <AccountSignupPage onBack={() => goLanding("pricing")} onGoLogin={goLogin} /> : null}
      {view === "login" ? (
        <AccountLoginPage onBack={() => goLanding("top")} onGoSignup={goSignup} />
      ) : null}
      {view === "preferences" ? (
        <CommunicationPreferencesPage onBack={() => goLanding("top")} />
      ) : null}
      {view === "email-templates" ? <EmailTemplateGallery onBack={() => goLanding("top")} /> : null}
      {view === "invite-accept" ? (
        <WorkspaceEnrollmentPage onBack={() => goLanding("top")} onGoLogin={goLogin} />
      ) : null}
      {view === "admin" ? <AdminDashboardPage onAfterLogout={() => goLanding("top")} /> : null}
      {view === "guest-order" ? (
        <GuestOrderingPage
          sessionId={guestSessionIdFromPathname(window.location.pathname) ?? ""}
          onHome={() => goLanding("top")}
        />
      ) : null}

      <SupportPopup
        isVisible={isSupportVisible}
        onOpen={onSupportOpen}
        onClose={onSupportClose}
        workspaceLocked={adminSession}
        adminWorkspaceChrome={view === "admin"}
        marketingScrollTone={view !== "admin"}
        fabClassName={view === "admin" ? ADMIN_WORKSPACE_FAB.support : undefined}
        onHowItWorks={
          adminSession
            ? undefined
            : view === "how-it-works"
              ? () => scrollToId("top")
              : view === "admin"
                ? undefined
                : () => setAppView("how-it-works")
        }
        onViewPricing={adminSession ? undefined : goPricing}
        onFindSetup={adminSession ? undefined : goSignup}
      />
    </AmbientWebShell>
  );
}
