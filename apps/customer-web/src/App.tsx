import { AmbientWebShell } from "@serveos/core-ambient";
import { useCallback, useEffect, useState } from "react";
import { AdminDashboardPage } from "./admin/AdminDashboardPage";
import { AccountLoginPage } from "./AccountLoginPage";
import { AccountSignupPage } from "./AccountSignupPage";
import { guardAppView, resolveAppViewForSession } from "./adminSessionGuard";
import { type AppView, syncUrlForView, viewFromPath } from "./appNavigation";
import { ADMIN_SESSION_EVENT, hasActiveAdminSession } from "./authStorage";
import { HowServeOSWorksPage } from "./HowServeOSWorksPage";
import { LandingPage } from "./LandingPage";
import { ADMIN_WORKSPACE_FAB } from "./marketing/fabTone";
import { SupportPopup } from "./marketing/SupportPopup";
import { useSupportPopup } from "./marketing/useSupportPopup";
import { scrollToId } from "./marketing/ui";

export function App() {
  const [view, setView] = useState<AppView>(() => resolveAppViewForSession(window.location.pathname));
  const [adminSession, setAdminSession] = useState(() => hasActiveAdminSession());
  const { isVisible: isSupportVisible, onOpen: onSupportOpen, onClose: onSupportClose } = useSupportPopup();

  useEffect(() => {
    const sync = () => setAdminSession(hasActiveAdminSession());
    window.addEventListener(ADMIN_SESSION_EVENT, sync);
    return () => window.removeEventListener(ADMIN_SESSION_EVENT, sync);
  }, []);

  useEffect(() => {
    setAdminSession(hasActiveAdminSession());
  }, [view]);

  const setAppView = useCallback((next: AppView, replace = false) => {
    const guarded = guardAppView(next);
    setView(guarded);
    syncUrlForView(guarded, replace || guarded !== next);
    if (guarded !== "landing") window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  useEffect(() => {
    const onPopState = () => {
      const next = resolveAppViewForSession(window.location.pathname);
      if (next !== viewFromPath(window.location.pathname)) {
        syncUrlForView(next, true);
      }
      setView(next);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (!adminSession) return;
    const pathView = viewFromPath(window.location.pathname);
    if (pathView !== "admin") {
      setView("admin");
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

  return (
    <AmbientWebShell variant="customer" parallax={false} className="font-ui">
      {view === "landing" ? (
        <LandingPage onHowItWorks={() => setAppView("how-it-works")} onFindSetup={goSignup} />
      ) : null}
      {view === "how-it-works" ? (
        <HowServeOSWorksPage
          onHome={() => goLanding("top")}
          onGoFeatures={() => goLanding("features")}
          onGoPricing={() => goLanding("pricing")}
          onGoLogin={goLogin}
        />
      ) : null}
      {view === "signup" ? <AccountSignupPage onBack={() => goLanding("pricing")} /> : null}
      {view === "login" ? (
        <AccountLoginPage onBack={() => goLanding("top")} onGoSignup={goSignup} />
      ) : null}
      {view === "admin" ? <AdminDashboardPage onAfterLogout={() => goLanding("top")} /> : null}

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
